from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class TenantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    subdomain: str = Field(..., min_length=3, max_length=63)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    
    @validator('subdomain')
    def validate_subdomain(cls, v):
        import re
        if not re.match(r'^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$', v):
            raise ValueError('Invalid subdomain format')
        return v

class TenantCreate(TenantBase):
    pass

class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(None, pattern='^#[0-9A-Fa-f]{6}$')
    secondary_color: Optional[str] = Field(None, pattern='^#[0-9A-Fa-f]{6}$')
    working_hours: Optional[Dict[str, Dict[str, str]]] = None
    booking_settings: Optional[Dict[str, Any]] = None
    notification_settings: Optional[Dict[str, Any]] = None

class TenantResponse(TenantBase):
    id: UUID
    logo_url: Optional[str]
    primary_color: str
    secondary_color: str
    working_hours: Dict[str, Dict[str, str]]
    booking_settings: Dict[str, Any]
    notification_settings: Dict[str, Any]
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
