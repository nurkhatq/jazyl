from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.services.client import ClientService
from app.utils.security import get_current_user, require_role, get_current_tenant
from app.models.user import UserRole

router = APIRouter()

@router.post("", response_model=ClientResponse)
@router.post("/", response_model=ClientResponse, include_in_schema=False)
async def create_client(
    client_data: ClientCreate,
    request: Request,
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Create new client"""
    tenant_id = await get_current_tenant(request, db)
    service = ClientService(db)
    
    client = await service.create_client(tenant_id, client_data)
    
    return client

@router.get("", response_model=List[ClientResponse])
@router.get("/", response_model=List[ClientResponse], include_in_schema=False)
async def get_clients(
    request: Request,
    search: Optional[str] = Query(None),
    is_vip: Optional[bool] = Query(None),
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get all clients for tenant"""
    tenant_id = await get_current_tenant(request, db)
    service = ClientService(db)
    
    clients = await service.get_clients(
        tenant_id=tenant_id,
        search=search,
        is_vip=is_vip
    )
    
    return clients

@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get client by ID"""
    service = ClientService(db)
    client = await service.get_client(client_id)
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    return client

@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Update client"""
    service = ClientService(db)
    
    client = await service.update_client(client_id, client_data)
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    return client

@router.get("/{client_id}/history")
async def get_client_history(
    client_id: UUID,
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get client's booking history"""
    service = ClientService(db)
    
    history = await service.get_client_history(client_id)
    
    return history

@router.post("/{client_id}/notes")
async def add_client_note(
    client_id: UUID,
    note: str,
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Add note to client profile"""
    service = ClientService(db)
    
    await service.add_note(client_id, note, current_user.id)
    
    return {"message": "Note added successfully"}