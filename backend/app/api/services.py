from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceResponse
from app.services.service import ServiceService
from app.utils.security import get_current_user, require_role
from sqlalchemy import select

router = APIRouter()

# ---------------------- Public API endpoints for barbershop pages ----------------------

@router.get("/public", response_model=List[ServiceResponse])
async def get_public_services(
    request: Request,
    category_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_db)
):
    """Get services for public barbershop page (no auth required)"""
    # Get tenant_id from X-Tenant-Subdomain header
    subdomain = request.headers.get("X-Tenant-Subdomain")
    if not subdomain:
        return []
    
    # Get tenant by subdomain
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.subdomain == subdomain)
    )
    tenant = tenant_result.scalar_one_or_none()
    
    if not tenant:
        return []
    
    # Get active services for this tenant
    service = ServiceService(db)
    services = await service.get_services(
        tenant_id=tenant.id,
        category_id=category_id, 
        is_active=is_active
    )
    return services

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


@router.post("")
@router.post("/")
async def create_service(
    service_data: ServiceCreate,
    request: Request,
    current_user: User = Depends(require_role([UserRole.OWNER])),
    db: AsyncSession = Depends(get_db)
):
    """Создать новый сервис - ИСПРАВЛЕННАЯ ВЕРСИЯ"""
    try:
        # Получаем tenant_id из заголовка
        tenant_id_str = request.headers.get("X-Tenant-ID")
        if not tenant_id_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Tenant-ID header is required"
            )
        
        try:
            tenant_id = UUID(tenant_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID"
            )
        
        # Проверяем что пользователь из того же тенанта
        if current_user.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        print(f"🔧 Creating service for tenant: {tenant_id}")
        print(f"🔧 Service data: {service_data.dict()}")
        
        service = ServiceService(db)
        created_service = await service.create_service(tenant_id, service_data)
        
        # Возвращаем простой dict вместо Pydantic схемы
        return {
            "id": str(created_service.id),
            "tenant_id": str(created_service.tenant_id),
            "name": created_service.name,
            "description": created_service.description,
            "price": created_service.price,
            "duration": created_service.duration,
            "category_id": str(created_service.category_id) if created_service.category_id else None,
            "is_active": created_service.is_active if created_service.is_active is not None else True,
            "is_popular": created_service.is_popular if created_service.is_popular is not None else False,
            "created_at": created_service.created_at.isoformat() if created_service.created_at else None,
            "updated_at": created_service.updated_at.isoformat() if created_service.updated_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating service: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create service"
        )

@router.get("", response_model=List[ServiceResponse])
@router.get("/", response_model=List[ServiceResponse])
async def get_services(
    request: Request,
    category_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(True),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список услуг
    - Для авторизованных пользователей: услуги их tenant_id
    - Для публичного доступа: используется X-Tenant-ID из заголовка
    """
    service = ServiceService(db)
    
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
    
    # Запрос услуг для конкретного tenant
    services = await service.get_services(
        tenant_id=tenant_id,
        category_id=category_id, 
        is_active=is_active
    )
    return services

@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    result = await service.get_service(service_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return result

@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: UUID,
    service_data: ServiceUpdate,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    updated_service = await service.update_service(service_id, service_data)
    if not updated_service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return updated_service

@router.delete("/{service_id}")
async def delete_service(
    service_id: UUID,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    await service.delete_service(service_id)
    return {"message": "Service deleted successfully"}

# --- Categories ---
@router.post("/categories")
async def create_category(
    category_data: dict,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    category = await service.create_category(current_user.tenant_id, category_data)
    return category

@router.get("/categories")
async def get_categories(
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Get categories - поддерживает публичный доступ"""
    service = ServiceService(db)
    
    # Определяем tenant_id правильно
    if current_user:
        tenant_id = current_user.tenant_id
    else:
        tenant_id = await get_tenant_id_from_header(request)
    
    if not tenant_id:
        return []
    
    categories = await service.get_categories(tenant_id)
    return categories
