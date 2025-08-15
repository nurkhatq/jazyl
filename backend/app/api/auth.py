from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services.auth import AuthService
from app.utils.security import get_current_user
from app.config import settings
from app.models.user import User

router = APIRouter()

from pydantic import BaseModel

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    auth_service = AuthService(db)
    
    # Verify current password
    if not auth_service.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    # Update password
    current_user.hashed_password = auth_service.get_password_hash(password_data.new_password)
    await db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Register new user"""
    # Extract subdomain from request
    subdomain = request.headers.get("X-Tenant-Subdomain")
    
    auth_service = AuthService(db)
    user = await auth_service.register_user(user_data, subdomain)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    return user

@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login user and return tokens"""
    auth_service = AuthService(db)
    
    user = await auth_service.authenticate_user(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = await auth_service.create_tokens(user)
    
    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token"""
    auth_service = AuthService(db)
    
    tokens = await auth_service.refresh_tokens(refresh_token)
    
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    return tokens

@router.post("/logout")
async def logout(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Logout user"""
    # Invalidate tokens in Redis
    auth_service = AuthService(db)
    await auth_service.logout_user(current_user.id)
    
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get current user information"""
    return current_user

@router.post("/verify-email/{token}")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Verify user email"""
    auth_service = AuthService(db)
    
    if await auth_service.verify_email(token):
        return {"message": "Email verified successfully"}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired verification token"
    )

from fastapi.responses import RedirectResponse

@router.get("/verify-email/{token}")
async def verify_email_get(token: str, db: AsyncSession = Depends(get_db)):
    auth_service = AuthService(db)
    if await auth_service.verify_email(token):
        return RedirectResponse(url="https://jazyl.tech/login", status_code=302)
    return RedirectResponse(url="https://jazyl.tech/verification-error", status_code=302)


@router.post("/reset-password-request")
async def reset_password_request(
    email: str,
    db: AsyncSession = Depends(get_db)
):
    """Request password reset"""
    auth_service = AuthService(db)
    
    await auth_service.send_password_reset(email)
    
    return {"message": "Password reset email sent if account exists"}

@router.post("/reset-password/{token}")
async def reset_password(
    token: str,
    new_password: str,
    db: AsyncSession = Depends(get_db)
):
    """Reset password with token"""
    auth_service = AuthService(db)
    
    if await auth_service.reset_password(token, new_password):
        return {"message": "Password reset successfully"}
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset token"
    )


# Добавьте этот endpoint в существующий файл

@router.post("/set-initial-password")
async def set_initial_password(
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Set initial password for newly created users (masters)"""
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required"
        )
    
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user already has a real password set (not the temporary one)
    # You might want to add a flag like 'password_set' to track this
    
    # Update password
    auth_service = AuthService(db)
    user.hashed_password = auth_service.get_password_hash(password)
    user.is_verified = True  # Mark as verified since they're setting password
    
    await db.commit()
    
    return {"message": "Password set successfully"}