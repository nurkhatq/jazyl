from celery import shared_task
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.booking import Booking, BookingStatus
from app.services.notification import NotificationService
import asyncio


# ─────────────── Helper ─────────────── #
def run_async(coro):
    """
    Запускает async функцию внутри новой event loop,
    чтобы избежать ошибки 'attached to a different loop'.
    """
    try:
        # Try to get the current loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is running, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        # No event loop exists, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


# ─────────────── Check and send reminders ─────────────── #
@shared_task(bind=True)
def check_and_send_reminders(self):
    return run_async(_check_and_send_reminders())


async def _check_and_send_reminders():
    # Create a fresh async session within the new event loop
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        service = NotificationService(db)

        # 24h reminders
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
        
        for booking in bookings_24h:
            try:
                await service.send_booking_reminder(booking.id, 24)
            except Exception as e:
                print(f"Failed to send 24h reminder for booking {booking.id}: {e}")

        # 2h reminders
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
            try:
                await service.send_booking_reminder(booking.id, 2)
            except Exception as e:
                print(f"Failed to send 2h reminder for booking {booking.id}: {e}")


# ─────────────── Send single reminder ─────────────── #
@shared_task(bind=True)
def send_reminder(self, booking_id: str, hours_before: int):
    return run_async(_send_reminder(booking_id, hours_before))


async def _send_reminder(booking_id: str, hours_before: int):
    async with AsyncSessionLocal() as db:
        service = NotificationService(db)
        try:
            await service.send_booking_reminder(booking_id, hours_before)
        except Exception as e:
            print(f"Failed to send {hours_before}h reminder for booking {booking_id}: {e}")


# ─────────────── Cleanup old bookings ─────────────── #
@shared_task(bind=True)
def cleanup_old_bookings(self):
    return run_async(_cleanup_old_bookings())


async def _cleanup_old_bookings():
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
        
        updated_count = 0
        for booking in bookings:
            try:
                booking.status = BookingStatus.CANCELLED
                booking.cancellation_reason = "Not confirmed within 24 hours"
                updated_count += 1
            except Exception as e:
                print(f"Failed to cancel booking {booking.id}: {e}")
        
        if updated_count > 0:
            await db.commit()
            print(f"Cancelled {updated_count} old bookings")


# Alternative approach using asyncio.run (Python 3.7+)
def run_async_alternative(coro):
    """
    Alternative helper using asyncio.run (cleaner but requires Python 3.7+)
    """
    return asyncio.run(coro)


# ─────────────── Alternative task implementations ─────────────── #
@shared_task(bind=True, name="check_and_send_reminders_v2")
def check_and_send_reminders_v2(self):
    """Alternative implementation using asyncio.run"""
    return asyncio.run(_check_and_send_reminders())


@shared_task(bind=True, name="send_reminder_v2")
def send_reminder_v2(self, booking_id: str, hours_before: int):
    """Alternative implementation using asyncio.run"""
    return asyncio.run(_send_reminder(booking_id, hours_before))


@shared_task(bind=True, name="cleanup_old_bookings_v2")
def cleanup_old_bookings_v2(self):
    """Alternative implementation using asyncio.run"""
    return asyncio.run(_cleanup_old_bookings())