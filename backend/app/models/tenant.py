from sqlalchemy import Column, String, Boolean, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subdomain = Column(String(63), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20))
    address = Column(Text)
    
    # Branding
    logo_url = Column(String(500))
    primary_color = Column(String(7), default="#000000")
    secondary_color = Column(String(7), default="#FFFFFF")
    
    # Settings
    working_hours = Column(JSON, default={
        "monday": {"open": "09:00", "close": "20:00"},
        "tuesday": {"open": "09:00", "close": "20:00"},
        "wednesday": {"open": "09:00", "close": "20:00"},
        "thursday": {"open": "09:00", "close": "20:00"},
        "friday": {"open": "09:00", "close": "20:00"},
        "saturday": {"open": "10:00", "close": "18:00"},
        "sunday": {"open": "10:00", "close": "18:00"},
    })
    
    booking_settings = Column(JSON, default={
        "min_advance_hours": 2,
        "max_advance_days": 30,
        "slot_duration": 30,
        "allow_cancellation": True,
        "cancellation_hours": 2,
    })
    
    notification_settings = Column(JSON, default={
        "email_enabled": True,
        "sms_enabled": False,
        "reminder_hours": [24, 2],
    })
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    masters = relationship("Master", back_populates="tenant", cascade="all, delete-orphan")
    services = relationship("Service", back_populates="tenant", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="tenant", cascade="all, delete-orphan")
    clients = relationship("Client", back_populates="tenant", cascade="all, delete-orphan")