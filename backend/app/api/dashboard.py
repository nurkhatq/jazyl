from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.services.dashboard import DashboardService
from app.utils.security import get_current_user, require_role, get_current_tenant
from app.models.user import UserRole

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    tenant_id: UUID = Depends(get_current_tenant),
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard statistics"""
    service = DashboardService(db)
    
    stats = await service.get_stats(
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to,
        user_role=current_user.role,
        user_id=current_user.id
    )
    
    return stats

@router.get("/today")
async def get_today_overview(
    tenant_id: UUID = Depends(get_current_tenant),
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get today's overview"""
    service = DashboardService(db)
    
    overview = await service.get_today_overview(
        tenant_id=tenant_id,
        user_role=current_user.role,
        user_id=current_user.id
    )
    
    return overview

@router.get("/revenue")
async def get_revenue_report(
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    tenant_id: UUID = Depends(get_current_tenant),
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Get revenue report"""
    service = DashboardService(db)
    
    report = await service.get_revenue_report(
        tenant_id=tenant_id,
        period=period,
        date_from=date_from,
        date_to=date_to
    )
    
    return report

@router.get("/masters/performance")
async def get_masters_performance(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    tenant_id: UUID = Depends(get_current_tenant),
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Get masters performance report"""
    service = DashboardService(db)
    
    report = await service.get_masters_performance(
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to
    )
    
    return report

@router.get("/services/popularity")
async def get_services_popularity(
    limit: int = Query(10, ge=1, le=50),
    tenant_id: UUID = Depends(get_current_tenant),
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get most popular services"""
    service = DashboardService(db)
    
    report = await service.get_popular_services(
        tenant_id=tenant_id,
        limit=limit
    )
    
    return report

@router.get("/clients/top")
async def get_top_clients(
    limit: int = Query(10, ge=1, le=50),
    tenant_id: UUID = Depends(get_current_tenant),
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Get top clients by revenue"""
    service = DashboardService(db)
    
    clients = await service.get_top_clients(
        tenant_id=tenant_id,
        limit=limit
    )
    
    return clients
