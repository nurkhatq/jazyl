# backend/app/models/booking.py
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Enum as SqlEnum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    master_id = Column(UUID(as_uuid=True), ForeignKey("masters.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    
    date = Column(DateTime, nullable=False)
    price = Column(Float, nullable=False)
    
    status = Column(SqlEnum(BookingStatus), default=BookingStatus.PENDING)
    notes = Column(Text)
    
    # Email verification tokens
    email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(255))
    confirmation_token = Column(String(255))
    cancellation_token = Column(String(255))
    
    # Timestamps
    confirmed_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="bookings")
    master = relationship("Master", back_populates="bookings")
    client = relationship("Client", back_populates="bookings")
    service = relationship("Service", back_populates="bookings")