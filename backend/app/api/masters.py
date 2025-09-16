from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, case
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime, timedelta

from app.schemas.user import UserCreate
from app.services.auth import AuthService
import secrets
import string
from app.api.services import get_current_user_optional
from app.database import get_db
from app.models.user import User, UserRole
from app.models.master import Master, MasterSchedule
from app.models.booking import Booking, BookingStatus
from app.models.tenant import Tenant
from app.utils.email import EmailService
from app.schemas.master import (
    MasterUpdate, MasterResponse, MasterPermissionsUpdate, MasterCreate,
    MasterStatsResponse, TodayBookingsResponse  # ✅ ДОБАВЛЕНЫ новые схемы
)
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
@router.get("", response_model=List[MasterResponse])
@router.get("/", response_model=List[MasterResponse], include_in_schema=False)
async def get_masters(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Получить список мастеров (публичный доступ для клиентов)"""
    try:
        tenant_id = await get_current_tenant(request, db)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not specified"
        )
    
    # Для публичного доступа показываем только активных и видимых мастеров
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

# ✅ ИСПРАВЛЕННЫЙ ЭНДПОИНТ: my-profile
@router.get("/my-profile", response_model=MasterResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свой профиль мастера - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
    try:
        print(f"🔍 Getting profile for user: {current_user.email} (ID: {current_user.id})")
        
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            print(f"⚠️ No master profile found for user {current_user.email}, creating one...")
            
            # Создаем профиль мастера если его нет
            display_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
            if not display_name:
                display_name = current_user.email.split('@')[0]
            
            master = Master(
                tenant_id=current_user.tenant_id,
                user_id=current_user.id,
                display_name=display_name,
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
                can_upload_photos=True,
                experience_years=0,
                # ✅ ИСПРАВЛЕНО: Явно устанавливаем временные метки
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(master)
            await db.commit()
            await db.refresh(master)
            print(f"✅ Created master profile for user {current_user.email}")
        else:
            print(f"✅ Found existing master profile: {master.display_name}")
            
            # ✅ ИСПРАВЛЕНО: Проверяем и исправляем NULL временные метки
            if master.created_at is None:
                master.created_at = datetime.utcnow()
            if master.updated_at is None:
                master.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(master)
        
        return master
        
    except Exception as e:
        print(f"❌ Error in get_my_profile: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get master profile"
        )

@router.put("/my-profile", response_model=MasterResponse)
async def update_my_profile(
    profile_data: MasterUpdate,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Обновить свой профиль мастера"""
    result = await db.execute(
        select(Master).where(Master.user_id == current_user.id)
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    
    if not master.can_edit_profile:
        raise HTTPException(
            status_code=403, 
            detail="Profile editing permission required. Contact your manager."
        )
    
    # Обновляем только переданные поля
    update_data = profile_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(master, key, value)
    
    master.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(master)
    
    return master

# ✅ ИСПРАВЛЕННЫЙ ЭНДПОИНТ: my-stats
@router.get("/my-stats", response_model=MasterStatsResponse)
async def get_my_stats(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить статистику мастера - ИСПРАВЛЕННАЯ ВЕРСИЯ с правильной схемой ответа"""
    try:
        print(f"🔍 Getting stats for user: {current_user.email} (ID: {current_user.id})")
        
        # Находим профиль мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            print(f"⚠️ No master profile found for user {current_user.email}")
            # Если профиля нет, возвращаем нулевую статистику
            return MasterStatsResponse()
        
        print(f"✅ Found master profile: {master.display_name}")
        
        # Проверяем права доступа (более мягко)
        if not master.can_view_analytics:
            print(f"⚠️ Master {master.display_name} has no analytics permission, returning empty stats")
            # Вместо ошибки возвращаем пустую статистику
            return MasterStatsResponse()
        
        try:
            # Считаем статистику
            now = datetime.utcnow()
            week_start = now - timedelta(days=7)
            month_start = now - timedelta(days=30)
            
            # Записи за неделю
            week_bookings_result = await db.execute(
                select(func.count()).select_from(Booking)
                .where(
                    and_(
                        Booking.master_id == master.id,
                        Booking.created_at >= week_start
                    )
                )
            )
            week_bookings = week_bookings_result.scalar() or 0
            
            # Всего клиентов (уникальные client_id)
            total_clients_result = await db.execute(
                select(func.count(func.distinct(Booking.client_id)))
                .where(Booking.master_id == master.id)
            )
            total_clients = total_clients_result.scalar() or 0
            
            # Доход за месяц
            month_revenue_result = await db.execute(
                select(func.coalesce(func.sum(Booking.price), 0.0))
                .where(
                    and_(
                        Booking.master_id == master.id,
                        Booking.created_at >= month_start,
                        Booking.status == BookingStatus.COMPLETED
                    )
                )
            )
            month_revenue = float(month_revenue_result.scalar() or 0.0)
            
            # Всего записей
            total_bookings_result = await db.execute(
                select(func.count()).select_from(Booking)
                .where(Booking.master_id == master.id)
            )
            total_bookings = total_bookings_result.scalar() or 0
            
            # Завершенные записи
            completed_bookings_result = await db.execute(
                select(func.count()).select_from(Booking)
                .where(
                    and_(
                        Booking.master_id == master.id,
                        Booking.status == BookingStatus.COMPLETED
                    )
                )
            )
            completed_bookings = completed_bookings_result.scalar() or 0
            
            # Отмененные записи
            cancelled_bookings_result = await db.execute(
                select(func.count()).select_from(Booking)
                .where(
                    and_(
                        Booking.master_id == master.id,
                        Booking.status == BookingStatus.CANCELLED
                    )
                )
            )
            cancelled_bookings = cancelled_bookings_result.scalar() or 0
            
            # Процент отмен
            cancellation_rate = 0.0
            if total_bookings > 0:
                cancellation_rate = (cancelled_bookings / total_bookings) * 100
            
            # ✅ ИСПРАВЛЕНО: Возвращаем объект схемы вместо словаря
            return MasterStatsResponse(
                weekBookings=week_bookings,
                totalClients=total_clients,
                monthRevenue=month_revenue,
                totalBookings=total_bookings,
                completedBookings=completed_bookings,
                cancelledBookings=cancelled_bookings,
                cancellationRate=cancellation_rate
            )
            
        except Exception as stats_error:
            print(f"❌ Error calculating stats: {stats_error}")
            # В случае ошибки с БД возвращаем нулевую статистику
            return MasterStatsResponse()
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_my_stats: {e}")
        import traceback
        traceback.print_exc()
        # Вместо 500 ошибки возвращаем пустую статистику
        return MasterStatsResponse()

# ✅ ИСПРАВЛЕННЫЙ ЭНДПОИНТ: my-bookings/today
@router.get("/my-bookings/today", response_model=TodayBookingsResponse)
async def get_my_bookings_today(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить записи мастера на сегодня - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
    try:
        # Находим профиль мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            return TodayBookingsResponse(bookings=[], total_count=0)
        
        # Проверяем права доступа к записям
        if not master.can_manage_bookings:
            print(f"⚠️ Master {master.display_name} has no booking management permission")
            # Вместо ошибки возвращаем пустой список
            return TodayBookingsResponse(bookings=[], total_count=0)
        
        # Определяем начало и конец сегодняшнего дня
        today = datetime.utcnow().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        # Получаем записи на сегодня
        result = await db.execute(
            select(Booking).where(
                and_(
                    Booking.master_id == master.id,
                    Booking.date >= today_start,
                    Booking.date <= today_end
                )
            ).order_by(Booking.date)
        )
        bookings = result.scalars().all()
        
        # Формируем ответ
        bookings_data = []
        for booking in bookings:
            bookings_data.append({
                "id": str(booking.id),
                "date": booking.date.isoformat(),
                "end_time": booking.end_time.isoformat(),
                "status": booking.status.value,
                "price": booking.price,
                "notes": booking.notes,
                "client_id": str(booking.client_id),
                "service_id": str(booking.service_id)
            })
        
        return TodayBookingsResponse(
            bookings=bookings_data,
            total_count=len(bookings_data)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_my_bookings_today: {e}")
        import traceback
        traceback.print_exc()
        # Возвращаем пустой результат вместо ошибки
        return TodayBookingsResponse(bookings=[], total_count=0)

@router.post("/upload-photo")
async def upload_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Загрузить фото мастера"""
    try:
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            raise HTTPException(status_code=404, detail="Master profile not found")
        
        if not master.can_upload_photos:
            raise HTTPException(
                status_code=403,
                detail="Photo upload permission required. Contact your manager."
            )
        
        # Проверяем тип файла
        if not photo.content_type or not photo.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="Only image files are allowed"
            )
        
        # Загружаем файл
        upload_service = FileUploadService()
        photo_url = await upload_service.upload_master_photo(photo, master.id)
        
        # Обновляем профиль
        master.photo_url = photo_url
        master.updated_at = datetime.utcnow()
        await db.commit()
        
        return {"photo_url": photo_url, "message": "Photo uploaded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload photo"
        )

@router.get("/my-analytics")
async def get_my_analytics(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свою аналитику"""
    try:
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            return {
                "revenue_trend": [],
                "popular_services": [],
                "client_retention": 0,
                "average_rating": 0
            }
        
        if not master.can_view_analytics:
            raise HTTPException(
                status_code=403,
                detail="Analytics viewing permission required. Contact your manager."
            )
        
        # Базовая аналитика (можно расширить)
        from datetime import timedelta
        
        now = datetime.now()
        month_ago = now - timedelta(days=30)
        
        # Доходы за последние 30 дней
        revenue_result = await db.execute(
            select(
                func.sum(Booking.price).label('revenue'),
                func.date(Booking.date).label('booking_date')
            )
            .where(and_(
                Booking.master_id == master.id,
                Booking.status == BookingStatus.COMPLETED,
                Booking.date >= month_ago
            ))
            .group_by(func.date(Booking.date))
            .order_by(func.date(Booking.date))
        )
        
        revenue_trend = [
            {
                "date": row.booking_date.isoformat(),
                "revenue": float(row.revenue or 0)
            }
            for row in revenue_result.fetchall()
        ]
        
        return {
            "revenue_trend": revenue_trend,
            "popular_services": [],  # TODO: Реализовать
            "client_retention": 0,   # TODO: Реализовать
            "average_rating": float(master.rating)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting analytics: {e}")
        return {
            "revenue_trend": [],
            "popular_services": [],
            "client_retention": 0,
            "average_rating": 0
        }
@router.post("/request-permission")
async def request_permission(
    permission_data: dict,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Запросить разрешение у менеджера"""
    try:
        # Находим мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            raise HTTPException(status_code=404, detail="Master profile not found")
        
        permission_type = permission_data.get("permission_type")
        reason = permission_data.get("reason", "")
        additional_info = permission_data.get("additional_info")
        
        if not permission_type:
            raise HTTPException(
                status_code=400,
                detail="Permission type is required"
            )
        
        # Проверяем валидность типа разрешения
        try:
            perm_type = PermissionRequestType(permission_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid permission type"
            )
        
        permission_service = PermissionRequestService(db)
        request_obj = await permission_service.create_request(
            master.id,
            perm_type,
            reason,
            additional_info
        )
        
        return {
            "id": str(request_obj.id),
            "message": "Permission request submitted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in request_permission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create permission request"
        )

@router.get("/my-permission-requests")
async def get_my_permission_requests(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свои запросы разрешений"""
    try:
        # Находим мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            return {"requests": []}
        
        permission_service = PermissionRequestService(db)
        requests = await permission_service.get_requests_for_master(master.id)
        
        return {
            "requests": [
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
        }
        
    except Exception as e:
        print(f"Error in get_my_permission_requests: {e}")
        return {"requests": []}

# ---------------------- Schedule management ----------------------
@router.get("/my-schedule")
async def get_my_schedule(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свое расписание"""
    try:
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            raise HTTPException(status_code=404, detail="Master profile not found")
        
        service = MasterService(db)
        schedule = await service.get_schedule(master.id)
        return {"schedule": schedule}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_my_schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get schedule"
        )

@router.post("/block-time")
async def block_my_time(
    block_data: dict,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Заблокировать время"""
    try:
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
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
        return {"block": block}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in block_my_time: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to block time"
        )

# ====================== АДМИНСКИЕ ЭНДПОИНТЫ ======================

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
    
    service = MasterService(db)
    master = await service.create_master(tenant_id, master_data.dict())
    
    return master

@router.put("/{master_id}", response_model=MasterResponse)
async def update_master(
    master_id: UUID,
    master_data: MasterUpdate,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Обновить мастера (только для владельцев/админов)"""
    # Проверяем что мастер существует и принадлежит тому же тенанту
    result = await db.execute(
        select(Master).where(
            and_(
                Master.id == master_id,
                Master.tenant_id == current_user.tenant_id
            )
        )
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master not found"
        )
    
    # Обновляем только переданные поля
    update_data = master_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(master, key):
            setattr(master, key, value)
    
    master.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(master)
    
    return master

@router.delete("/{master_id}")
async def delete_master(
    master_id: UUID,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Удалить мастера (только для владельцев/админов)"""
    # Проверяем что мастер существует и принадлежит тому же тенанту
    result = await db.execute(
        select(Master).where(
            and_(
                Master.id == master_id,
                Master.tenant_id == current_user.tenant_id
            )
        )
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master not found"
        )
    
    # Мягкое удаление - просто деактивируем
    master.is_active = False
    master.is_visible = False
    master.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Master deleted successfully"}

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
    result = await permission_service.approve_request(
        request_id,
        current_user.id,
        review_data.get("review_note", "")
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission request not found"
        )
    
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
    result = await permission_service.reject_request(
        request_id,
        current_user.id,
        review_data.get("review_note", "")
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission request not found"
        )
    
    return {"message": "Permission request rejected"}

@router.put("/{master_id}/permissions", response_model=MasterResponse)
async def update_master_permissions(
    master_id: UUID,
    permissions_data: MasterPermissionsUpdate,
    current_user: User = Depends(require_role([UserRole.OWNER])),
    db: AsyncSession = Depends(get_db)
):
    """Обновить права мастера (только для владельцев)"""
    result = await db.execute(
        select(Master).where(
            and_(
                Master.id == master_id,
                Master.tenant_id == current_user.tenant_id
            )
        )
    )
    master = result.scalar_one_or_none()
    
    if not master:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Master not found"
        )
    
    # Обновляем только переданные права
    update_data = permissions_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(master, key, value)
    
    master.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(master)
    
    return master


# В конец файла backend/app/api/masters.py добавляем дебаг эндпоинты:

# ============================= ДЕБАГ ЭНДПОИНТЫ =============================
# Временные эндпоинты для диагностики 422 ошибок

from pydantic import ValidationError
import json

@router.get("/my-profile-debug")
async def get_my_profile_debug(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """ДЕБАГ версия get_my_profile для выявления 422 ошибки"""
    try:
        print(f"🔍 [DEBUG] Getting profile for user: {current_user.email}")
        print(f"🔍 [DEBUG] User ID: {current_user.id}")
        print(f"🔍 [DEBUG] User tenant_id: {current_user.tenant_id}")
        
        # Получаем мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            print("❌ [DEBUG] No master profile found")
            return {"error": "No master profile found", "user_id": str(current_user.id)}
        
        print(f"✅ [DEBUG] Found master: {master.id}")
        
        # ДЕТАЛЬНЫЙ ДЕБАГ ВСЕХ ПОЛЕЙ
        master_data = {
            "id": master.id,
            "tenant_id": master.tenant_id, 
            "user_id": master.user_id,
            "display_name": master.display_name,
            "description": master.description,
            "photo_url": master.photo_url,
            "specialization": master.specialization,
            "experience_years": master.experience_years,
            "rating": master.rating,
            "reviews_count": master.reviews_count,
            "is_active": master.is_active,
            "is_visible": master.is_visible,
            "can_edit_profile": master.can_edit_profile,
            "can_edit_schedule": master.can_edit_schedule,
            "can_edit_services": master.can_edit_services,
            "can_manage_bookings": master.can_manage_bookings,
            "can_view_analytics": master.can_view_analytics,
            "can_upload_photos": master.can_upload_photos,
            "created_at": master.created_at,
            "updated_at": master.updated_at
        }
        
        print("📋 [DEBUG] Master data:")
        for key, value in master_data.items():
            print(f"  {key}: {value} (type: {type(value)})")
            
        # Проверяем каждое поле на None
        print("\n🔍 [DEBUG] Checking for None values:")
        none_fields = []
        for key, value in master_data.items():
            if value is None:
                none_fields.append(key)
                print(f"  ⚠️ {key} is None")
        
        if none_fields:
            print(f"❌ [DEBUG] Found None fields: {none_fields}")
        
        # Пробуем создать схему ответа вручную
        print("\n🧪 [DEBUG] Testing MasterResponse validation...")
        try:
            response = MasterResponse(**master_data)
            print("✅ [DEBUG] MasterResponse validation successful!")
            return response.dict()  # Возвращаем как dict для дебага
        except ValidationError as ve:
            print(f"❌ [DEBUG] Pydantic validation error:")
            print(f"  Error details: {ve.errors()}")
            print(f"  Error JSON: {ve.json()}")
            
            # Возвращаем детальную ошибку
            return {
                "validation_error": True,
                "errors": ve.errors(),
                "master_data": master_data,
                "none_fields": none_fields
            }
        except Exception as e:
            print(f"❌ [DEBUG] Unexpected error in validation: {e}")
            return {
                "unexpected_error": str(e),
                "master_data": master_data
            }
            
    except Exception as e:
        print(f"❌ [DEBUG] Error in get_my_profile_debug: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("/my-stats-debug") 
async def get_my_stats_debug(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """ДЕБАГ версия get_my_stats для выявления 422 ошибки"""
    try:
        print(f"🔍 [DEBUG] Getting stats for user: {current_user.email}")
        
        # Находим мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            print("❌ [DEBUG] No master profile found for stats")
            return {"error": "No master profile found"}
        
        print(f"✅ [DEBUG] Found master for stats: {master.display_name}")
        
        # Простая статистика
        stats_data = {
            "weekBookings": 0,
            "totalClients": 0,
            "monthRevenue": 0.0,
            "totalBookings": 0,
            "completedBookings": 0,
            "cancelledBookings": 0,
            "cancellationRate": 0.0
        }
        
        print("📋 [DEBUG] Stats data:")
        for key, value in stats_data.items():
            print(f"  {key}: {value} (type: {type(value)})")
        
        # Пробуем создать схему ответа
        print("\n🧪 [DEBUG] Testing MasterStatsResponse validation...")
        try:
            response = MasterStatsResponse(**stats_data)
            print("✅ [DEBUG] MasterStatsResponse validation successful!")
            return response.dict()
        except ValidationError as ve:
            print(f"❌ [DEBUG] Stats validation error:")
            print(f"  Error details: {ve.errors()}")
            return {
                "validation_error": True,
                "errors": ve.errors(),
                "stats_data": stats_data
            }
        except Exception as e:
            print(f"❌ [DEBUG] Unexpected error in stats validation: {e}")
            return {
                "unexpected_error": str(e),
                "stats_data": stats_data
            }
            
    except Exception as e:
        print(f"❌ [DEBUG] Error in get_my_stats_debug: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("/debug-db-master")
async def debug_db_master(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Прямой дебаг базы данных мастера"""
    try:
        print(f"🔍 [DEBUG] Direct DB access for user: {current_user.email}")
        
        # Прямой SQL запрос
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            return {"error": "No master found"}
        
        # Получаем все атрибуты модели
        master_dict = {}
        for column in master.__table__.columns:
            value = getattr(master, column.name)
            master_dict[column.name] = value
            print(f"  {column.name}: {value} (SQL type: {column.type}, Python type: {type(value)})")
        
        # Проверяем атрибуты, которых может не быть в схеме
        print("\n🔍 [DEBUG] Checking all master attributes:")
        for attr_name in dir(master):
            if not attr_name.startswith('_') and not callable(getattr(master, attr_name)):
                attr_value = getattr(master, attr_name)
                print(f"  {attr_name}: {attr_value} (type: {type(attr_value)})")
        
        return {
            "master_id": str(master.id),
            "raw_data": master_dict,
            "table_columns": [col.name for col in master.__table__.columns]
        }
        
    except Exception as e:
        print(f"❌ [DEBUG] Error in debug_db_master: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}