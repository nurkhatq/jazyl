from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Float, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base

class Master(Base):
    __tablename__ = "masters"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    display_name = Column(String(255), nullable=False)
    description = Column(Text)
    photo_url = Column(String(500))
    specialization = Column(JSON, default=list)  # List of specializations
    
    rating = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True)
    is_visible = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="masters")
    user = relationship("User", back_populates="master_profile")
    schedules = relationship("MasterSchedule", back_populates="master", cascade="all, delete-orphan")
    services = relationship("MasterService", back_populates="master", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="master")
    block_times = relationship("BlockTime", back_populates="master", cascade="all, delete-orphan")

class MasterSchedule(Base):
    __tablename__ = "master_schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("masters.id"), nullable=False)
    
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(String(5), nullable=False)  # HH:MM format
    end_time = Column(String(5), nullable=False)
    
    is_working = Column(Boolean, default=True)
    
    # Relationships
    master = relationship("Master", back_populates="schedules")

class MasterService(Base):
    __tablename__ = "master_services"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("masters.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    
    custom_price = Column(Float)  # If different from standard service price
    custom_duration = Column(Integer)  # In minutes, if different from standard
    
    is_active = Column(Boolean, default=True)
    
    # Relationships
    master = relationship("Master", back_populates="services")
    service = relationship("Service")