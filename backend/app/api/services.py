from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceResponse
from app.services.service import ServiceService
from app.utils.security import get_current_user, require_role

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


# --- CRUD Services ---
@router.post("/", response_model=ServiceResponse)
async def create_service(
    service_data: ServiceCreate,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    new_service = await service.create_service(current_user.tenant_id, service_data)
    return new_service

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
    tenant_id: Optional[UUID] = Depends(require_role(UserRole.OWNER)),  # Можно заменить на get_current_tenant при необходимости
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    categories = await service.get_categories(tenant_id)
    return categories
