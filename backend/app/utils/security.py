from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, Union
from uuid import UUID
from app.models.master import Master
from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.tenant import Tenant

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Получить текущего пользователя по токену"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise credentials_exception
    
    try:
        result = await db.execute(
            select(User).where(User.id == UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if user is None:
            print(f"User not found for ID: {user_id}")
            raise credentials_exception
            
        if not user.is_active:
            print(f"User is not active: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )
        
        return user
        
    except Exception as e:
        print(f"Database error in get_current_user: {e}")
        raise credentials_exception

def require_role(roles: Union[UserRole, List[UserRole]]):
    """Проверка роли пользователя - исправленная версия"""
    # Ensure roles is always a list
    if not isinstance(roles, list):
        roles = [roles]
    
    async def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role(s): {[r.value for r in roles]}, your role: {current_user.role.value}"
            )
        return current_user
    
    return role_checker

async def get_current_master(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Получить текущего пользователя и проверить что он мастер - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
    try:
        # Сначала получаем пользователя
        user = await get_current_user(token, db)
        
        # Проверяем роль
        if user.role != UserRole.MASTER:
            print(f"User {user.email} has role {user.role.value}, but MASTER required")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted to masters only"
            )
        
        # Дополнительно проверяем что тенант активен
        if not user.tenant_id:
            print(f"Master {user.email} has no tenant_id")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Master must be associated with a tenant"
            )
        
        return user
        
    except HTTPException:
        # Пропускаем HTTP исключения дальше
        raise
    except Exception as e:
        print(f"Error in get_current_master: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

async def get_current_user_from_token(
    token: str,
    db: AsyncSession
) -> User:
    """Получить пользователя по токену без использования Depends"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(
        select(User).where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise credentials_exception
    
    return user

async def get_current_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> UUID:
    """Получить текущий тенант из запроса - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
    
    # Метод 1: Получить tenant_id из заголовка X-Tenant-ID
    tenant_id_str = request.headers.get("X-Tenant-ID")
    if tenant_id_str:
        try:
            tenant_id = UUID(tenant_id_str)
            # Проверяем что тенант существует
            result = await db.execute(
                select(Tenant).where(Tenant.id == tenant_id)
            )
            tenant = result.scalar_one_or_none()
            if tenant and tenant.is_active:
                return tenant_id
        except (ValueError, Exception) as e:
            print(f"Invalid tenant ID in header: {tenant_id_str}, error: {e}")
    
    # Метод 2: Получить subdomain из заголовка X-Tenant-Subdomain
    subdomain = request.headers.get("X-Tenant-Subdomain")
    
    if not subdomain:
        # Метод 3: Извлечь из host
        host = request.headers.get("host", "")
        if ".jazyl.tech" in host:
            subdomain = host.split(".jazyl.tech")[0]
            # Удаляем admin. префикс если есть
            if subdomain.startswith("admin."):
                subdomain = subdomain[6:]  # убираем "admin."
    
    if subdomain:
        try:
            result = await db.execute(
                select(Tenant).where(Tenant.subdomain == subdomain)
            )
            tenant = result.scalar_one_or_none()
            
            if tenant and tenant.is_active:
                return tenant.id
            else:
                print(f"Tenant not found or inactive for subdomain: {subdomain}")
        except Exception as e:
            print(f"Error finding tenant by subdomain {subdomain}: {e}")
    
    # Если ничего не найдено
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant not specified or not found. Please provide X-Tenant-ID header or valid subdomain."
    )

# Дополнительные вспомогательные функции для безопасности

async def verify_master_belongs_to_tenant(
    master_user: User,
    tenant_id: UUID,
    db: AsyncSession
) -> bool:
    """Проверить что мастер принадлежит указанному тенанту"""
    if master_user.tenant_id != tenant_id:
        return False
    
    
    result = await db.execute(
        select(Master).where(
            Master.user_id == master_user.id,
            Master.tenant_id == tenant_id
        )
    )
    master_profile = result.scalar_one_or_none()
    
    return master_profile is not None

async def get_master_with_permissions_check(
    permission_required: str,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
) -> tuple[User, Master]:
    """
    Получить мастера и проверить конкретное разрешение
    Возвращает кортеж (User, Master)
    """
    
    # Получаем профиль мастера
    result = await db.execute(
        select(Master).where(Master.user_id == current_user.id)
    )
    master_profile = result.scalar_one_or_none()
    
    if not master_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master profile not found"
        )
    
    # Проверяем конкретное разрешение
    if not getattr(master_profile, permission_required, False):
        permission_names = {
            'can_edit_profile': 'Profile editing',
            'can_edit_schedule': 'Schedule editing', 
            'can_edit_services': 'Services editing',
            'can_manage_bookings': 'Booking management',
            'can_view_analytics': 'Analytics viewing',
            'can_upload_photos': 'Photo uploading'
        }
        
        permission_name = permission_names.get(permission_required, permission_required)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{permission_name} permission required. Contact your manager."
        )
    
    return current_user, master_profile

# Вспомогательные функции для проверки разрешений
def require_master_permission(permission: str):
    """Декоратор для проверки конкретного разрешения мастера"""
    async def permission_checker(
        current_user: User = Depends(get_current_master),
        db: AsyncSession = Depends(get_db)
    ) -> tuple[User, 'Master']:
        return await get_master_with_permissions_check(permission, current_user, db)
    
    return permission_checker

# Алиасы для удобства
require_profile_edit = require_master_permission('can_edit_profile')
require_schedule_edit = require_master_permission('can_edit_schedule')
require_services_edit = require_master_permission('can_edit_services')
require_booking_management = require_master_permission('can_manage_bookings')
require_analytics_view = require_master_permission('can_view_analytics')
require_photo_upload = require_master_permission('can_upload_photos')