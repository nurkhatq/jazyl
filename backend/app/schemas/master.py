from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

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
    user_id: Optional[UUID] = None  # Сделаем опциональным
    schedules: List[MasterScheduleSchema] = []

class MasterUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    photo_url: Optional[str] = None
    specialization: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None

class MasterResponse(MasterBase):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    rating: float = 0.0
    reviews_count: int = 0
    is_active: bool = True
    is_visible: bool = True
    schedules: List[MasterScheduleSchema] = []
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
        arbitrary_types_allowed = True

# Упрощенная схема для my-profile endpoint
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