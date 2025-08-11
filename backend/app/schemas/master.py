from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from uuid import UUID

class MasterScheduleSchema(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., regex='^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')
    end_time: str = Field(..., regex='^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')
    is_working: bool = True

class MasterBase(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    photo_url: Optional[str] = None
    specialization: List[str] = []

class MasterCreate(MasterBase):
    user_id: UUID
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
    rating: float
    reviews_count: int
    is_active: bool
    is_visible: bool
    schedules: List[MasterScheduleSchema]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True