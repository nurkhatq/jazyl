from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceResponse
from app.services.service import ServiceService
from app.utils.security import get_current_tenant, get_current_user_from_token, require_role
from app.models.user import UserRole, User

router = APIRouter()

async def get_current_user_optional(request: Request, db: AsyncSession = Depends(get_db)) -> Optional[User]:
    """
    Возвращает текущего пользователя или None для поддомена (барбершопа).
    """
    subdomain = request.headers.get("x-subdomain")
    if subdomain:
        return None  # Клиент поддомена — без авторизации
    
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None  # нет токена — вернуть None

    token = auth_header.split(" ")[1]
    # Используем функцию, которая принимает db напрямую
    user = await get_current_user_from_token(token, db)
    return user


@router.post("/", response_model=ServiceResponse)
async def create_service(
    service_data: ServiceCreate,
    current_user: User = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Create new service"""
    service = ServiceService(db)
    new_service = await service.create_service(
        current_user.tenant_id,
        service_data
    )
    return new_service


@router.get("/", response_model=List[ServiceResponse])
async def get_services(
    category_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(True),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    tenant_id = getattr(current_user, "tenant_id", None)
    
    services = await service.get_services(
        category_id=category_id,
        is_active=is_active,
        tenant_id=tenant_id  # None, если поддомен/неавторизованный пользователь
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
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Update service"""
    service = ServiceService(db)
    updated_service = await service.update_service(service_id, service_data)
    if not updated_service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return updated_service


@router.delete("/{service_id}")
async def delete_service(
    service_id: UUID,
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Delete service (soft delete)"""
    service = ServiceService(db)
    await service.delete_service(service_id)
    return {"message": "Service deleted successfully"}


@router.post("/categories")
async def create_category(
    category_data: dict,
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Create service category"""
    service = ServiceService(db)
    category = await service.create_category(current_user.tenant_id, category_data)
    return category


@router.get("/categories")
async def get_categories(
    tenant_id: Optional[UUID] = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    service = ServiceService(db)
    categories = await service.get_categories(tenant_id)
    return categories
