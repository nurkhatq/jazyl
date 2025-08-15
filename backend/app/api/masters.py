from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime, timedelta

from app.database import get_db
from app.models.user import User, UserRole
from app.models.master import Master
from app.models.booking import Booking, BookingStatus
from app.models.client import Client
from app.models.service import Service
from app.schemas.master import MasterUpdate, MasterResponse
from app.services.master import MasterService
from app.utils.security import get_current_master, get_current_user, require_role
from app.utils.email import EmailService

router = APIRouter()

# ---------------------- Utility functions ----------------------
async def get_tenant_id_from_header(request: Request) -> Optional[UUID]:
    tenant_id_str = request.headers.get("X-Tenant-ID")
    if tenant_id_str:
        try:
            return UUID(tenant_id_str)
        except ValueError:
            return None
    return None

async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    from app.utils.security import get_current_user_from_token
    try:
        return await get_current_user_from_token(token=token, db=db)
    except:
        return None

# ---------------------- Endpoints for current master ----------------------
@router.get("/my-profile")
async def get_my_profile(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        master = Master(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            display_name=f"{current_user.first_name} {current_user.last_name or ''}".strip(),
            description="",
            specialization=[],
            rating=0.0,
            reviews_count=0,
            is_active=True,
            is_visible=True
        )
        db.add(master)
        await db.commit()
        await db.refresh(master)
    
    return {
        "id": str(master.id),
        "tenant_id": str(master.tenant_id),
        "user_id": str(master.user_id),
        "display_name": master.display_name or "Unknown",
        "description": master.description or "",
        "photo_url": master.photo_url or None,
        "specialization": master.specialization or [],
        "rating": float(master.rating or 0),
        "reviews_count": int(master.reviews_count or 0),
        "is_active": bool(master.is_active),
        "is_visible": bool(master.is_visible),
        "created_at": master.created_at.isoformat() if master.created_at else datetime.utcnow().isoformat(),
        "updated_at": master.updated_at.isoformat() if master.updated_at else datetime.utcnow().isoformat(),
    }

@router.get("/my-bookings/today")
async def get_my_bookings_today(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        return []

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    bookings_result = await db.execute(
        select(Booking, Client, Service)
        .outerjoin(Client, Booking.client_id == Client.id)
        .outerjoin(Service, Booking.service_id == Service.id)
        .where(and_(
            Booking.master_id == master.id,
            Booking.date >= today_start,
            Booking.date <= today_end
        ))
        .order_by(Booking.date)
    )

    return [
        {
            "id": str(booking.id),
            "time": booking.date.strftime("%H:%M") if booking.date else "00:00",
            "client_name": f"{client.first_name} {client.last_name or ''}".strip() if client else "Guest",
            "client_phone": client.phone if client else "",
            "service_name": service.name if service else "Service",
            "price": float(booking.price or 0),
            "status": booking.status.value if booking.status else "pending"
        }
        for booking, client, service in bookings_result.all()
    ]

@router.get("/my-stats")
async def get_my_stats(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        return {"weekBookings": 0, "totalClients": 0, "monthRevenue": 0}
    
    week_ago = datetime.now() - timedelta(days=7)
    week_bookings = await db.scalar(
        select(func.count(Booking.id))
        .where(and_(
            Booking.master_id == master.id,
            Booking.date >= week_ago,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
        ))
    ) or 0
    
    total_clients = await db.scalar(
        select(func.count(func.distinct(Booking.client_id)))
        .where(and_(
            Booking.master_id == master.id,
            Booking.status == BookingStatus.COMPLETED
        ))
    ) or 0
    
    month_ago = datetime.now() - timedelta(days=30)
    month_revenue = await db.scalar(
        select(func.coalesce(func.sum(Booking.price), 0))
        .where(and_(
            Booking.master_id == master.id,
            Booking.date >= month_ago,
            Booking.status == BookingStatus.COMPLETED
        ))
    ) or 0

    return {
        "weekBookings": int(week_bookings),
        "totalClients": int(total_clients),
        "monthRevenue": float(month_revenue)
    }

# ---------------------- CRUD and other master_id routes ----------------------
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
    tenant_id = current_user.tenant_id if current_user else await get_tenant_id_from_header(request)
    if not tenant_id:
        return []
    stmt = select(Master).options(selectinload(Master.schedules)).where(Master.tenant_id == tenant_id)
    if is_active is not None:
        stmt = stmt.where(Master.is_active == is_active)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{master_id}/full", response_model=MasterResponse)
async def get_master_full(
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
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
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

# ---------------------- Schedule routes ----------------------
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
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    await service.update_schedule(master_id, schedule_data)
    return {"message": "Schedule updated successfully"}

# ---------------------- Block-time route ----------------------
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
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    block = await service.create_block_time(master_id, block_data)
    return block

# ---------------------- Services routes ----------------------
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
