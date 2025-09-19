from fastapi import APIRouter, Depends, HTTPException, Request, status, Query, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, case, delete
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
from app.models.client import Client
from app.models.service import Service
from app.models.tenant import Tenant
from app.utils.email import EmailService
from app.schemas.master import (
    MasterUpdate, MasterResponse, MasterPermissionsUpdate, MasterCreate,
    MasterStatsResponse, TodayBookingsResponse
)
from app.models.permission_request import PermissionRequestType
from app.models.master import MasterSchedule
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

async def create_default_schedule(master_id: UUID, db: AsyncSession):
    """Создать расписание по умолчанию для мастера"""
    try:
        # Создаем расписание с понедельника по пятницу 9:00-18:00
        default_schedules = []
        for day in range(5):  # Понедельник-Пятница (0-4)
            schedule = MasterSchedule(
                master_id=master_id,
                day_of_week=day,
                start_time="09:00",
                end_time="18:00",
                is_working=True
            )
            default_schedules.append(schedule)
        
        # Суббота 10:00-16:00
        saturday_schedule = MasterSchedule(
            master_id=master_id,
            day_of_week=5,  # Суббота
            start_time="10:00",
            end_time="16:00",
            is_working=True
        )
        default_schedules.append(saturday_schedule)
        
        # Воскресенье - выходной
        sunday_schedule = MasterSchedule(
            master_id=master_id,
            day_of_week=6,  # Воскресенье
            start_time="00:00",
            end_time="00:00",
            is_working=False
        )
        default_schedules.append(sunday_schedule)
        
        # Добавляем все расписания в базу
        for schedule in default_schedules:
            db.add(schedule)
        
        await db.commit()
        print(f"✅ Created default schedule for master {master_id}")
        
    except Exception as e:
        print(f"❌ Error creating default schedule: {e}")
        # Не поднимаем исключение, чтобы не сломать создание мастера

# ====================== ⭐ ВАЖНО: СПЕЦИФИЧНЫЕ РОУТЫ ИДУТ ПЕРВЫМИ! ======================
# Все роуты с фиксированными путями должны быть ПЕРЕД параметрическими /{master_id}

# ---------------------- Endpoints for current master ----------------------
@router.get("/my-profile", response_model=MasterResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить свой профиль мастера"""
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
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(master)
            await db.commit()
            await db.refresh(master)
            
            # Создаем расписание по умолчанию
            await create_default_schedule(master.id, db)
            
            print(f"✅ Created master profile for user {current_user.email}")
        else:
            print(f"✅ Found existing master profile: {master.display_name}")
            
            # Проверяем и исправляем NULL временные метки
            if master.created_at is None:
                master.created_at = datetime.utcnow()
            if master.updated_at is None:
                master.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(master)
            
            # Проверяем есть ли расписание, если нет - создаем по умолчанию
            schedule_result = await db.execute(
                select(MasterSchedule).where(MasterSchedule.master_id == master.id)
            )
            existing_schedules = schedule_result.scalars().all()
            
            if not existing_schedules:
                print(f"⚠️ No schedule found for master {master.id}, creating default...")
                await create_default_schedule(master.id, db)
        
        return master
        
    except Exception as e:
        print(f"❌ Error in get_my_profile: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get master profile"
        )
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

@router.get("/permission-requests/stats")
async def get_permission_requests_stats(
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Получить статистику по запросам разрешений"""
    try:
        from app.models.permission_request import PermissionRequest, PermissionRequestStatus
        
        # Считаем запросы по статусам для данного тенанта
        total_result = await db.execute(
            select(func.count()).select_from(PermissionRequest)
            .where(PermissionRequest.tenant_id == current_user.tenant_id)
        )
        total = total_result.scalar() or 0
        
        pending_result = await db.execute(
            select(func.count()).select_from(PermissionRequest)
            .where(
                and_(
                    PermissionRequest.tenant_id == current_user.tenant_id,
                    PermissionRequest.status == PermissionRequestStatus.PENDING
                )
            )
        )
        pending = pending_result.scalar() or 0
        
        approved_result = await db.execute(
            select(func.count()).select_from(PermissionRequest)
            .where(
                and_(
                    PermissionRequest.tenant_id == current_user.tenant_id,
                    PermissionRequest.status == PermissionRequestStatus.APPROVED
                )
            )
        )
        approved = approved_result.scalar() or 0
        
        rejected_result = await db.execute(
            select(func.count()).select_from(PermissionRequest)
            .where(
                and_(
                    PermissionRequest.tenant_id == current_user.tenant_id,
                    PermissionRequest.status == PermissionRequestStatus.REJECTED
                )
            )
        )
        rejected = rejected_result.scalar() or 0
        
        return {
            "total": total,
            "pending": pending,
            "approved": approved,
            "rejected": rejected
        }
        
    except Exception as e:
        print(f"Error in get_permission_requests_stats: {e}")
        return {
            "total": 0,
            "pending": 0,
            "approved": 0,
            "rejected": 0
        }

@router.put("/bulk-permissions")
async def bulk_update_master_permissions(
    updates_data: dict,
    current_user: User = Depends(require_role([UserRole.OWNER])),
    db: AsyncSession = Depends(get_db)
):
    """Массовое обновление прав мастеров"""
    try:
        updates = updates_data.get("updates", [])
        updated_count = 0
        
        for update in updates:
            master_id = update.get("masterId")
            permissions = update.get("permissions", {})
            
            if not master_id:
                continue
                
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
            
            if master:
                # Обновляем только переданные права
                for key, value in permissions.items():
                    if hasattr(master, key):
                        setattr(master, key, value)
                
                master.updated_at = datetime.utcnow()
                updated_count += 1
        
        await db.commit()
        
        return {
            "message": f"Updated permissions for {updated_count} masters",
            "updated_count": updated_count
        }
        
    except Exception as e:
        print(f"Error in bulk_update_master_permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update master permissions"
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

@router.get("/my-stats", response_model=MasterStatsResponse)
async def get_my_stats(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить статистику мастера"""
    try:
        print(f"🔍 Getting stats for user: {current_user.email} (ID: {current_user.id})")
        
        # Находим профиль мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            print(f"⚠️ No master profile found for user {current_user.email}")
            return MasterStatsResponse()
        
        print(f"✅ Found master profile: {master.display_name}")
        
        # Проверяем права доступа (более мягко)
        if not master.can_view_analytics:
            print(f"⚠️ Master {master.display_name} has no analytics permission, returning empty stats")
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
            return MasterStatsResponse()
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_my_stats: {e}")
        import traceback
        traceback.print_exc()
        return MasterStatsResponse()

@router.get("/my-bookings/today", response_model=TodayBookingsResponse)
async def get_my_bookings_today(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить записи мастера на сегодня"""
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
        photo_url = await upload_service.upload_master_photo(str(master.id), photo)
        
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
            master.tenant_id,
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

@router.put("/my-schedule")
async def update_my_schedule(
    schedule_data: dict,
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Обновить расписание мастера"""
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
        
        # Получаем расписание из данных
        schedules = schedule_data.get('schedules', [])
        
        # Удаляем старое расписание
        await db.execute(
            select(MasterSchedule).where(MasterSchedule.master_id == master.id)
        )
        await db.execute(
            delete(MasterSchedule).where(MasterSchedule.master_id == master.id)
        )
        
        # Создаем новое расписание
        for schedule_item in schedules:
            schedule = MasterSchedule(
                master_id=master.id,
                day_of_week=schedule_item['day_of_week'],
                start_time=schedule_item['start_time'],
                end_time=schedule_item['end_time'],
                is_working=schedule_item.get('is_working', True)
            )
            db.add(schedule)
        
        await db.commit()
        
        return {"message": "Schedule updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in update_my_schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update schedule"
        )

# ---------------------- MASTER BOOKINGS ENDPOINT ----------------------
@router.get("/my-bookings")
async def get_my_bookings(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[BookingStatus] = Query(None),
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить записи мастера с фильтрацией по датам"""
    try:
        # Находим профиль мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            return {"bookings": [], "total_count": 0}
        
        # Проверяем права доступа к записям
        if not master.can_manage_bookings:
            return {"bookings": [], "total_count": 0}
        
        # Строим запрос
        query = select(Booking).where(Booking.master_id == master.id)
        
        # Добавляем фильтры
        if date_from:
            query = query.where(Booking.date >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.where(Booking.date <= datetime.combine(date_to, datetime.max.time()))
        if status:
            query = query.where(Booking.status == status)
        
        # Сортируем по дате
        query = query.order_by(Booking.date.desc())
        
        # Выполняем запрос
        result = await db.execute(query)
        bookings = result.scalars().all()
        
        # Формируем ответ с дополнительной информацией
        bookings_data = []
        for booking in bookings:
            # Получаем информацию о клиенте
            client_result = await db.execute(
                select(Client).where(Client.id == booking.client_id)
            )
            client = client_result.scalar_one_or_none()
            
            # Получаем информацию об услуге
            service_result = await db.execute(
                select(Service).where(Service.id == booking.service_id)
            )
            service = service_result.scalar_one_or_none()
            
            bookings_data.append({
                "id": str(booking.id),
                "date": booking.date.isoformat(),
                "end_time": booking.end_time.isoformat(),
                "status": booking.status.value,
                "price": booking.price,
                "notes": booking.notes,
                "client_id": str(booking.client_id),
                "service_id": str(booking.service_id),
                "client_name": f"{client.first_name} {client.last_name}".strip() if client else "Unknown Client",
                "client_phone": client.phone if client else None,
                "service_name": service.name if service else "Unknown Service",
                "duration": int((booking.end_time - booking.date).total_seconds() / 60),
                "created_at": booking.created_at.isoformat(),
                "updated_at": booking.updated_at.isoformat()
            })
        
        return {
            "bookings": bookings_data,
            "total_count": len(bookings_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_my_bookings: {e}")
        import traceback
        traceback.print_exc()
        return {"bookings": [], "total_count": 0}

# ---------------------- PUBLIC ENDPOINTS для клиентов ----------------------
# ⭐ ВАЖНО: Эти роуты идут ПОСЛЕ специфичных роутов для мастеров!
@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict], include_in_schema=False)
async def get_masters_list(
    request: Request,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех мастеров для администрирования"""
    tenant_id = current_user.tenant_id
    
    # Получаем мастеров с информацией о пользователях
    result = await db.execute(
        select(Master, User).join(User, Master.user_id == User.id)
        .where(Master.tenant_id == tenant_id)
        .order_by(Master.created_at.desc())
    )
    
    masters_data = []
    for master, user in result.all():
        master_dict = {
            "id": str(master.id),
            "tenant_id": str(master.tenant_id),
            "user_id": str(master.user_id),
            "display_name": master.display_name,
            "description": master.description,
            "photo_url": master.photo_url,
            "specialization": master.specialization or [],
            "experience_years": master.experience_years or 0,
            "rating": master.rating or 0.0,
            "reviews_count": master.reviews_count or 0,
            "is_active": master.is_active,
            "is_visible": master.is_visible,
            "can_edit_profile": master.can_edit_profile,
            "can_edit_schedule": master.can_edit_schedule,
            "can_edit_services": master.can_edit_services,
            "can_manage_bookings": master.can_manage_bookings,
            "can_view_analytics": master.can_view_analytics,
            "can_upload_photos": master.can_upload_photos,
            "created_at": master.created_at.isoformat() if master.created_at else None,
            "updated_at": master.updated_at.isoformat() if master.updated_at else None,
            # Добавляем информацию о пользователе
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
                "is_active": user.is_active,
                "is_verified": user.is_verified
            }
        }
        masters_data.append(master_dict)
    
    return masters_data




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


# ---------------------- Public API endpoints for barbershop pages ----------------------
# ⭐ ВАЖНО: Эти роуты должны быть В САМОМ КОНЦЕ, после всех параметрических роутов!

@router.get("/public-test")
async def get_public_masters_test(request: Request):
    """Test endpoint for public masters"""
    subdomain = request.headers.get("X-Tenant-Subdomain")
    return {"subdomain": subdomain, "message": "Test endpoint working"}

@router.get("/public/{master_id}", response_model=MasterResponse)
async def get_public_master(
    master_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get single master for public barbershop page (no auth required)"""
    try:
        # Get tenant_id from X-Tenant-Subdomain header
        subdomain = request.headers.get("X-Tenant-Subdomain")
        print(f"🔍 [PUBLIC MASTER] Subdomain: {subdomain}, Master ID: {master_id}")
        
        if not subdomain:
            print("⚠️ [PUBLIC MASTER] No subdomain provided")
            raise HTTPException(status_code=400, detail="Subdomain required")
        
        # Get tenant by subdomain
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.subdomain == subdomain)
        )
        tenant = tenant_result.scalar_one_or_none()
        
        if not tenant:
            print("⚠️ [PUBLIC MASTER] Tenant not found for subdomain:", subdomain)
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Get master by ID and tenant
        master_result = await db.execute(
            select(Master).where(
                and_(
                    Master.id == master_id,
                    Master.tenant_id == tenant.id,
                    Master.is_active == True,
                    Master.is_visible == True
                )
            )
        )
        master = master_result.scalar_one_or_none()
        
        if not master:
            print("⚠️ [PUBLIC MASTER] Master not found:", master_id)
            raise HTTPException(status_code=404, detail="Master not found")
        
        print(f"✅ [PUBLIC MASTER] Found master: {master.display_name}")
        return master
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [PUBLIC MASTER] Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/public", response_model=List[MasterResponse])
async def get_public_masters(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get masters for public barbershop page (no auth required)"""
    try:
        # Get tenant_id from X-Tenant-Subdomain header
        subdomain = request.headers.get("X-Tenant-Subdomain")
        print(f"🔍 [PUBLIC MASTERS] Subdomain: {subdomain}")
        
        if not subdomain:
            print("⚠️ [PUBLIC MASTERS] No subdomain provided")
            return []
        
        # Get tenant by subdomain
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.subdomain == subdomain)
        )
        tenant = tenant_result.scalar_one_or_none()
        
        if not tenant:
            print(f"⚠️ [PUBLIC MASTERS] No tenant found for subdomain: {subdomain}")
            return []
        
        print(f"✅ [PUBLIC MASTERS] Found tenant: {tenant.name} (ID: {tenant.id})")
        
        # Get visible masters for this tenant
        masters_result = await db.execute(
            select(Master)
            .where(and_(
                Master.tenant_id == tenant.id,
                Master.is_active == True,
                Master.is_visible == True
            ))
        )
        masters = masters_result.scalars().all()
        
        print(f"🔍 [PUBLIC MASTERS] Found {len(masters)} masters")
        
        result = []
        for master in masters:
            try:
                master_response = MasterResponse(
                    id=master.id,
                    tenant_id=master.tenant_id,
                    user_id=master.user_id,
                    display_name=master.display_name,
                    description=master.description,
                    specialization=master.specialization or [],
                    experience_years=master.experience_years or 0,
                    rating=master.rating or 0.0,
                    reviews_count=master.reviews_count or 0,
                    photo_url=master.photo_url,
                    is_active=master.is_active,
                    is_visible=master.is_visible,
                    created_at=master.created_at,
                    updated_at=master.updated_at,
                    # Public endpoints don't need permission fields
                    can_edit_profile=False,
                    can_edit_schedule=False,
                    can_edit_services=False,
                    can_manage_bookings=False,
                    can_view_analytics=False,
                    can_upload_photos=False
                )
                result.append(master_response)
            except Exception as e:
                print(f"❌ [PUBLIC MASTERS] Error creating MasterResponse for master {master.id}: {e}")
                continue
        
        print(f"✅ [PUBLIC MASTERS] Returning {len(result)} masters")
        return result
        
    except Exception as e:
        print(f"❌ [PUBLIC MASTERS] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

# ⭐ ВАЖНО: Параметрический роут /{master_id} должен быть В САМОМ КОНЦЕ!
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

# ====================== ПАРАМЕТРИЧЕСКИЕ РОУТЫ (В САМОМ КОНЦЕ!) ======================
# ⭐ ВАЖНО: Эти роуты должны быть ПОСЛЕ всех фиксированных роутов!

@router.post("/{master_id}/upload-photo")
async def upload_master_photo(
    master_id: UUID,
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Загрузить фото для конкретного мастера (только для владельцев/админов/мастеров)"""
    try:
        # Проверяем права доступа
        if current_user.role not in [UserRole.OWNER, UserRole.ADMIN, UserRole.MASTER]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Находим мастера
        result = await db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            raise HTTPException(status_code=404, detail="Master not found")
        
        # Проверяем права на загрузку фото
        if current_user.role == UserRole.MASTER:
            # Мастер может загружать фото только для своего профиля
            if master.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only upload photos for your own profile"
                )
            if not master.can_upload_photos:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Photo upload permission required. Contact your manager."
                )
        else:
            # Владельцы и админы могут загружать для любого мастера
            if master.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Проверяем тип файла
        if not photo.content_type or not photo.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="Only image files are allowed"
            )
        
        # Загружаем файл
        upload_service = FileUploadService()
        photo_url = await upload_service.upload_master_photo(str(master.id), photo)
        
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

@router.put("/{master_id}", response_model=MasterResponse)
async def update_master(
    master_id: UUID,
    master_data: MasterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить мастера (только для владельцев/админов/мастеров)"""
    try:
        # Проверяем права доступа
        if current_user.role not in [UserRole.OWNER, UserRole.ADMIN, UserRole.MASTER]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Находим мастера
        result = await db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            raise HTTPException(status_code=404, detail="Master not found")
        
        # Проверяем права на редактирование
        if current_user.role == UserRole.MASTER:
            # Мастер может редактировать только свой профиль
            if master.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only edit your own profile"
                )
            if not master.can_edit_profile:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Profile editing permission required. Contact your manager."
                )
        else:
            # Владельцы и админы могут редактировать любого мастера
            if master.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Обновляем только переданные поля
        update_data = master_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(master, key, value)
        
        master.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(master)
        
        return master
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating master: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update master"
        )

@router.delete("/{master_id}")
async def delete_master(
    master_id: UUID,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Удалить мастера (только для владельцев/админов)"""
    try:
        # Находим мастера
        result = await db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            raise HTTPException(status_code=404, detail="Master not found")
        
        # Проверяем что мастер из того же тенанта
        if master.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Удаляем мастера
        await db.delete(master)
        await db.commit()
        
        return {"message": "Master deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting master: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete master"
        )

@router.put("/{master_id}/permissions", response_model=MasterResponse)
async def update_master_permissions(
    master_id: UUID,
    permissions_data: MasterPermissionsUpdate,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Обновить права мастера (только для владельцев/админов)"""
    try:
        # Находим мастера
        result = await db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            raise HTTPException(status_code=404, detail="Master not found")
        
        # Проверяем что мастер из того же тенанта
        if master.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Обновляем права
        update_data = permissions_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(master, key, value)
        
        master.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(master)
        
        return master
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating master permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update master permissions"
        )