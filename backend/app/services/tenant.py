from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional, List
from uuid import UUID

from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate

class TenantService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_tenant(self, tenant_data: TenantCreate) -> Tenant:
        tenant = Tenant(**tenant_data.dict())
        self.db.add(tenant)
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant
    
    async def get_tenant(self, tenant_id: UUID) -> Optional[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_subdomain(self, subdomain: str) -> Optional[Tenant]:
        result = await self.db.execute(
            select(Tenant).where(Tenant.subdomain == subdomain)
        )
        return result.scalar_one_or_none()
    
    async def update_tenant(self, tenant_id: UUID, tenant_data: TenantUpdate) -> Optional[Tenant]:
        update_data = tenant_data.dict(exclude_unset=True)
        if not update_data:
            return await self.get_tenant(tenant_id)
        
        await self.db.execute(
            update(Tenant)
            .where(Tenant.id == tenant_id)
            .values(**update_data)
        )
        await self.db.commit()
        
        return await self.get_tenant(tenant_id)
    
    async def delete_tenant(self, tenant_id: UUID) -> None:
        await self.db.execute(
            update(Tenant)
            .where(Tenant.id == tenant_id)
            .values(is_active=False)
        )
        await self.db.commit()