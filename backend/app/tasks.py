from celery import shared_task
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.booking import Booking, BookingStatus
from app.services.notification import NotificationService
import asyncio

@shared_task
def send_reminder(booking_id: str, hours_before: int):
    """Send booking reminder"""
    async def _send():
        async with AsyncSessionLocal() as db:
            service = NotificationService(db)
            await service.send_booking_reminder(booking_id, hours_before)
    
    asyncio.run(_send())

@shared_task
def check_and_send_reminders():
    """Check and send pending reminders"""
    async def _check():
        async with AsyncSessionLocal() as db:
            # Find bookings that need reminders
            now = datetime.utcnow()
            
            # 24 hour reminders
            reminder_time = now + timedelta(hours=24)
            result = await db.execute(
                select(Booking).where(
                    and_(
                        Booking.status == BookingStatus.CONFIRMED,
                        Booking.date >= reminder_time,
                        Booking.date < reminder_time + timedelta(minutes=5)
                    )
                )
            )
            bookings_24h = result.scalars().all()
            
            service = NotificationService(db)
            for booking in bookings_24h:
                await service.send_booking_reminder(booking.id, 24)
            
            # 2 hour reminders
            reminder_time = now + timedelta(hours=2)
            result = await db.execute(
                select(Booking).where(
                    and_(
                        Booking.status == BookingStatus.CONFIRMED,
                        Booking.date >= reminder_time,
                        Booking.date < reminder_time + timedelta(minutes=5)
                    )
                )
            )
            bookings_2h = result.scalars().all()
            
            for booking in bookings_2h:
                await service.send_booking_reminder(booking.id, 2)
    
    asyncio.run(_check())

@shared_task
def cleanup_old_bookings():
    """Mark old unconfirmed bookings as cancelled"""
    async def _cleanup():
        async with AsyncSessionLocal() as db:
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            
            result = await db.execute(
                select(Booking).where(
                    and_(
                        Booking.status == BookingStatus.PENDING,
                        Booking.created_at < cutoff_time
                    )
                )
            )
            bookings = result.scalars().all()
            
            for booking in bookings:
                booking.status = BookingStatus.CANCELLED
                booking.cancellation_reason = "Not confirmed within 24 hours"
            
            await db.commit()
    
    asyncio.run(_cleanup())