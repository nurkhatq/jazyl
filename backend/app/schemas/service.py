from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class ServiceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    duration: int = Field(..., gt=0)  # In minutes
    category_id: Optional[UUID] = None

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    duration: Optional[int] = Field(None, gt=0)
    category_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    is_popular: Optional[bool] = None

class ServiceResponse(ServiceBase):
    id: UUID
    tenant_id: UUID
    is_active: bool
    is_popular: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True