from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date
import datetime
from uuid import UUID
from sqlalchemy import select, and_

from app.database import get_db
from app.schemas.master import MasterCreate, MasterUpdate, MasterResponse
from app.services.master import MasterService
from app.services.notification import NotificationService
from app.utils.security import get_current_user, require_role, get_current_tenant
from app.models.user import UserRole
from app.utils.email import EmailService
from app.models.master import Master
from app.models.booking import Booking

router = APIRouter()

@router.post("/", response_model=MasterResponse)
async def create_master(
    master_data: dict,  # Принимаем dict вместо MasterCreate для гибкости
    background_tasks: BackgroundTasks,
    current_user = Depends(require_role(UserRole.OWNER)),
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
        
        # Если был создан новый пользователь, отправляем email с инструкциями
        if 'user_email' in master_data:
            background_tasks.add_task(
                email_service.send_master_welcome_email,
                master_data['user_email'],
                master_data.get('user_first_name', ''),
                current_user.tenant.name if hasattr(current_user, 'tenant') else 'Jazyl'
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
    tenant_id: UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Get all masters for tenant"""
    service = MasterService(db)
    
    masters = await service.get_masters(
        tenant_id=tenant_id,
        is_active=is_active
    )
    
    return masters

@router.get("/{master_id}", response_model=MasterResponse)
async def get_master(
    master_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get master by ID"""
    service = MasterService(db)
    master = await service.get_master(master_id)
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master not found"
        )
    
    return master

@router.put("/{master_id}", response_model=MasterResponse)
async def update_master(
    master_id: UUID,
    master_data: MasterUpdate,
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Update master"""
    service = MasterService(db)
    
    # Masters can only update their own profile
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
    current_user = Depends(require_role(UserRole.OWNER)),
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
    db: AsyncSession = Depends(get_db)
):
    """Get master's schedule"""
    service = MasterService(db)
    
    schedule = await service.get_schedule(
        master_id,
        date_from,
        date_to
    )
    
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

@router.get("/{master_id}/services")
async def get_master_services(
    master_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get services provided by master"""
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

# Добавьте эти endpoints в существующий файл

@router.get("/my-profile", response_model=MasterResponse)
async def get_my_profile(
    current_user = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    """Get current master's profile"""
    service = MasterService(db)
    
    # Найти профиль мастера по user_id
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
    current_user = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    """Get master's bookings for today"""
    # Найти профиль мастера
    result = await db.execute(
        select(Master).where(Master.user_id == current_user.id)
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master profile not found"
        )
    
    # Получить сегодняшние записи
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
    
    # Форматировать данные
    return [
        {
            "id": str(booking.id),
            "time": booking.date.strftime("%H:%M"),
            "client_name": "Client",  # Получить из связи
            "service_name": "Service",  # Получить из связи
            "price": booking.price,
            "status": booking.status.value
        }
        for booking in bookings
    ]

@router.get("/my-stats")
async def get_my_stats(
    current_user = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    """Get master's statistics"""
    # Найти профиль мастера
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
    
    # Здесь добавить реальные подсчеты
    return {
        "weekBookings": 15,
        "totalClients": 45,
        "monthRevenue": 2500
    }