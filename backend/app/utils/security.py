from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, Union
from uuid import UUID

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.tenant import Tenant

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
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

def require_role(roles: Union[UserRole, List[UserRole]]):
    """Fixed version that properly handles single role or list of roles"""
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

# Alternative simple function for master endpoints
async def get_current_master(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current user and verify they are a master"""
    user = await get_current_user(token, db)
    
    if user.role != UserRole.MASTER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to masters only"
        )
    
    return user

async def get_current_user_from_token(
    token: str,
    db: AsyncSession
) -> User:
    """Get user from token without using Depends"""
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
    """Get current tenant from request"""
    # Метод 1: Получить tenant_id из заголовка X-Tenant-ID
    tenant_id_str = request.headers.get("X-Tenant-ID")
    if tenant_id_str:
        try:
            return UUID(tenant_id_str)
        except ValueError:
            pass
    
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
    
    if not subdomain or subdomain in ["www", "jazyl"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not specified"
        )
    
    result = await db.execute(
        select(Tenant).where(Tenant.subdomain == subdomain)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant or not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant.id

async def get_optional_current_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[UUID]:
    """Get current tenant without requiring it"""
    try:
        return await get_current_tenant(request, db)
    except:
        return None

async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Возвращает текущего пользователя или None
    """
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        user = await get_current_user_from_token(token=token, db=db)
        return user
    except:
        return None