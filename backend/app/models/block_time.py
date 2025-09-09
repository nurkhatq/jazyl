from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.database import Base

class BlockTime(Base):
    __tablename__ = "block_times"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("masters.id"), nullable=False)
    
    # Время блокировки
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    # Причина блокировки
    reason = Column(String, nullable=False)  # break, lunch, personal, sick, vacation, etc
    description = Column(Text, nullable=True)
    
    # Временные метки
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Связи
    master = relationship("Master", back_populates="block_times")

# Добавить в master.py:
# block_times = relationship("BlockTime", back_populates="master", cascade="all, delete-orphan")