from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

from app.models.master import Master, MasterSchedule, MasterService
from app.models.block_time import BlockTime
from app.schemas.master import MasterCreate, MasterUpdate

class MasterService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_master(self, tenant_id: UUID, master_data: MasterCreate) -> Master:
        # Create master
        master = Master(
            tenant_id=tenant_id,
            user_id=master_data.user_id,
            display_name=master_data.display_name,
            description=master_data.description,
            photo_url=master_data.photo_url,
            specialization=master_data.specialization
        )
        
        self.db.add(master)
        await self.db.flush()
        
        # Create schedules
        for schedule_data in master_data.schedules:
            schedule = MasterSchedule(
                master_id=master.id,
                **schedule_data.dict()
            )
            self.db.add(schedule)
        
        await self.db.commit()
        await self.db.refresh(master)
        
        return master
    
    async def get_masters(
        self,
        tenant_id: UUID,
        is_active: Optional[bool] = None
    ) -> List[Master]:
        query = select(Master).where(Master.tenant_id == tenant_id)
        
        if is_active is not None:
            query = query.where(Master.is_active == is_active)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_master(self, master_id: UUID) -> Optional[Master]:
        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        return result.scalar_one_or_none()
    
    async def update_master(
        self,
        master_id: UUID,
        master_data: MasterUpdate
    ) -> Optional[Master]:
        master = await self.get_master(master_id)
        
        if not master:
            return None
        
        update_data = master_data.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(master, key, value)
        
        master.updated_at = datetime.utcnow()
        await self.db.commit()
        
        return master
    
    async def delete_master(self, master_id: UUID) -> None:
        master = await self.get_master(master_id)
        
        if master:
            master.is_active = False
            master.is_visible = False
            await self.db.commit()
    
    async def get_schedule(
        self,
        master_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> dict:
        # Get regular schedule
        schedule_result = await self.db.execute(
            select(MasterSchedule).where(MasterSchedule.master_id == master_id)
        )
        schedules = schedule_result.scalars().all()
        
        # Get block times
        query = select(BlockTime).where(BlockTime.master_id == master_id)
        
        if date_from:
            query = query.where(BlockTime.start_time >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.where(BlockTime.end_time <= datetime.combine(date_to, datetime.max.time()))
        
        blocks_result = await self.db.execute(query)
        blocks = blocks_result.scalars().all()
        
        return {
            "regular_schedule": [
                {
                    "day_of_week": s.day_of_week,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "is_working": s.is_working
                }
                for s in schedules
            ],
            "block_times": [
                {
                    "start_time": b.start_time.isoformat(),
                    "end_time": b.end_time.isoformat(),
                    "reason": b.reason
                }
                for b in blocks
            ]
        }
    
    async def update_schedule(self, master_id: UUID, schedule_data: List[dict]) -> None:
        # Delete existing schedules
        await self.db.execute(
            delete(MasterSchedule).where(MasterSchedule.master_id == master_id)
        )
        
        # Create new schedules
        for schedule_item in schedule_data:
            schedule = MasterSchedule(
                master_id=master_id,
                **schedule_item
            )
            self.db.add(schedule)
        
        await self.db.commit()
    
    async def create_block_time(self, master_id: UUID, block_data: dict) -> BlockTime:
        block = BlockTime(
            master_id=master_id,
            **block_data
        )
        
        self.db.add(block)
        await self.db.commit()
        await self.db.refresh(block)
        
        return block
    
    async def get_master_services(self, master_id: UUID) -> List[dict]:
        result = await self.db.execute(
            select(MasterService).where(
                and_(
                    MasterService.master_id == master_id,
                    MasterService.is_active == True
                )
            )
        )
        services = result.scalars().all()
        
        return [
            {
                "service_id": s.service_id,
                "custom_price": s.custom_price,
                "custom_duration": s.custom_duration
            }
            for s in services
        ]
    
    async def update_master_services(self, master_id: UUID, service_ids: List[UUID]) -> None:
        # Delete existing services
        await self.db.execute(
            delete(MasterService).where(MasterService.master_id == master_id)
        )
        
        # Add new services
        for service_id in service_ids:
            master_service = MasterService(
                master_id=master_id,
                service_id=service_id
            )
            self.db.add(master_service)
        
        await self.db.commit()