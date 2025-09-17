from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.models.permission_request import PermissionRequestType, PermissionRequestStatus

class PermissionRequestCreate(BaseModel):
    permission_type: PermissionRequestType
    reason: str = Field(..., min_length=10, max_length=500)
    additional_info: Optional[str] = Field(None, max_length=1000)

class PermissionRequestResponse(BaseModel):
    id: UUID
    master_id: UUID
    tenant_id: UUID
    permission_type: PermissionRequestType
    reason: str
    additional_info: Optional[str] = None
    status: PermissionRequestStatus
    reviewed_by: Optional[UUID] = None
    review_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class PermissionRequestReview(BaseModel):
    review_note: Optional[str] = Field(None, max_length=500)
