from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base

class BlockTime(Base):
    __tablename__ = "block_times"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("masters.id"), nullable=False, index=True)
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    reason = Column(String(255))
    description = Column(Text)
    
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSON)  # For recurring blocks
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    master = relationship("Master", back_populates="block_times")