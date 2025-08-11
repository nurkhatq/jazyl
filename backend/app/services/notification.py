from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from app.models.notification import Notification, NotificationType, NotificationTemplate
from app.models.booking import Booking
from app.models.client import Client
from app.models.tenant import Tenant
from app.models.master import Master
from app.models.service import Service
from app.utils.email import EmailService
from app.celery_app import celery_app

class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_service = EmailService()
    
    async def send_booking_confirmation(self, booking_id: UUID) -> None:
        # Get booking details
        booking = await self._get_booking_with_details(booking_id)
        if not booking:
            return
        
        # Send email
        await self.email_service.send_booking_confirmation(
            to_email=booking['client_email'],
            client_name=booking['client_name'],
            barbershop_name=booking['barbershop_name'],
            barbershop_address=booking['barbershop_address'],
            barbershop_phone=booking['barbershop_phone'],
            master_name=booking['master_name'],
            service_name=booking['service_name'],
            booking_date=booking['booking_date'],
            booking_time=booking['booking_time'],
            price=booking['price'],
            confirmation_link=booking['confirmation_link'],
            cancellation_link=booking['cancellation_link']
        )
        
        # Create notification record
        notification = Notification(
            user_id=None,  # For client, might not have user account
            type=NotificationType.BOOKING_CONFIRMATION,
            title="Booking Confirmation",
            content=f"Your booking for {booking['service_name']} on {booking['booking_date']} at {booking['booking_time']} has been created.",
            is_sent=True,
            sent_at=datetime.utcnow(),
            metadata={"booking_id": str(booking_id)}
        )
        
        self.db.add(notification)
        await self.db.commit()
    
    async def send_booking_reminder(self, booking_id: UUID, hours_before: int = 24) -> None:
        booking = await self._get_booking_with_details(booking_id)
        if not booking:
            return
        
        # Send email
        await self.email_service.send_booking_reminder(
            to_email=booking['client_email'],
            client_name=booking['client_name'],
            barbershop_name=booking['barbershop_name'],
            master_name=booking['master_name'],
            service_name=booking['service_name'],
            booking_date=booking['booking_date'],
            booking_time=booking['booking_time'],
            hours_before=hours_before,
            cancellation_link=booking['cancellation_link']
        )
    
    async def send_booking_cancellation(self, booking_id: UUID) -> None:
        booking = await self._get_booking_with_details(booking_id)
        if not booking:
            return
        
        # Send email
        await self.email_service.send_booking_cancellation(
            to_email=booking['client_email'],
            client_name=booking['client_name'],
            barbershop_name=booking['barbershop_name'],
            service_name=booking['service_name'],
            booking_date=booking['booking_date'],
            booking_time=booking['booking_time']
        )
    
    async def schedule_reminder(self, booking_id: UUID) -> None:
        booking = await self._get_booking_with_details(booking_id)
        if not booking:
            return
        
        # Schedule reminder 24 hours before
        remind_at = booking['booking_datetime'] - timedelta(hours=24)
        if remind_at > datetime.utcnow():
            celery_app.send_task(
                'app.tasks.send_reminder',
                args=[str(booking_id), 24],
                eta=remind_at
            )
        
        # Schedule reminder 2 hours before
        remind_at = booking['booking_datetime'] - timedelta(hours=2)
        if remind_at > datetime.utcnow():
            celery_app.send_task(
                'app.tasks.send_reminder',
                args=[str(booking_id), 2],
                eta=remind_at
            )
    
    async def _get_booking_with_details(self, booking_id: UUID) -> Optional[dict]:
        # Get booking with all related data
        result = await self.db.execute(
            select(Booking)
            .where(Booking.id == booking_id)
        )
        booking = result.scalar_one_or_none()
        
        if not booking:
            return None
        
        # Get related data
        client = await self.db.get(Client, booking.client_id)
        tenant = await self.db.get(Tenant, booking.tenant_id)
        master = await self.db.get(Master, booking.master_id)
        service = await self.db.get(Service, booking.service_id)
        
        if not all([client, tenant, master, service]):
            return None
        
        return {
            'booking_id': str(booking.id),
            'booking_datetime': booking.date,
            'booking_date': booking.date.strftime('%Y-%m-%d'),
            'booking_time': booking.date.strftime('%H:%M'),
            'client_email': client.email,
            'client_name': f"{client.first_name} {client.last_name or ''}".strip(),
            'barbershop_name': tenant.name,
            'barbershop_address': tenant.address,
            'barbershop_phone': tenant.phone,
            'master_name': master.display_name,
            'service_name': service.name,
            'price': booking.price,
            'confirmation_link': f"https://{tenant.subdomain}.jazyl.tech/booking/confirm/{booking.id}?token={booking.confirmation_token}",
            'cancellation_link': f"https://{tenant.subdomain}.jazyl.tech/booking/cancel/{booking.id}?token={booking.cancellation_token}"
        }