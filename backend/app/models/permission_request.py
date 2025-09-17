from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
import enum

from app.database import Base

class PermissionRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class PermissionRequestType(str, enum.Enum):
    EDIT_SCHEDULE = "edit_schedule"
    EDIT_SERVICES = "edit_services"
    EDIT_PROFILE = "edit_profile"
    UPLOAD_PHOTOS = "upload_photos"
    MANAGE_BOOKINGS = "manage_bookings"
    VIEW_ANALYTICS = "view_analytics"

class PermissionRequest(Base):
    __tablename__ = "permission_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("masters.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Тип запроса
    permission_type = Column(Enum(PermissionRequestType), nullable=False)
    
    # Детали запроса
    reason = Column(Text, nullable=False)
    additional_info = Column(Text, nullable=True)
    
    # Статус
    status = Column(Enum(PermissionRequestStatus), default=PermissionRequestStatus.PENDING)
    
    # Кто рассмотрел
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    review_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Временные метки
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи
    master = relationship("Master", back_populates="permission_requests")
    tenant = relationship("Tenant")
    reviewer = relationship("User", foreign_keys=[reviewed_by])