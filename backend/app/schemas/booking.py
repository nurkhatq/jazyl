from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.models.booking import BookingStatus

class BookingBase(BaseModel):
    master_id: UUID
    service_id: UUID
    date: datetime
    notes: Optional[str] = None
    
    @validator('date')
    def validate_future_date(cls, v):
        if v <= datetime.utcnow():
            raise ValueError('Booking date must be in the future')
        return v

class BookingCreate(BookingBase):
    client_email: str = Field(..., min_length=3)
    client_phone: str = Field(..., min_length=10)
    client_name: str = Field(..., min_length=1)

class BookingUpdate(BaseModel):
    date: Optional[datetime] = None
    status: Optional[BookingStatus] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None

class BookingResponse(BookingBase):
    id: UUID
    tenant_id: UUID
    client_id: UUID
    end_time: datetime
    status: BookingStatus
    price: float
    confirmation_token: str
    cancellation_token: str
    confirmed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancellation_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True