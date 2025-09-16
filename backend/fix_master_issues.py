#!/usr/bin/env python3
"""
Скрипт для диагностики и исправления проблем с кабинетом мастера
Запускать из корня проекта: python fix_master_issues.py
"""

import asyncio
import sys
import os
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import AsyncSession

# Добавляем путь к backend
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import get_db, engine
from app.models.user import User, UserRole
from app.models.master import Master
from app.models.booking import Booking

async def check_database_structure():
    """Проверить структуру базы данных"""
    print("🔍 Проверяем структуру базы данных...")
    
    async with engine.begin() as conn:
        inspector = inspect(conn.sync_connection)
        
        # Проверяем таблицу masters
        if 'masters' not in inspector.get_table_names():
            print("❌ Таблица 'masters' не найдена!")
            return False
        
        columns = [col['name'] for col in inspector.get_columns('masters')]
        print(f"📋 Поля в таблице masters: {columns}")
        
        # Проверяем обязательные поля
        required_fields = [
            'id', 'tenant_id', 'user_id', 'display_name', 'is_active', 'is_visible',
            'can_edit_profile', 'can_edit_schedule', 'can_edit_services',
            'can_manage_bookings', 'can_view_analytics', 'can_upload_photos',
            'experience_years'
        ]
        
        missing_fields = [field for field in required_fields if field not in columns]
        
        if missing_fields:
            print(f"❌ Отсутствующие поля: {missing_fields}")
            print("💡 Запустите миграцию: alembic upgrade head")
            return False
        else:
            print("✅ Все необходимые поля присутствуют")
            return True

async def check_master_profiles():
    """Проверить профили мастеров"""
    print("\n🔍 Проверяем профили мастеров...")
    
    async for db in get_db():
        try:
            # Найдем всех пользователей с ролью MASTER
            result = await db.execute(
                text("SELECT id, email, first_name, last_name, tenant_id FROM users WHERE role = 'MASTER'")
            )
            master_users = result.fetchall()
            
            print(f"👥 Найдено пользователей с ролью MASTER: {len(master_users)}")
            
            for user in master_users:
                print(f"\n👤 Пользователь: {user.email} (ID: {user.id})")
                
                # Проверяем есть ли профиль мастера
                result = await db.execute(
                    text("SELECT id, display_name, can_edit_profile FROM masters WHERE user_id = :user_id"),
                    {"user_id": user.id}
                )
                master_profile = result.fetchone()
                
                if master_profile:
                    print(f"✅ Профиль мастера найден: {master_profile.display_name}")
                    print(f"   Права: can_edit_profile = {master_profile.can_edit_profile}")
                else:
                    print("❌ Профиль мастера НЕ НАЙДЕН!")
                    
                    # Создаем профиль мастера
                    display_name = f"{user.first_name} {user.last_name or ''}".strip()
                    await db.execute(
                        text("""
                        INSERT INTO masters (
                            id, tenant_id, user_id, display_name, description, 
                            specialization, rating, reviews_count, is_active, is_visible,
                            can_edit_profile, can_edit_schedule, can_edit_services,
                            can_manage_bookings, can_view_analytics, can_upload_photos,
                            experience_years, created_at, updated_at
                        ) VALUES (
                            gen_random_uuid(), :tenant_id, :user_id, :display_name, '',
                            '[]'::json, 0.0, 0, true, true,
                            true, false, false,
                            true, true, true,
                            0, NOW(), NOW()
                        )
                        """),
                        {
                            "tenant_id": user.tenant_id,
                            "user_id": user.id,
                            "display_name": display_name
                        }
                    )
                    await db.commit()
                    print(f"✅ Создан профиль мастера: {display_name}")
                    
        except Exception as e:
            print(f"❌ Ошибка при проверке профилей: {e}")
            await db.rollback()
        finally:
            break

async def test_api_endpoints():
    """Тестируем API эндпоинты"""
    print("\n🔍 Тестируем доступность эндпоинтов...")
    
    # Эти эндпоинты должны быть доступны
    endpoints = [
        "/api/masters/my-profile",
        "/api/masters/my-stats", 
        "/api/masters/my-bookings/today",
        "/api/masters/my-bookings",
        "/api/masters/my-schedule",
        "/api/masters/my-permission-requests"
    ]
    
    print("📋 Проверяемые эндпоинты:")
    for endpoint in endpoints:
        print(f"   {endpoint}")
    
    print("\n💡 Для полного тестирования используйте:")
    print("   curl -H 'Authorization: Bearer <token>' http://localhost:8000/api/masters/my-profile")

async def check_permissions_table():
    """Проверить таблицу запросов разрешений"""
    print("\n🔍 Проверяем таблицу permission_requests...")
    
    async with engine.begin() as conn:
        inspector = inspect(conn.sync_connection)
        
        if 'permission_requests' not in inspector.get_table_names():
            print("❌ Таблица 'permission_requests' не найдена!")
            print("💡 Создайте миграцию для таблицы permission_requests")
            return False
        
        columns = [col['name'] for col in inspector.get_columns('permission_requests')]
        print(f"📋 Поля в таблице permission_requests: {columns}")
        return True

async def run_diagnostics():
    """Запустить полную диагностику"""
    print("🚀 Запуск диагностики проблем с кабинетом мастера...")
    print("=" * 60)
    
    # 1. Проверяем структуру БД
    db_ok = await check_database_structure()
    
    # 2. Проверяем профили мастеров
    if db_ok:
        await check_master_profiles()
    
    # 3. Проверяем таблицу разрешений
    await check_permissions_table()
    
    # 4. Показываем доступные эндпоинты
    await test_api_endpoints()
    
    print("\n" + "=" * 60)
    print("✅ Диагностика завершена!")
    print("\n📋 Дальнейшие действия:")
    print("1. Убедитесь что миграции выполнены: alembic upgrade head")
    print("2. Перезапустите backend: docker-compose restart jazyl-backend")
    print("3. Проверьте логи: docker-compose logs jazyl-backend")
    print("4. Протестируйте эндпоинты через фронтенд")

async def create_missing_permissions_table():
    """Создать таблицу permission_requests если её нет"""
    print("\n🔧 Создаем таблицу permission_requests...")
    
    async with engine.begin() as conn:
        await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS permission_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            master_id UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
            permission_type VARCHAR(50) NOT NULL,
            reason TEXT,
            additional_info TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW(),
            reviewed_at TIMESTAMP,
            reviewed_by UUID REFERENCES users(id),
            review_note TEXT
        );
        """))
        
        print("✅ Таблица permission_requests создана/проверена")

if __name__ == "__main__":
    print("🔧 Скрипт исправления проблем с кабинетом мастера")
    print("Убедитесь что база данных запущена!")
    
    try:
        asyncio.run(run_diagnostics())
    except KeyboardInterrupt:
        print("\n⚠️ Прервано пользователем")
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        print("💡 Убедитесь что база данных доступна и переменные окружения настроены")