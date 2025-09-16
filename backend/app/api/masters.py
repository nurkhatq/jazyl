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
@router.get("", response_model=List[MasterResponse])
@router.get("/", response_model=List[MasterResponse], include_in_schema=False)
async def get_masters(
    request: Request,
    db: AsyncSession = Depends(get_db),
    # Опциональная авторизация для административного доступа
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Получить список мастеров (публичный доступ или административный)"""
    try:
        tenant_id = None
        
        # Если пользователь авторизован (административный доступ)
        if current_user:
            tenant_id = current_user.tenant_id
            
            # Если это админ/владелец, показываем всех мастеров включая неактивных
            if current_user.role in [UserRole.OWNER, UserRole.ADMIN]:
                result = await db.execute(
                    select(Master).where(Master.tenant_id == tenant_id)
                    .order_by(Master.display_name)
                )
                masters = result.scalars().all()
                return masters
        
        # Публичный доступ или обычные пользователи
        if not tenant_id:
            tenant_id = await get_current_tenant(request, db)
        
        result = await db.execute(
            select(Master).where(
                and_(
                    Master.tenant_id == tenant_id,
                    Master.is_active == True,
                    Master.is_visible == True
                )
            )
            .order_by(Master.display_name)
        )
        masters = result.scalars().all()
        
        return masters
        
    except HTTPException:
        # Если не удалось определить тенант
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not specified"
        )

# Добавляем вспомогательную функцию для опциональной авторизации
async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Возвращает пользователя если он авторизован, иначе None"""
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    try:
        from app.utils.security import get_current_user_from_token
        user = await get_current_user_from_token(token, db)
        return user
    except:
        return None

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
    """Получить свой профиль мастера с правами доступа - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
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
                display_name = current_user.email.split('@')[0]  # Используем часть email как fallback
                
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
                experience_years=0
            )
            
            db.add(master)
            await db.commit()
            await db.refresh(master)
            print(f"✅ Created master profile for user {current_user.email}")
        else:
            print(f"✅ Found existing master profile: {master.display_name}")
        
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

# ==================== НОВЫЕ ИСПРАВЛЕННЫЕ ЭНДПОИНТЫ ====================
@router.get("/my-stats")
async def get_my_stats(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить статистику мастера - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
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
            return {
                "weekBookings": 0,
                "totalClients": 0,
                "monthRevenue": 0.0,
                "totalBookings": 0,
                "completedBookings": 0,
                "cancelledBookings": 0,
                "cancellationRate": 0.0
            }
        
        print(f"✅ Found master profile: {master.display_name}")
        
        # Проверяем права доступа (более мягко)
        if not master.can_view_analytics:
            print(f"⚠️ Master {master.display_name} doesn't have analytics permission")
            # Вместо ошибки 403, даём базовую статистику
            return {
                "weekBookings": 0,
                "totalClients": 0,
                "monthRevenue": 0.0,
                "totalBookings": 0,
                "completedBookings": 0,
                "cancelledBookings": 0,
                "cancellationRate": 0.0,
                "message": "Contact your manager for full analytics access"
            }
        
        # Рассчитываем периоды
        now = datetime.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        print(f"📊 Calculating stats for master ID: {master.id}")
        
        try:
            # Запросы за неделю
            week_bookings = await db.scalar(
                select(func.count(Booking.id))
                .where(and_(
                    Booking.master_id == master.id,
                    Booking.date >= week_ago,
                    Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
                ))
            ) or 0
            
            # Общее количество уникальных клиентов
            total_clients = await db.scalar(
                select(func.count(func.distinct(Booking.client_id)))
                .where(and_(
                    Booking.master_id == master.id,
                    Booking.status == BookingStatus.COMPLETED
                ))
            ) or 0
            
            # Доход за месяц
            month_revenue = await db.scalar(
                select(func.coalesce(func.sum(Booking.price), 0))
                .where(and_(
                    Booking.master_id == master.id,
                    Booking.date >= month_ago,
                    Booking.status == BookingStatus.COMPLETED
                ))
            ) or 0.0
            
            # Общая статистика записей
            bookings_stats = await db.execute(
                select(
                    func.count(Booking.id).label('total'),
                    func.count(case((Booking.status == BookingStatus.COMPLETED, 1))).label('completed'),
                    func.count(case((Booking.status == BookingStatus.CANCELLED, 1))).label('cancelled')
                )
                .where(Booking.master_id == master.id)
            )
            
            stats = bookings_stats.first()
            
            # Рассчитываем процент отмен
            cancellation_rate = 0.0
            if stats.total > 0:
                cancellation_rate = (stats.cancelled / stats.total) * 100
            
            result_stats = {
                "weekBookings": int(week_bookings),
                "totalClients": int(total_clients),
                "monthRevenue": float(month_revenue),
                "totalBookings": int(stats.total),
                "completedBookings": int(stats.completed),
                "cancelledBookings": int(stats.cancelled),
                "cancellationRate": round(cancellation_rate, 2)
            }
            
            print(f"✅ Stats calculated successfully: {result_stats}")
            return result_stats
            
        except Exception as stats_error:
            print(f"❌ Error calculating stats: {stats_error}")
            # В случае ошибки с БД возвращаем нулевую статистику
            return {
                "weekBookings": 0,
                "totalClients": 0,
                "monthRevenue": 0.0,
                "totalBookings": 0,
                "completedBookings": 0,
                "cancelledBookings": 0,
                "cancellationRate": 0.0,
                "error": "Stats calculation error"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_my_stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get master statistics"
        )

@router.get("/my-bookings/today")
async def get_my_bookings_today(
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить записи мастера на сегодня - НОВЫЙ ЭНДПОИНТ"""
    try:
        # Находим профиль мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            return {"bookings": []}
        
        # Проверяем права доступа к записям
        if not master.can_manage_bookings:
            raise HTTPException(
                status_code=403,
                detail="Booking management permission required. Contact your manager."
            )
        
        # Получаем сегодняшнюю дату
        today = date.today()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        # Получаем записи на сегодня
        bookings_result = await db.execute(
            select(Booking)
            .where(and_(
                Booking.master_id == master.id,
                Booking.date >= today_start,
                Booking.date <= today_end
            ))
            .order_by(Booking.date.asc())
        )
        
        bookings = bookings_result.scalars().all()
        
        # Форматируем результат
        formatted_bookings = []
        for booking in bookings:
            formatted_bookings.append({
                "id": str(booking.id),
                "client_name": booking.client_name,
                "client_phone": booking.client_phone,
                "service_name": booking.service_name,
                "date": booking.date.isoformat(),
                "duration": booking.duration,
                "price": float(booking.price),
                "status": booking.status.value,
                "notes": booking.notes
            })
        
        return {"bookings": formatted_bookings}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_my_bookings_today: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get today's bookings"
        )

@router.get("/my-bookings")
async def get_my_bookings(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[BookingStatus] = Query(None),
    current_user: User = Depends(get_current_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить записи мастера с фильтрами"""
    try:
        # Находим профиль мастера
        result = await db.execute(
            select(Master).where(Master.user_id == current_user.id)
        )
        master = result.scalar_one_or_none()
        
        if not master:
            return {"bookings": []}
        
        # Проверяем права доступа
        if not master.can_manage_bookings:
            raise HTTPException(
                status_code=403,
                detail="Booking management permission required. Contact your manager."
            )
        
        # Строим запрос
        query = select(Booking).where(Booking.master_id == master.id)
        
        # Применяем фильтры
        if date_from:
            query = query.where(Booking.date >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.where(Booking.date <= datetime.combine(date_to, datetime.max.time()))
        if status:
            query = query.where(Booking.status == status)
        
        query = query.order_by(Booking.date.asc())
        
        bookings_result = await db.execute(query)
        bookings = bookings_result.scalars().all()
        
        # Форматируем результат
        formatted_bookings = []
        for booking in bookings:
            formatted_bookings.append({
                "id": str(booking.id),
                "client_name": booking.client_name,
                "client_phone": booking.client_phone,
                "client_email": booking.client_email,
                "service_name": booking.service_name,
                "date": booking.date.isoformat(),
                "duration": booking.duration,
                "price": float(booking.price),
                "status": booking.status.value,
                "notes": booking.notes,
                "created_at": booking.created_at.isoformat()
            })
        
        return {"bookings": formatted_bookings}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_my_bookings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get bookings"
        )

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