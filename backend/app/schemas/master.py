from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class MasterPermissions(BaseModel):
    can_edit_profile: bool = True
    can_edit_schedule: bool = False
    can_edit_services: bool = False
    can_manage_bookings: bool = True
    can_view_analytics: bool = True
    can_upload_photos: bool = True

class MasterScheduleSchema(BaseModel):
    id: Optional[UUID] = None
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern='^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')
    end_time: str = Field(..., pattern='^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')
    is_working: bool = True
    
    class Config:
        from_attributes = True

class MasterBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    photo_url: Optional[str] = None
    specialization: List[str] = []

class MasterCreate(MasterBase):
    user_id: Optional[UUID] = None
    schedules: List[MasterScheduleSchema] = []
    
    # ДОБАВЛЕНО: Поля для создания нового пользователя
    user_email: Optional[EmailStr] = None
    user_first_name: Optional[str] = Field(None, max_length=100)
    user_last_name: Optional[str] = Field(None, max_length=100)
    user_phone: Optional[str] = Field(None, max_length=20)

class MasterUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    specialization: Optional[List[str]] = None
    experience_years: Optional[int] = None
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None

class MasterPermissionsUpdate(BaseModel):
    """Только для владельцев - обновление прав мастера"""
    can_edit_profile: Optional[bool] = None
    can_edit_schedule: Optional[bool] = None
    can_edit_services: Optional[bool] = None
    can_manage_bookings: Optional[bool] = None
    can_view_analytics: Optional[bool] = None
    can_upload_photos: Optional[bool] = None

class MasterResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    display_name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    specialization: List[str] = []
    experience_years: int = 0
    rating: float = 0.0
    reviews_count: int = 0
    is_active: bool = True
    is_visible: bool = True
    
    # Права доступа
    can_edit_profile: bool = True
    can_edit_schedule: bool = False
    can_edit_services: bool = False
    can_manage_bookings: bool = True
    can_view_analytics: bool = True
    can_upload_photos: bool = True
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MasterProfileResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    display_name: str
    description: Optional[str] = None
    photo_url: Optional[str] = None
    specialization: List[str] = []
    rating: float = 0.0
    reviews_count: int = 0
    is_active: bool = True
    is_visible: bool = True
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True