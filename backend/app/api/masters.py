from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime

from app.database import get_db
from app.models.user import User, UserRole
from app.models.master import Master
from app.models.booking import Booking
from app.schemas.master import MasterCreate, MasterUpdate, MasterResponse
from app.services.master import MasterService
from app.utils.security import get_current_user, require_role
from app.utils.email import EmailService

router = APIRouter()
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


# --- CRUD Masters ---
@router.post("/", response_model=MasterResponse)
async def create_master(
    master_data: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    service = MasterService(db)
    email_service = EmailService()

    master = await service.create_master(current_user.tenant_id, master_data)

    # Подгружаем расписание
    stmt = select(Master).options(selectinload(Master.schedules)).where(Master.id == master.id)
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

@router.get("/", response_model=List[MasterResponse])
async def get_masters(
    request: Request,
    is_active: Optional[bool] = Query(True),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список мастеров
    - Для авторизованных пользователей: мастера их tenant_id
    - Для публичного доступа: используется X-Tenant-ID из заголовка
    """
    # Определяем tenant_id
    tenant_id = None
    
    if current_user:
        # Авторизованный пользователь - используем его tenant_id
        tenant_id = current_user.tenant_id
    else:
        # Публичный доступ - берем из заголовка
        tenant_id = await get_tenant_id_from_header(request)
    
    if not tenant_id:
        # Если нет tenant_id, возвращаем пустой список
        return []
    
    # Запрос мастеров для конкретного tenant
    stmt = select(Master).options(selectinload(Master.schedules))
    stmt = stmt.where(Master.tenant_id == tenant_id)
    
    if is_active is not None:
        stmt = stmt.where(Master.is_active == is_active)
    
    result = await db.execute(stmt)
    return result.scalars().all()

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
    service = MasterService(db)

    if current_user.role == UserRole.MASTER:
        master = await service.get_master(master_id)
        if master.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this master")
    
    master = await service.update_master(master_id, master_data)
    if not master:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master not found")
    return master

@router.delete("/{master_id}")
async def delete_master(
    master_id: UUID,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    service = MasterService(db)
    await service.delete_master(master_id)
    return {"message": "Master deleted successfully"}

# --- Schedule ---
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
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    service = MasterService(db)
    if current_user.role == UserRole.MASTER:
        master = await service.get_master(master_id)
        if master.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this schedule")
    await service.update_schedule(master_id, schedule_data)
    return {"message": "Schedule updated successfully"}

@router.post("/{master_id}/block-time")
async def create_block_time(
    master_id: UUID,
    block_data: dict,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    service = MasterService(db)
    if current_user.role == UserRole.MASTER:
        master = await service.get_master(master_id)
        if master.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to block time for this master")
    block = await service.create_block_time(master_id, block_data)
    return block

# --- Master services ---
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
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    service = MasterService(db)
    await service.update_master_services(master_id, service_ids)
    return {"message": "Services updated successfully"}

# --- Current master endpoints ---
@router.get("/my-profile", response_model=MasterResponse)
async def get_my_profile(
    current_user: User = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master profile not found")
    return master

@router.get("/my-bookings/today")
async def get_my_bookings_today(
    current_user: User = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master profile not found")

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    bookings_result = await db.execute(
        select(Booking)
        .where(and_(Booking.master_id == master.id, Booking.date >= today_start, Booking.date <= today_end))
        .order_by(Booking.date)
    )
    bookings = bookings_result.scalars().all()

    return [
        {
            "id": str(b.id),
            "time": b.date.strftime("%H:%M"),
            "client_name": "Client",
            "service_name": "Service",
            "price": b.price,
            "status": b.status.value
        }
        for b in bookings
    ]

@router.get("/my-stats")
async def get_my_stats(
    current_user: User = Depends(require_role(UserRole.MASTER)),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    if not master:
        return {"weekBookings": 0, "totalClients": 0, "monthRevenue": 0}

    return {"weekBookings": 15, "totalClients": 45, "monthRevenue": 2500}
