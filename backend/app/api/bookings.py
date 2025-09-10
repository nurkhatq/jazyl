from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID

from app.database import get_db
from app.schemas.booking import BookingCreate, BookingUpdate, BookingResponse
from app.services.booking import BookingService
from app.services.notification import NotificationService
from app.utils.security import get_current_user
from app.models.booking import Booking, BookingStatus
from app.models.user import User, UserRole
from app.models.master import Master
from app.utils.security import require_role

router = APIRouter()

# --- Get tenant ID from headers for public access ---
async def get_tenant_id_from_header(request: Request) -> Optional[UUID]:
    """Получает tenant_id из заголовка X-Tenant-ID"""
    tenant_id_str = request.headers.get("X-Tenant-ID")
    if tenant_id_str:
        try:
            return UUID(tenant_id_str)
        except ValueError:
            return None
    return None

# --- Optional current user for public endpoints ---
async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Возвращает текущего пользователя или None для публичного доступа
    """
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None  # нет токена — публичный доступ

    token = auth_header.split(" ")[1]
    from app.utils.security import get_current_user_from_token
    try:
        user = await get_current_user_from_token(token=token, db=db)
        return user
    except:
        return None

# --- Public endpoint for creating bookings ---
@router.post("", response_model=BookingResponse)
@router.post("/", response_model=BookingResponse)
async def create_booking(
    booking_data: BookingCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Create new booking - публичный endpoint для клиентов"""
    service = BookingService(db)
    notification_service = NotificationService(db)
    
    # Получаем tenant_id
    if current_user:
        tenant_id = current_user.tenant_id
    else:
        tenant_id = await get_tenant_id_from_header(request)
    
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required"
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

# --- Public endpoint for checking availability ---
@router.get("/availability/check")
async def check_availability(
    master_id: UUID,
    date: datetime,
    service_id: UUID,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Check if time slot is available - публичный endpoint"""
    service = BookingService(db)
    
    # Получаем tenant_id
    if current_user:
        tenant_id = current_user.tenant_id
    else:
        tenant_id = await get_tenant_id_from_header(request)
    
    if not tenant_id:
        return {"available": False, "error": "Tenant ID is required"}
    
    available = await service.check_availability(
        tenant_id,
        master_id,
        date,
        service_id
    )
    
    return {"available": available}

# --- Public endpoint for getting available slots ---
@router.get("/availability/slots")
async def get_available_slots(
    master_id: UUID = Query(...),
    date: date = Query(...),
    service_id: UUID = Query(...),
    request: Request = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Get available time slots for a day - публичный endpoint"""
    service = BookingService(db)
    
    # Получаем tenant_id
    if current_user:
        tenant_id = current_user.tenant_id
    else:
        tenant_id = await get_tenant_id_from_header(request)
    
    if not tenant_id:
        return {"slots": [], "error": "Tenant ID is required"}
    
    slots = await service.get_available_slots(
        tenant_id,
        master_id,
        date,
        service_id
    )
    
    return {"slots": slots}

# --- Protected endpoints (требуют авторизации) ---
@router.get("", response_model=List[BookingResponse])
@router.get("/", response_model=List[BookingResponse])
async def get_bookings(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    master_id: Optional[UUID] = Query(None),
    status: Optional[BookingStatus] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get bookings with filters - требует авторизации"""
    service = BookingService(db)
    
    bookings = await service.get_bookings(
        tenant_id=current_user.tenant_id,
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

# --- Public endpoints for confirmation/cancellation with tokens ---
@router.post("/{booking_id}/confirm")
async def confirm_booking(
    booking_id: UUID,
    token: str = Query(...),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """Confirm booking with token - публичный endpoint"""
    service = BookingService(db)
    notification_service = NotificationService(db)
    
    booking = await service.confirm_booking(booking_id, token)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid confirmation token"
        )
    
    # Send reminder in background
    if background_tasks:
        background_tasks.add_task(
            notification_service.schedule_reminder,
            booking.id
        )
    
    return {"message": "Booking confirmed successfully"}

@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: UUID,
    token: Optional[str] = Query(None),
    reason: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Cancel booking - публичный с токеном или авторизованный"""
    service = BookingService(db)
    
    # If token provided, validate it (public access)
    if token:
        booking = await service.cancel_booking_with_token(booking_id, token, reason)
    elif current_user:
        # User must be authenticated and authorized
        booking = await service.cancel_booking(booking_id, current_user.id, reason)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required or cancellation token must be provided"
        )
    
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update booking - требует авторизации"""
    service = BookingService(db)
    
    booking = await service.update_booking(booking_id, booking_data, current_user.id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found or not authorized"
        )
    
    return booking

# Добавьте этот endpoint в существующий файл

@router.get("/master/stats")
async def get_master_booking_stats(
    current_user: User = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    """Get booking statistics for current master"""
    # Найти профиль мастера
    result = await db.execute(
        select(Master).where(Master.user_id == current_user.id)
    )
    master = result.scalar_one_or_none()
    
    if not master:
        return {
            "total_bookings": 0,
            "completed_bookings": 0,
            "cancelled_bookings": 0,
            "cancellation_rate": 0
        }
    
    # Получить статистику записей
    bookings_result = await db.execute(
        select(
            func.count(Booking.id).label('total'),
            func.count(case((Booking.status == BookingStatus.COMPLETED, 1))).label('completed'),
            func.count(case((Booking.status == BookingStatus.CANCELLED, 1))).label('cancelled')
        )
        .where(Booking.master_id == master.id)
    )
    
    stats = bookings_result.first()
    
    cancellation_rate = 0
    if stats.total > 0:
        cancellation_rate = (stats.cancelled / stats.total) * 100
    
    return {
        "total_bookings": stats.total,
        "completed_bookings": stats.completed,
        "cancelled_bookings": stats.cancelled,
        "cancellation_rate": round(cancellation_rate, 2)
    }