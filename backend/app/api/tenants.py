from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.database import get_db
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from app.services.tenant import TenantService
from app.utils.security import get_current_user, require_role
from app.models.user import UserRole

router = APIRouter()

@router.post("", response_model=TenantResponse)
@router.post("/", response_model=TenantResponse)
async def create_tenant(
    tenant_data: TenantCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new tenant (barbershop)"""
    service = TenantService(db)
    
    # Check if subdomain is available
    if await service.get_by_subdomain(tenant_data.subdomain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subdomain already taken"
        )
    
    tenant = await service.create_tenant(tenant_data)
    return tenant

@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get tenant by ID"""
    service = TenantService(db)
    tenant = await service.get_tenant(tenant_id)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant

@router.get("/subdomain/{subdomain}", response_model=TenantResponse)
async def get_tenant_by_subdomain(
    subdomain: str,
    db: AsyncSession = Depends(get_db)
):
    """Get tenant by subdomain"""
    service = TenantService(db)
    tenant = await service.get_by_subdomain(subdomain)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant

@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    tenant_data: TenantUpdate,
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Update tenant settings"""
    service = TenantService(db)
    
    # Verify user owns this tenant
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this tenant"
        )
    
    tenant = await service.update_tenant(tenant_id, tenant_data)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant

@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: UUID,
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Delete tenant (soft delete)"""
    service = TenantService(db)
    
    # Verify user owns this tenant
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this tenant"
        )
    
    await service.delete_tenant(tenant_id)
    
    return {"message": "Tenant deleted successfully"}