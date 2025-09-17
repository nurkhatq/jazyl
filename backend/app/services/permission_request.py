from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.models.permission_request import PermissionRequest, PermissionRequestStatus, PermissionRequestType
from app.models.master import Master
from app.models.user import User

class PermissionRequestService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_request(
        self,
        master_id: UUID,
        tenant_id: UUID,
        permission_type: PermissionRequestType,
        reason: str,
        additional_info: Optional[str] = None
    ) -> PermissionRequest:
        """Создать запрос на разрешение"""
        
        # Проверяем, нет ли уже pending запроса
        existing_result = await self.db.execute(
            select(PermissionRequest).where(
                and_(
                    PermissionRequest.master_id == master_id,
                    PermissionRequest.permission_type == permission_type,
                    PermissionRequest.status == PermissionRequestStatus.PENDING
                )
            )
        )
        existing_request = existing_result.scalar_one_or_none()
        
        if existing_request:
            # Обновляем существующий запрос
            existing_request.reason = reason
            existing_request.additional_info = additional_info
            existing_request.updated_at = datetime.utcnow()
            await self.db.commit()
            return existing_request
        
        # Создаем новый запрос
        request = PermissionRequest(
            master_id=master_id,
            tenant_id=tenant_id,
            permission_type=permission_type,
            reason=reason,
            additional_info=additional_info,
            status=PermissionRequestStatus.PENDING
        )
        
        self.db.add(request)
        await self.db.commit()
        await self.db.refresh(request)
        
        return request
    
    async def get_requests_for_tenant(self, tenant_id: UUID) -> List[PermissionRequest]:
        """Получить все запросы для тенанта"""
        result = await self.db.execute(
            select(PermissionRequest)
            .where(PermissionRequest.tenant_id == tenant_id)
            .order_by(desc(PermissionRequest.created_at))
        )
        return result.scalars().all()
    
    async def get_requests_for_master(self, master_id: UUID) -> List[PermissionRequest]:
        """Получить все запросы для мастера"""
        result = await self.db.execute(
            select(PermissionRequest)
            .where(PermissionRequest.master_id == master_id)
            .order_by(desc(PermissionRequest.created_at))
        )
        return result.scalars().all()
    
    async def approve_request(
        self,
        request_id: UUID,
        reviewer_id: UUID,
        review_note: Optional[str] = None
    ) -> bool:
        """Одобрить запрос"""
        result = await self.db.execute(
            select(PermissionRequest).where(PermissionRequest.id == request_id)
        )
        request = result.scalar_one_or_none()
        
        if not request or request.status != PermissionRequestStatus.PENDING:
            return False
        
        # Обновляем статус запроса
        request.status = PermissionRequestStatus.APPROVED
        request.reviewed_by = reviewer_id
        request.review_note = review_note
        request.reviewed_at = datetime.utcnow()
        request.updated_at = datetime.utcnow()
        
        # Обновляем права мастера
        master_result = await self.db.execute(
            select(Master).where(Master.id == request.master_id)
        )
        master = master_result.scalar_one_or_none()
        
        if master:
            permission_field = f"can_{request.permission_type.value}"
            if hasattr(master, permission_field):
                setattr(master, permission_field, True)
                master.updated_at = datetime.utcnow()
        
        await self.db.commit()
        return True
    
    async def reject_request(
        self,
        request_id: UUID,
        reviewer_id: UUID,
        review_note: Optional[str] = None
    ) -> bool:
        """Отклонить запрос"""
        result = await self.db.execute(
            select(PermissionRequest).where(PermissionRequest.id == request_id)
        )
        request = result.scalar_one_or_none()
        
        if not request or request.status != PermissionRequestStatus.PENDING:
            return False
        
        request.status = PermissionRequestStatus.REJECTED
        request.reviewed_by = reviewer_id
        request.review_note = review_note
        request.reviewed_at = datetime.utcnow()
        request.updated_at = datetime.utcnow()
        
        await self.db.commit()
        return True