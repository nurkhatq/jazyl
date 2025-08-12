from celery import shared_task
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.booking import Booking, BookingStatus
from app.services.notification import NotificationService

@shared_task(bind=True)
async def send_reminder(self, booking_id: str, hours_before: int):
    """Send booking reminder"""
    async with AsyncSessionLocal() as db:
        service = NotificationService(db)
        await service.send_booking_reminder(booking_id, hours_before)

@shared_task(bind=True)
async def check_and_send_reminders(self):
    """Check and send pending reminders"""
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        
        # 24 hour reminders
        reminder_time_24h = now + timedelta(hours=24)
        result_24h = await db.execute(
            select(Booking).where(
                and_(
                    Booking.status == BookingStatus.CONFIRMED,
                    Booking.date >= reminder_time_24h,
                    Booking.date < reminder_time_24h + timedelta(minutes=5)
                )
            )
        )
        bookings_24h = result_24h.scalars().all()
        
        service = NotificationService(db)
        for booking in bookings_24h:
            await service.send_booking_reminder(booking.id, 24)
        
        # 2 hour reminders
        reminder_time_2h = now + timedelta(hours=2)
        result_2h = await db.execute(
            select(Booking).where(
                and_(
                    Booking.status == BookingStatus.CONFIRMED,
                    Booking.date >= reminder_time_2h,
                    Booking.date < reminder_time_2h + timedelta(minutes=5)
                )
            )
        )
        bookings_2h = result_2h.scalars().all()
        for booking in bookings_2h:
            await service.send_booking_reminder(booking.id, 2)

@shared_task(bind=True)
async def cleanup_old_bookings(self):
    """Mark old unconfirmed bookings as cancelled"""
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
