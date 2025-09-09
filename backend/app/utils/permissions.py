from functools import wraps
from fastapi import HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.master import Master
from app.models.user import User
from app.database import get_db

def require_master_permission(permission: str):
    """Декоратор для проверки конкретного разрешения мастера"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Получаем current_user из kwargs
            current_user = None
            db = None
            
            for key, value in kwargs.items():
                if isinstance(value, User):
                    current_user = value
                elif hasattr(value, 'scalar_one_or_none'):  # AsyncSession
                    db = value
            
            if not current_user or not db:
                raise HTTPException(status_code=500, detail="Internal error: missing dependencies")
            
            # Проверяем права мастера
            result = await db.execute(select(Master).where(Master.user_id == current_user.id))
            master = result.scalar_one_or_none()
            
            if not master:
                raise HTTPException(status_code=404, detail="Master profile not found")
            
            if not getattr(master, permission, False):
                raise HTTPException(
                    status_code=403, 
                    detail=f"Permission '{permission}' required. Contact your manager."
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator