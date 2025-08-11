from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from uuid import UUID

from app.models.service import Service, ServiceCategory
from app.schemas.service import ServiceCreate, ServiceUpdate

class ServiceService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_service(self, tenant_id: UUID, service_data: ServiceCreate) -> Service:
        service = Service(
            tenant_id=tenant_id,
            **service_data.dict()
        )
        
        self.db.add(service)
        await self.db.commit()
        await self.db.refresh(service)
        
        return service
    
    async def get_services(
        self,
        tenant_id: UUID,
        category_id: Optional[UUID] = None,
        is_active: Optional[bool] = None
    ) -> List[Service]:
        query = select(Service).where(Service.tenant_id == tenant_id)
        
        if category_id:
            query = query.where(Service.category_id == category_id)
        if is_active is not None:
            query = query.where(Service.is_active == is_active)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_service(self, service_id: UUID) -> Optional[Service]:
        result = await self.db.execute(
            select(Service).where(Service.id == service_id)
        )
        return result.scalar_one_or_none()
    
    async def update_service(
        self,
        service_id: UUID,
        service_data: ServiceUpdate
    ) -> Optional[Service]:
        service = await self.get_service(service_id)
        
        if not service:
            return None
        
        update_data = service_data.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(service, key, value)
        
        await self.db.commit()
        
        return service
    
    async def delete_service(self, service_id: UUID) -> None:
        service = await self.get_service(service_id)
        
        if service:
            service.is_active = False
            await self.db.commit()
    
    async def create_category(self, tenant_id: UUID, category_data: dict) -> ServiceCategory:
        category = ServiceCategory(
            tenant_id=tenant_id,
            **category_data
        )
        
        self.db.add(category)
        await self.db.commit()
        await self.db.refresh(category)
        
        return category
    
    async def get_categories(self, tenant_id: UUID) -> List[ServiceCategory]:
        result = await self.db.execute(
            select(ServiceCategory)
            .where(
                and_(
                    ServiceCategory.tenant_id == tenant_id,
                    ServiceCategory.is_active == True
                )
            ).order_by(ServiceCategory.sort_order)
        )
        return result.scalars().all()