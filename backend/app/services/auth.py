from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional, Dict
import secrets
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.schemas.user import UserCreate
from app.config import settings
from app.utils.email import EmailService
from app.utils.redis_client import redis_client

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_service = EmailService()
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        return pwd_context.hash(password)
    
    async def register_user(self, user_data: UserCreate, subdomain: Optional[str] = None) -> Optional[User]:
        # Check if user exists
        result = await self.db.execute(
            select(User).where(User.email == user_data.email)
        )
        if result.scalar_one_or_none():
            return None
        
        # Get tenant if subdomain provided
        tenant_id = None
        if subdomain:
            tenant_result = await self.db.execute(
                select(Tenant).where(Tenant.subdomain == subdomain)
            )
            tenant = tenant_result.scalar_one_or_none()
            if tenant:
                tenant_id = tenant.id
        
        # Create user
        user = User(
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            hashed_password=self.get_password_hash(user_data.password),
            role=user_data.role,
            tenant_id=tenant_id or user_data.tenant_id,
            verification_token=secrets.token_urlsafe(32)
        )
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        # Send verification email
        await self.email_service.send_verification_email(
            user.email,
            user.first_name,
            user.verification_token
        )
        
        return user
    
    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        
        if not user or not self.verify_password(password, user.hashed_password):
            return None
        
        if not user.is_active:
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        await self.db.commit()
        
        return user
    
    async def create_tokens(self, user: User) -> Dict[str, str]:
        # Create access token
        access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = self.create_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role.value},
            expires_delta=access_token_expires
        )
        
        # Create refresh token
        refresh_token_expires = timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        refresh_token = self.create_token(
            data={"sub": str(user.id), "type": "refresh"},
            expires_delta=refresh_token_expires
        )
        
        # Store refresh token in Redis
        await redis_client.setex(
            f"refresh_token:{user.id}",
            settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            refresh_token
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token
        }
    
    def create_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        return encoded_jwt
    
    async def verify_email(self, token: str) -> bool:
        result = await self.db.execute(
            select(User).where(User.verification_token == token)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        user.is_verified = True
        user.verification_token = None
        await self.db.commit()
        
        return True
    
    async def send_password_reset(self, email: str) -> None:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        
        if user:
            user.reset_token = secrets.token_urlsafe(32)
            await self.db.commit()
            
            await self.email_service.send_password_reset(
                user.email,
                user.first_name,
                user.reset_token
            )
    
    async def reset_password(self, token: str, new_password: str) -> bool:
        result = await self.db.execute(
            select(User).where(User.reset_token == token)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        user.hashed_password = self.get_password_hash(new_password)
        user.reset_token = None
        await self.db.commit()
        
        return True
    
    async def logout_user(self, user_id: str) -> None:
        # Remove refresh token from Redis
        await redis_client.delete(f"refresh_token:{user_id}")