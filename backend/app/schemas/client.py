from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class ClientBase(BaseModel):
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    birth_date: Optional[datetime] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    birth_date: Optional[datetime] = None
    preferences: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    is_vip: Optional[bool] = None

class ClientResponse(ClientBase):
    id: UUID
    tenant_id: UUID
    preferences: Dict[str, Any]
    notes: Optional[str]
    total_visits: int
    total_spent: float
    last_visit: Optional[datetime]
    is_vip: bool
    is_blacklisted: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True