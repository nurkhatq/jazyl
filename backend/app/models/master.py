from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.database import Base

class Master(Base):
    __tablename__ = "masters"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Основная информация
    display_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)
    _specialization = Column("specialization", JSON, default=list)  # Переименовываем колонку
    experience_years = Column(Integer, default=0)
    
    # Рейтинг и статистика
    rating = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    
    # Статус
    is_active = Column(Boolean, default=True)
    is_visible = Column(Boolean, default=True)
    
    # Права доступа
    can_edit_profile = Column(Boolean, default=True)
    can_edit_schedule = Column(Boolean, default=False)
    can_edit_services = Column(Boolean, default=False)
    can_manage_bookings = Column(Boolean, default=True)
    can_view_analytics = Column(Boolean, default=True)
    can_upload_photos = Column(Boolean, default=True)
    
    # Временные метки
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # ИСПРАВЛЕНИЕ: Property для правильной обработки specialization
    @property
    def specialization(self):
        """Возвращает specialization как список строк"""
        if self._specialization is None:
            return []
        if isinstance(self._specialization, list):
            return self._specialization
        if isinstance(self._specialization, str):
            try:
                import json
                return json.loads(self._specialization)
            except:
                return []
        return []
    
    @specialization.setter
    def specialization(self, value):
        """Устанавливает specialization"""
        if value is None:
            self._specialization = []
        elif isinstance(value, list):
            self._specialization = value
        else:
            self._specialization = []
    
    # Связи - используйте строковые ссылки и lazy loading!
    permission_requests = relationship(
        "PermissionRequest", 
        back_populates="master", 
        lazy="select",
        cascade="all, delete-orphan"
    )
    block_times = relationship(
        "BlockTime", 
        back_populates="master", 
        lazy="select",
        cascade="all, delete-orphan"
    )
    tenant = relationship("Tenant", back_populates="masters")
    user = relationship("User", back_populates="master_profile")
    schedules = relationship(
        "MasterSchedule", 
        back_populates="master", 
        lazy="select",
        cascade="all, delete-orphan"
    )
    services = relationship(
        "MasterService", 
        back_populates="master", 
        lazy="select",
        cascade="all, delete-orphan"
    )
    bookings = relationship("Booking", back_populates="master", lazy="select")

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