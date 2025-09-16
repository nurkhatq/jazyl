# ✅ ДЕБАГ ВЕРСИЯ - Добавляем подробное логирование для выявления 422 ошибок

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime, timedelta
from pydantic import ValidationError
import json

from app.database import get_db
from app.models.user import User, UserRole
from app.models.master import Master
from app.models.booking import Booking, BookingStatus
from app.schemas.master import MasterResponse, MasterStatsResponse, TodayBookingsResponse
from app.utils.security import get_current_master

router = APIRouter()

# ✅ ДЕБАГ ВЕРСИЯ: my-profile с детальным логированием
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

# ✅ ДЕБАГ ВЕРСИЯ: my-stats с детальным логированием
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

# ✅ ДЕБАГ: Прямой доступ к базе данных
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