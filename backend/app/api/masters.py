from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime

from app.schemas.user import UserCreate
from app.services.auth import AuthService
import secrets
import string

from app.database import get_db
from app.models.user import User, UserRole
from app.models.master import Master, MasterSchedule
from app.schemas.master import MasterUpdate, MasterResponse, MasterPermissionsUpdate, MasterCreate
from app.models.permission_request import PermissionRequestType
from app.services.master import MasterService
from app.services.file_upload import FileUploadService
from app.services.permission_request import PermissionRequestService
from app.utils.security import get_current_master, get_current_user, require_role, get_current_tenant

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

# ---------------------- PUBLIC ENDPOINTS для клиентов ----------------------
@router.get("", response_model=List[MasterResponse])  # БЕЗ слеша
@router.get("/", response_model=List[MasterResponse], include_in_schema=False)
async def get_masters(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Получить список мастеров для публичного доступа"""
    try:
        tenant_id = await get_current_tenant(request, db)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not specified"
        )
    
    result = await db.execute(
        select(Master).where(
            and_(
                Master.tenant_id == tenant_id,
                Master.is_active == True,
                Master.is_visible == True
            )
        )
    )
    masters = result.scalars().all()
    
    return masters

# Добавьте этот эндпоинт в ваш masters.py после существующих эндпоинтов
@router.post("", response_model=MasterResponse)
@router.post("/", response_model=MasterResponse, include_in_schema=False)
async def create_master(
    master_data: MasterCreate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Создать нового мастера (только для владельцев/админов)"""
    tenant_id = await get_current_tenant(request, db)
    
    # Проверяем что создатель из того же тенанта
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    user_id = master_data.user_id
    
    # Если user_id не указан, создаем нового пользователя
    if not user_id and master_data.user_email:
        # Проверяем что email не занят
        result = await db.execute(
            select(User).where(User.email == master_data.user_email)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Генерируем временный пароль
        temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        
        # Создаем пользователя
        auth_service = AuthService(db)
        user_data = UserCreate(
            email=master_data.user_email,
            first_name=master_data.user_first_name or "Master",
            last_name=master_data.user_last_name or "",
            phone=master_data.user_phone,
            password=temp_password,
            tenant_id=tenant_id,
            role=UserRole.MASTER
        )
        
        new_user = await auth_service.create_user(user_data)
        user_id = new_user.id
        
        # TODO: Отправить email с паролем и инструкциями по входу
        
    elif user_id:
        # Проверяем что пользователь существует и является мастером
        result = await db.execute(
            select(User).where(
                and_(
                    User.id == user_id,
                    User.tenant_id == tenant_id,
                    User.role == UserRole.MASTER
                )
            )
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Master user not found in this tenant"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either user_id or user_email must be provided"
        )
    
    # Создаем профиль мастера
    master = Master(
        tenant_id=tenant_id,
        user_id=user_id,
        display_name=master_data.display_name,
        description=master_data.description,
        photo_url=master_data.photo_url,
        specialization=master_data.specialization,
        experience_years=0,
        rating=0.0,
        reviews_count=0,
        is_active=True,
        is_visible=True,
        # Права по умолчанию
        can_edit_profile=True,
        can_edit_schedule=False,
        can_edit_services=False,
        can_manage_bookings=True,
        can_view_analytics=True,
        can_upload_photos=True
    )
    
    db.add(master)
    await db.commit()
    await db.refresh(master)
    
    # Создаем расписание если указано
    if master_data.schedules:
        for schedule_data in master_data.schedules:
            schedule = MasterSchedule(
                master_id=master.id,
                day_of_week=schedule_data.day_of_week,
                start_time=schedule_data.start_time,
                end_time=schedule_data.end_time,
                is_working=schedule_data.is_working
            )
            db.add(schedule)
        
        await db.commit()
    
    return master

@router.get("/{master_id}", response_model=MasterResponse)
async def get_master(
    master_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Получить мастера по ID для публичного доступа"""
    try:
        tenant_id = await get_current_tenant(request, db)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not specified"
        )
    
    result = await db.execute(
        select(Master).where(
            and_(
                Master.id == master_id,
                Master.tenant_id == tenant_id,
                Master.is_active == True,
                Master.is_visible == True
            )
        )
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master not found"
        )
    
    return master

# ---------------------- Endpoints for current master ----------------------
@router.get("/my-profile", response_model=MasterResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свой профиль мастера с правами доступа"""
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        # Создаем профиль мастера если его нет
        master = Master(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            display_name=f"{current_user.first_name} {current_user.last_name or ''}".strip(),
            description="",
            specialization=[],
            rating=0.0,
            reviews_count=0,
            is_active=True,
            is_visible=True,
            # Права по умолчанию для нового мастера
            can_edit_profile=True,
            can_edit_schedule=False,
            can_edit_services=False,
            can_manage_bookings=True,
            can_view_analytics=True,
            can_upload_photos=True
        )
        
        db.add(master)
        await db.commit()
        await db.refresh(master)
    
    return master

@router.put("/my-profile", response_model=MasterResponse)
async def update_my_profile(
    profile_data: MasterUpdate,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Обновить свой профиль мастера"""
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    if not master.can_edit_profile:
        raise HTTPException(
            status_code=403, 
            detail="Profile editing permission required. Contact your manager."
        )
    
    # Обновляем разрешенные поля
    update_data = profile_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(master, key):
            setattr(master, key, value)
    
    master.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(master)
    
    return master

@router.post("/upload-photo")
async def upload_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Загрузить фото мастера"""
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    if not master.can_upload_photos:
        raise HTTPException(
            status_code=403,
            detail="Photo upload permission required. Contact your manager."
        )
    
    # Загружаем файл
    upload_service = FileUploadService()
    photo_url = await upload_service.upload_master_photo(photo, master.id)
    
    # Обновляем профиль
    master.photo_url = photo_url
    master.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"photo_url": photo_url}

@router.get("/my-analytics")
async def get_my_analytics(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свою аналитику"""
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    if not master.can_view_analytics:
        raise HTTPException(
            status_code=403,
            detail="Analytics viewing permission required. Contact your manager."
        )
    
    from app.models.booking import Booking, BookingStatus
    from datetime import timedelta
    
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

# ---------------------- Permission Requests ----------------------
@router.post("/request-permission")
async def request_permission(
    permission_data: dict,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Запросить разрешение у менеджера"""
    permission_type = permission_data.get("permission_type")
    reason = permission_data.get("reason", "")
    additional_info = permission_data.get("additional_info")
    
    if not permission_type or not reason:
        raise HTTPException(
            status_code=400,
            detail="permission_type and reason are required"
        )
    
    try:
        permission_enum = PermissionRequestType(permission_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid permission type: {permission_type}"
        )
    
    # Получаем мастера
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    # Создаем запрос
    permission_service = PermissionRequestService(db)
    request = await permission_service.create_request(
        master_id=master.id,
        tenant_id=current_user.tenant_id,
        permission_type=permission_enum,
        reason=reason,
        additional_info=additional_info
    )
    
    return {
        "message": f"Permission request for '{permission_type}' has been sent to your manager",
        "request_id": str(request.id),
        "status": "pending"
    }

@router.get("/my-permission-requests")
async def get_my_permission_requests(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить мои запросы разрешений"""
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        return []
    
    permission_service = PermissionRequestService(db)
    requests = await permission_service.get_requests_for_master(master.id)
    
    return [
        {
            "id": str(req.id),
            "permission_type": req.permission_type.value,
            "reason": req.reason,
            "status": req.status.value,
            "created_at": req.created_at.isoformat(),
            "reviewed_at": req.reviewed_at.isoformat() if req.reviewed_at else None,
            "review_note": req.review_note
        }
        for req in requests
    ]

# ---------------------- Schedule management ----------------------
@router.get("/my-schedule")
async def get_my_schedule(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свое расписание"""
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    service = MasterService(db)
    schedule = await service.get_schedule(master.id)
    return schedule

@router.post("/block-time")
async def block_my_time(
    block_data: dict,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Заблокировать время"""
    result = await db.execute(select(Master).where(Master.user_id == current_user.id))
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    if not master.can_edit_schedule:
        raise HTTPException(
            status_code=403,
            detail="Schedule editing permission required. Contact your manager."
        )
    
    service = MasterService(db)
    block = await service.create_block_time(master.id, block_data)
    return block

# ---------------------- Admin endpoints for permissions ----------------------
@router.get("/permission-requests")
async def get_permission_requests(
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Получить запросы разрешений (для менеджеров)"""
    permission_service = PermissionRequestService(db)
    requests = await permission_service.get_requests_for_tenant(current_user.tenant_id)
    
    return [
        {
            "id": str(req.id),
            "master_id": str(req.master_id),
            "permission_type": req.permission_type.value,
            "reason": req.reason,
            "additional_info": req.additional_info,
            "status": req.status.value,
            "created_at": req.created_at.isoformat(),
            "reviewed_at": req.reviewed_at.isoformat() if req.reviewed_at else None,
            "review_note": req.review_note
        }
        for req in requests
    ]

@router.put("/permission-requests/{request_id}/approve")
async def approve_permission_request(
    request_id: UUID,
    review_data: dict,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Одобрить запрос разрешения"""
    permission_service = PermissionRequestService(db)
    success = await permission_service.approve_request(
        request_id=request_id,
        reviewer_id=current_user.id,
        review_note=review_data.get("review_note")
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    
    return {"message": "Permission request approved"}

@router.put("/permission-requests/{request_id}/reject")
async def reject_permission_request(
    request_id: UUID,
    review_data: dict,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Отклонить запрос разрешения"""
    permission_service = PermissionRequestService(db)
    success = await permission_service.reject_request(
        request_id=request_id,
        reviewer_id=current_user.id,
        review_note=review_data.get("review_note")
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    
    return {"message": "Permission request rejected"}

@router.put("/{master_id}/permissions")
async def update_master_permissions(
    master_id: UUID,
    permissions_data: MasterPermissionsUpdate,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Обновить права мастера (только для владельцев)"""
    result = await db.execute(select(Master).where(Master.id == master_id))
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    
    # Проверяем что мастер из того же тенанта
    if master.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Обновляем права
    update_data = permissions_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(master, key, value)
    
    master.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Permissions updated successfully"}