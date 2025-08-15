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
    if not isinstance(roles, list):
        roles = [roles]
    
    async def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    
    return role_checker

async def get_current_tenant(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UUID:
    """Get current tenant from user or request headers"""
    
    # First, try to get from authenticated user
    if current_user and current_user.tenant_id:
        return current_user.tenant_id
    
    # Then try from headers
    tenant_id_header = request.headers.get("X-Tenant-ID")
    if tenant_id_header:
        try:
            return UUID(tenant_id_header)
        except ValueError:
            pass
    
    # Try subdomain
    subdomain = request.headers.get("X-Tenant-Subdomain")
    if subdomain:
        result = await db.execute(
            select(Tenant).where(Tenant.subdomain == subdomain)
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            return tenant.id
    
    # Last resort - try to extract from host
    host = request.headers.get("host", "")
    if ".jazyl.tech" in host:
        subdomain = host.split(".jazyl.tech")[0]
        result = await db.execute(
            select(Tenant).where(Tenant.subdomain == subdomain)
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            return tenant.id
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant not specified"
    )

# Добавьте эту функцию в существующий файл
async def get_current_user_from_token(
    token: str,
    db: AsyncSession
) -> User:
    """Получить пользователя из токена без использования Depends"""
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

async def get_optional_current_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[UUID]:
    """Get current tenant without requiring it"""
    try:
        return await get_current_tenant(request, None, db)
    except:
        return None