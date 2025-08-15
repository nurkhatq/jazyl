from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from app.database import get_db
from app.schemas.master import MasterCreate, MasterUpdate, MasterResponse
from app.services.master import MasterService
from app.services.notification import NotificationService
from app.utils.security import get_current_user, require_role, get_current_tenant
from app.models.user import UserRole, User
from app.models.master import Master
from app.models.booking import Booking, BookingStatus
from app.utils.email import EmailService

router = APIRouter()

async def get_current_user_optional(request: Request):
    """
    Возвращает текущего пользователя или None для поддомена (барбершопа).
    """
    subdomain = request.headers.get("x-subdomain")
    if subdomain:
        return None  # Клиент поддомена — без авторизации
    return await get_current_user(request)


@router.post("/", response_model=MasterResponse)
async def create_master(
    master_data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Create new master"""
    service = MasterService(db)
    email_service = EmailService()
    
    try:
        master = await service.create_master(
            current_user.tenant_id,
            master_data
        )

        # 🔹 Подгружаем schedules
        stmt = (
            select(Master)
            .options(selectinload(Master.schedules))
            .where(Master.id == master.id)
        )
        result = await db.execute(stmt)
        master = result.scalar_one()

        if 'user_email' in master_data:
            background_tasks.add_task(
                email_service.send_master_welcome_email,
                master_data['user_email'],
                master_data.get('user_first_name', ''),
                'Jazyl Barbershop'
            )
        
        return master
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=List[MasterResponse])
async def get_masters(
    is_active: Optional[bool] = Query(True),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    tenant_id = getattr(current_user, "tenant_id", None)
    stmt = select(Master).options(selectinload(Master.schedules))
    if tenant_id:
        stmt = stmt.where(Master.tenant_id == tenant_id)
    if is_active is not None:
        stmt = stmt.where(Master.is_active == is_active)
    
    result = await db.execute(stmt)
    return result.scalars().all()


# --- Получение конкретного мастера (публично) ---
@router.get("/{master_id}", response_model=MasterResponse)
async def get_master(
    master_id: UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Master).options(selectinload(Master.schedules)).where(Master.id == master_id)
    result = await db.execute(stmt)
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master not found")
    return master

@router.put("/{master_id}", response_model=MasterResponse)
async def update_master(
    master_id: UUID,
    master_data: MasterUpdate,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Update master"""
    service = MasterService(db)
    
    if current_user.role == UserRole.MASTER:
        master = await service.get_master(master_id)
        if master.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this master"
            )
    
    master = await service.update_master(master_id, master_data)
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master not found"
        )
    
    return master

@router.delete("/{master_id}")
async def delete_master(
    master_id: UUID,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Delete master (soft delete)"""
    service = MasterService(db)
    
    await service.delete_master(master_id)
    
    return {"message": "Master deleted successfully"}

@router.get("/{master_id}/schedule")
async def get_master_schedule(
    master_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = MasterService(db)
    schedule = await service.get_schedule(master_id, date_from, date_to)
    return schedule

@router.put("/{master_id}/schedule")
async def update_master_schedule(
    master_id: UUID,
    schedule_data: List[dict],
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Update master's schedule"""
    service = MasterService(db)
    
    # Masters can only update their own schedule
    if current_user.role == UserRole.MASTER:
        master = await service.get_master(master_id)
        if master.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this schedule"
            )
    
    await service.update_schedule(master_id, schedule_data)
    
    return {"message": "Schedule updated successfully"}

@router.post("/{master_id}/block-time")
async def create_block_time(
    master_id: UUID,
    block_data: dict,
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Block time for master"""
    service = MasterService(db)
    
    # Masters can only block their own time
    if current_user.role == UserRole.MASTER:
        master = await service.get_master(master_id)
        if master.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to block time for this master"
            )
    
    block = await service.create_block_time(master_id, block_data)
    
    return block

# --- Сервисы мастера (публично) ---
@router.get("/{master_id}/services")
async def get_master_services(
    master_id: UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = MasterService(db)
    services = await service.get_master_services(master_id)
    return services

@router.put("/{master_id}/services")
async def update_master_services(
    master_id: UUID,
    service_ids: List[UUID],
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Update services provided by master"""
    service = MasterService(db)
    
    await service.update_master_services(master_id, service_ids)
    
    return {"message": "Services updated successfully"}

@router.get("/my-profile", response_model=MasterResponse)
async def get_my_profile(
    current_user: User = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    """Get current master's profile"""
    result = await db.execute(
        select(Master).where(Master.user_id == current_user.id)
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master profile not found"
        )
    
    return master

@router.get("/my-bookings/today")
async def get_my_bookings_today(
    current_user: User = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    """Get master's bookings for today"""
    result = await db.execute(
        select(Master).where(Master.user_id == current_user.id)
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master profile not found"
        )
    
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())
    
    bookings_result = await db.execute(
        select(Booking)
        .where(
            and_(
                Booking.master_id == master.id,
                Booking.date >= today_start,
                Booking.date <= today_end
            )
        )
        .order_by(Booking.date)
    )
    bookings = bookings_result.scalars().all()
    
    return [
        {
            "id": str(booking.id),
            "time": booking.date.strftime("%H:%M"),
            "client_name": "Client",
            "service_name": "Service",
            "price": booking.price,
            "status": booking.status.value
        }
        for booking in bookings
    ]

@router.get("/my-stats")
async def get_my_stats(
    current_user: User = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    """Get master's statistics"""
    result = await db.execute(
        select(Master).where(Master.user_id == current_user.id)
    )
    master = result.scalar_one_or_none()
    
    if not master:
        return {
            "weekBookings": 0,
            "totalClients": 0,
            "monthRevenue": 0
        }
    
    return {
        "weekBookings": 15,
        "totalClients": 45,
        "monthRevenue": 2500
    }