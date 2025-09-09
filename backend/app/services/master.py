from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete, text
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
import secrets

from app.models.master import Master, MasterSchedule, MasterService
from app.models.block_time import BlockTime
from app.models.user import User, UserRole
from app.schemas.master import MasterCreate, MasterUpdate
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class MasterService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_master(self, tenant_id: UUID, master_data: dict) -> Master:
        # Если предоставлены данные для создания пользователя
        if 'user_email' in master_data:
            # Проверяем, существует ли уже пользователь с таким email
            existing_user = await self.db.execute(
                select(User).where(User.email == master_data['user_email'])
            )
            user = existing_user.scalar_one_or_none()
            
            if not user:
                # Создаем нового пользователя
                temp_password = secrets.token_urlsafe(12)  # Генерируем временный пароль
                user = User(
                    email=master_data['user_email'],
                    first_name=master_data.get('user_first_name', ''),
                    last_name=master_data.get('user_last_name', ''),
                    hashed_password=pwd_context.hash(temp_password),
                    role=UserRole.MASTER,
                    tenant_id=tenant_id,
                    is_active=True,
                    is_verified=False,  # Потребуется верификация email
                    verification_token=secrets.token_urlsafe(32)
                )
                self.db.add(user)
                await self.db.flush()
                
                # TODO: Отправить email с временным паролем и ссылкой для установки нового
                print(f"Created user for master with temp password: {temp_password}")
            
            user_id = user.id
        else:
            # Используем предоставленный user_id
            user_id = master_data.get('user_id')
            if not user_id:
                raise ValueError("Either user_id or user_email must be provided")
        
        # Создаем мастера
        master = Master(
            tenant_id=tenant_id,
            user_id=user_id,
            display_name=master_data['display_name'],
            description=master_data.get('description'),
            photo_url=master_data.get('photo_url'),
            specialization=master_data.get('specialization', [])
        )
        
        self.db.add(master)
        await self.db.flush()
        
        # Создаем расписание если предоставлено
        if 'schedules' in master_data:
            for schedule_data in master_data['schedules']:
                schedule = MasterSchedule(
                    master_id=master.id,
                    **schedule_data
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
    
    async def update_schedule(self, master_id: UUID, schedule_data: List[dict]) -> bool:
        """Обновить расписание мастера"""
        try:
            # Удаляем старое расписание
            await self.db.execute(
                delete(MasterSchedule).where(MasterSchedule.master_id == master_id)
            )
            
            # Создаем новое расписание
            for day_data in schedule_data:
                schedule = MasterSchedule(
                    master_id=master_id,
                    day_of_week=day_data["day_of_week"],
                    start_time=day_data["start_time"],
                    end_time=day_data["end_time"],
                    is_working=day_data.get("is_working", True)
                )
                self.db.add(schedule)
            
            await self.db.commit()
            return True
            
        except Exception as e:
            await self.db.rollback()
            raise ValueError(f"Failed to update schedule: {str(e)}")
    
    async def create_block_time(self, master_id: UUID, block_data: dict) -> dict:
        """Создать блокировку времени"""
        try:
            # Парсим время
            start_time = datetime.fromisoformat(block_data["start_time"])
            end_time = datetime.fromisoformat(block_data["end_time"])
            
            # Проверяем что время корректное
            if start_time >= end_time:
                raise ValueError("End time must be after start time")
            
            # Создаем блокировку
            block_time = BlockTime(
                master_id=master_id,
                start_time=start_time,
                end_time=end_time,
                reason=block_data.get("reason", "break"),
                description=block_data.get("description", "")
            )
            
            self.db.add(block_time)
            await self.db.commit()
            await self.db.refresh(block_time)
            
            return {
                "id": str(block_time.id),
                "start_time": block_time.start_time.isoformat(),
                "end_time": block_time.end_time.isoformat(),
                "reason": block_time.reason,
                "description": block_time.description
            }
            
        except Exception as e:
            await self.db.rollback()
            raise ValueError(f"Failed to create block time: {str(e)}")
    
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
    
    async def get_master_clients(self, master_id: UUID) -> List[dict]:
        """Получить клиентов мастера"""
        from app.models.booking import Booking, BookingStatus
        from app.models.client import Client
        
        # Получаем уникальных клиентов мастера с статистикой
        query = """
        SELECT 
            c.*,
            COUNT(b.id) as total_bookings,
            COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
            COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
            COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.price ELSE 0 END), 0) as total_spent,
            MAX(CASE WHEN b.status = 'completed' THEN b.date END) as last_booking_date
        FROM clients c
        JOIN bookings b ON c.id = b.client_id
        WHERE b.master_id = :master_id
        GROUP BY c.id
        ORDER BY total_bookings DESC
        """
        
        result = await self.db.execute(text(query), {"master_id": master_id})
        clients = result.fetchall()
        
        return [
            {
                "id": str(client.id),
                "first_name": client.first_name,
                "last_name": client.last_name,
                "email": client.email,
                "phone": client.phone,
                "total_bookings": client.total_bookings,
                "completed_bookings": client.completed_bookings,
                "cancelled_bookings": client.cancelled_bookings,
                "total_spent": float(client.total_spent),
                "last_booking_date": client.last_booking_date.isoformat() if client.last_booking_date else None,
                "created_at": client.created_at.isoformat()
            }
            for client in clients
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