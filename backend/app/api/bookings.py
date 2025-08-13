from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID

from app.database import get_db
from app.schemas.booking import BookingCreate, BookingUpdate, BookingResponse
from app.models.user import User
from app.services.booking import BookingService
from app.services.notification import NotificationService
from app.utils.security import get_current_user, get_current_tenant
from app.models.booking import BookingStatus

router = APIRouter()

@router.post("/", response_model=BookingResponse)
async def create_booking(
    booking_data: BookingCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create new booking"""
    service = BookingService(db)
    notification_service = NotificationService(db)
    
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not specified"
        )
    
    # Check availability
    if not await service.check_availability(
        tenant_id,
        booking_data.master_id,
        booking_data.date,
        booking_data.service_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Time slot not available"
        )
    
    # Create booking
    booking = await service.create_booking(tenant_id, booking_data)
    
    # Send confirmation email in background
    background_tasks.add_task(
        notification_service.send_booking_confirmation,
        booking.id
    )
    
    return booking

@router.get("/", response_model=List[BookingResponse])
async def get_bookings(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    master_id: Optional[UUID] = Query(None),
    status: Optional[BookingStatus] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get bookings with filters"""
    service = BookingService(db)
    
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        return []
    
    bookings = await service.get_bookings(
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to,
        master_id=master_id,
        status=status
    )
    
    return bookings

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get booking by ID"""
    service = BookingService(db)
    booking = await service.get_booking(booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    return booking

@router.post("/{booking_id}/confirm")
async def confirm_booking(
    booking_id: UUID,
    token: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Confirm booking with token"""
    service = BookingService(db)
    notification_service = NotificationService(db)
    
    booking = await service.confirm_booking(booking_id, token)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid confirmation token"
        )
    
    # Send reminder in background
    background_tasks.add_task(
        notification_service.schedule_reminder,
        booking.id
    )
    
    return {"message": "Booking confirmed successfully"}

@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: UUID,
    token: Optional[str] = None,
    reason: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel booking"""
    service = BookingService(db)
    
    # If token provided, validate it
    if token:
        booking = await service.cancel_booking_with_token(booking_id, token, reason)
    else:
        # User must be authenticated and authorized
        booking = await service.cancel_booking(booking_id, current_user.id, reason)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel booking"
        )
    
    return {"message": "Booking cancelled successfully"}

@router.put("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: UUID,
    booking_data: BookingUpdate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update booking"""
    service = BookingService(db)
    
    booking = await service.update_booking(booking_id, booking_data, current_user.id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found or not authorized"
        )
    
    return booking

@router.get("/availability/check")
async def check_availability(
    master_id: UUID,
    date: datetime,
    service_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Check if time slot is available"""
    service = BookingService(db)
    
    available = await service.check_availability(
        tenant_id,
        master_id,
        date,
        service_id
    )
    
    return {"available": available}

@router.get("/availability/slots")
async def get_available_slots(
    master_id: UUID,
    date: date,
    service_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Get available time slots for a day"""
    service = BookingService(db)
    
    slots = await service.get_available_slots(
        tenant_id,
        master_id,
        date,
        service_id
    )
    
    return {"slots": slots}