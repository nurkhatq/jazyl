from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from typing import Optional, List
from datetime import datetime, date, timedelta
from uuid import UUID
import secrets

from app.models.booking import Booking, BookingStatus
from app.models.master import Master, MasterSchedule
from app.models.service import Service
from app.models.client import Client
from app.models.block_time import BlockTime
from app.schemas.booking import BookingCreate, BookingUpdate
from app.utils.email import EmailService

class BookingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_service = EmailService()
    
    async def create_booking(self, tenant_id: UUID, booking_data: BookingCreate) -> Booking:
        # Get or create client
        client = await self._get_or_create_client(
            tenant_id,
            booking_data.client_email,
            booking_data.client_phone,
            booking_data.client_name
        )
        
        # Get service details
        service_result = await self.db.execute(
            select(Service).where(Service.id == booking_data.service_id)
        )
        service = service_result.scalar_one()
        
        # Calculate end time
        end_time = booking_data.date + timedelta(minutes=service.duration)
        
        # Create booking
        booking = Booking(
            tenant_id=tenant_id,
            master_id=booking_data.master_id,
            service_id=booking_data.service_id,
            client_id=client.id,
            date=booking_data.date,
            end_time=end_time,
            price=service.price,
            notes=booking_data.notes,
            status=BookingStatus.PENDING,
            confirmation_token=secrets.token_urlsafe(32),
            cancellation_token=secrets.token_urlsafe(32)
        )
        
        self.db.add(booking)
        await self.db.commit()
        await self.db.refresh(booking)
        
        return booking
    
    async def _get_or_create_client(self, tenant_id: UUID, email: str, phone: str, name: str) -> Client:
        # Check if client exists
        result = await self.db.execute(
            select(Client).where(
                and_(
                    Client.tenant_id == tenant_id,
                    or_(Client.email == email, Client.phone == phone)
                )
            )
        )
        client = result.scalar_one_or_none()
        
        if not client:
            # Parse name
            name_parts = name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else None
            
            # Create new client
            client = Client(
                tenant_id=tenant_id,
                email=email,
                phone=phone,
                first_name=first_name,
                last_name=last_name
            )
            self.db.add(client)
            await self.db.commit()
            await self.db.refresh(client)
        
        return client
    
    async def get_bookings(
        self,
        tenant_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        master_id: Optional[UUID] = None,
        status: Optional[BookingStatus] = None
    ) -> List[Booking]:
        query = select(Booking).where(Booking.tenant_id == tenant_id)
        
        if date_from:
            query = query.where(Booking.date >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.where(Booking.date <= datetime.combine(date_to, datetime.max.time()))
        if master_id:
            query = query.where(Booking.master_id == master_id)
        if status:
            query = query.where(Booking.status == status)
        
        query = query.order_by(Booking.date)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_booking(self, booking_id: UUID) -> Optional[Booking]:
        result = await self.db.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        return result.scalar_one_or_none()
    
    async def confirm_booking(self, booking_id: UUID, token: str) -> Optional[Booking]:
        result = await self.db.execute(
            select(Booking).where(
                and_(
                    Booking.id == booking_id,
                    Booking.confirmation_token == token,
                    Booking.status == BookingStatus.PENDING
                )
            )
        )
        booking = result.scalar_one_or_none()
        
        if not booking:
            return None
        
        booking.status = BookingStatus.CONFIRMED
        booking.confirmed_at = datetime.utcnow()
        await self.db.commit()
        
        return booking
    
    async def cancel_booking_with_token(
        self,
        booking_id: UUID,
        token: str,
        reason: Optional[str] = None
    ) -> Optional[Booking]:
        result = await self.db.execute(
            select(Booking).where(
                and_(
                    Booking.id == booking_id,
                    Booking.cancellation_token == token,
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
                )
            )
        )
        booking = result.scalar_one_or_none()
        
        if not booking:
            return None
        
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = datetime.utcnow()
        booking.cancellation_reason = reason
        await self.db.commit()
        
        # Send cancellation email
        await self.email_service.send_booking_cancellation(booking.id)
        
        return booking
    
    async def cancel_booking(
        self,
        booking_id: UUID,
        user_id: UUID,
        reason: Optional[str] = None
    ) -> Optional[Booking]:
        # TODO: Check user authorization
        booking = await self.get_booking(booking_id)
        
        if not booking or booking.status not in [BookingStatus.PENDING, BookingStatus.CONFIRMED]:
            return None
        
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = datetime.utcnow()
        booking.cancellation_reason = reason
        await self.db.commit()
        
        return booking
    
    async def update_booking(
        self,
        booking_id: UUID,
        booking_data: BookingUpdate,
        user_id: UUID
    ) -> Optional[Booking]:
        booking = await self.get_booking(booking_id)
        
        if not booking:
            return None
        
        update_data = booking_data.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(booking, key, value)
        
        booking.updated_at = datetime.utcnow()
        await self.db.commit()
        
        return booking
    
    async def check_availability(
        self,
        tenant_id: UUID,
        master_id: UUID,
        booking_date: datetime,
        service_id: UUID
    ) -> bool:
        # Get service duration
        service_result = await self.db.execute(
            select(Service).where(Service.id == service_id)
        )
        service = service_result.scalar_one()
        end_time = booking_date + timedelta(minutes=service.duration)
        
        # Check for existing bookings
        booking_result = await self.db.execute(
            select(Booking).where(
                and_(
                    Booking.master_id == master_id,
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                    or_(
                        and_(Booking.date <= booking_date, Booking.end_time > booking_date),
                        and_(Booking.date < end_time, Booking.end_time >= end_time)
                    )
                )
            )
        )
        
        if booking_result.scalar_one_or_none():
            return False
        
        # Check for block times
        block_result = await self.db.execute(
            select(BlockTime).where(
                and_(
                    BlockTime.master_id == master_id,
                    BlockTime.start_time <= booking_date,
                    BlockTime.end_time > booking_date
                )
            )
        )
        
        if block_result.scalar_one_or_none():
            return False
        
        # Check master schedule
        day_of_week = booking_date.weekday()
        schedule_result = await self.db.execute(
            select(MasterSchedule).where(
                and_(
                    MasterSchedule.master_id == master_id,
                    MasterSchedule.day_of_week == day_of_week,
                    MasterSchedule.is_working == True
                )
            )
        )
        schedule = schedule_result.scalar_one_or_none()
        
        if not schedule:
            return False
        
        # Check if time is within working hours
        booking_time = booking_date.time()
        start_time = datetime.strptime(schedule.start_time, "%H:%M").time()
        end_time = datetime.strptime(schedule.end_time, "%H:%M").time()
        
        if booking_time < start_time or booking_time >= end_time:
            return False
        
        return True
    
    async def get_available_slots(
        self,
        tenant_id: UUID,
        master_id: UUID,
        booking_date: date,
        service_id: UUID
    ) -> List[str]:
        # Get service duration
        service_result = await self.db.execute(
            select(Service).where(Service.id == service_id)
        )
        service = service_result.scalar_one()
        
        # Get master schedule for the day
        day_of_week = booking_date.weekday()
        schedule_result = await self.db.execute(
            select(MasterSchedule).where(
                and_(
                    MasterSchedule.master_id == master_id,
                    MasterSchedule.day_of_week == day_of_week,
                    MasterSchedule.is_working == True
                )
            )
        )
        schedule = schedule_result.scalar_one_or_none()
        
        if not schedule:
            return []
        
        # Get existing bookings for the day
        start_of_day = datetime.combine(booking_date, datetime.min.time())
        end_of_day = datetime.combine(booking_date, datetime.max.time())
        
        bookings_result = await self.db.execute(
            select(Booking).where(
                and_(
                    Booking.master_id == master_id,
                    Booking.date >= start_of_day,
                    Booking.date <= end_of_day,
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
                )
            ).order_by(Booking.date)
        )
        bookings = bookings_result.scalars().all()
        
        # Get block times for the day
        blocks_result = await self.db.execute(
            select(BlockTime).where(
                and_(
                    BlockTime.master_id == master_id,
                    BlockTime.start_time >= start_of_day,
                    BlockTime.start_time <= end_of_day
                )
            )
        )
        blocks = blocks_result.scalars().all()
        
        # Generate available slots
        available_slots = []
        
        start_time = datetime.strptime(schedule.start_time, "%H:%M").time()
        end_time = datetime.strptime(schedule.end_time, "%H:%M").time()
        
        current_slot = datetime.combine(booking_date, start_time)
        end_datetime = datetime.combine(booking_date, end_time)
        
        slot_duration = 30  # minutes
        
        while current_slot + timedelta(minutes=service.duration) <= end_datetime:
            # Check if slot is available
            is_available = True
            
            # Check against existing bookings
            for booking in bookings:
                if (current_slot < booking.end_time and 
                    current_slot + timedelta(minutes=service.duration) > booking.date):
                    is_available = False
                    break
            
            # Check against block times
            if is_available:
                for block in blocks:
                    if (current_slot < block.end_time and 
                        current_slot + timedelta(minutes=service.duration) > block.start_time):
                        is_available = False
                        break
            
            if is_available:
                available_slots.append(current_slot.strftime("%H:%M"))
            
            current_slot += timedelta(minutes=slot_duration)
        
        return available_slots