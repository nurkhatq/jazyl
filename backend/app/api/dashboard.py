from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.database import get_db
from app.services.dashboard import DashboardService
from app.utils.security import get_current_user, require_role
from app.models.user import UserRole
from app.models.booking import Booking, BookingStatus
from app.models.client import Client
from app.models.master import Master
from app.models.service import Service
from app.models.tenant import Tenant

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard statistics"""
    service = DashboardService(db)
    
    # Get tenant_id from current user
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        return {
            "total_bookings": 0,
            "confirmed_bookings": 0,
            "completed_bookings": 0,
            "cancelled_bookings": 0,
            "cancellation_rate": 0,
            "total_revenue": 0,
            "average_booking_value": 0,
            "unique_clients": 0,
            "date_range": {
                "from": date_from.isoformat() if date_from else None,
                "to": date_to.isoformat() if date_to else None
            }
        }
    
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
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get today's overview"""
    service = DashboardService(db)
    
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        return {
            "date": date.today().isoformat(),
            "total_bookings": 0,
            "upcoming": 0,
            "completed": 0,
            "expected_revenue": 0,
            "bookings": []
        }
    
    overview = await service.get_today_overview(
        tenant_id=tenant_id,
        user_role=current_user.role,
        user_id=current_user.id
    )
    
    return overview

@router.get("/revenue")
async def get_revenue_report(
    period: str = Query("day", regex="^(day|week|month|year)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Get revenue report"""
    service = DashboardService(db)
    
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        return []
    
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
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Get masters performance report"""
    service = DashboardService(db)
    
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        return []
    
    report = await service.get_masters_performance(
        tenant_id=tenant_id,
        date_from=date_from,
        date_to=date_to
    )
    
    return report

@router.get("/services/popularity")
async def get_services_popularity(
    limit: int = Query(10, ge=1, le=50),
    current_user = Depends(require_role([UserRole.OWNER, UserRole.MASTER])),
    db: AsyncSession = Depends(get_db)
):
    """Get most popular services"""
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        return []
    
    # Простая реализация для начала
    try:
        result = await db.execute(
            select(
                Service.id,
                Service.name,
                Service.price,
                func.count(Booking.id).label('bookings_count'),
                func.sum(Booking.price).label('revenue')
            )
            .join(Booking, Service.id == Booking.service_id, isouter=True)
            .where(Service.tenant_id == tenant_id)
            .group_by(Service.id, Service.name, Service.price)
            .order_by(func.count(Booking.id).desc())
            .limit(limit)
        )
        
        rows = result.all()
        
        return [
            {
                "service_id": str(row.id),
                "name": row.name,
                "price": float(row.price),
                "bookings_count": row.bookings_count or 0,
                "revenue": float(row.revenue) if row.revenue else 0
            }
            for row in rows
        ]
    except Exception as e:
        print(f"Error in get_services_popularity: {e}")
        return []

@router.get("/clients/top")
async def get_top_clients(
    limit: int = Query(10, ge=1, le=50),
    current_user = Depends(require_role(UserRole.OWNER)),
    db: AsyncSession = Depends(get_db)
):
    """Get top clients by revenue"""
    service = DashboardService(db)
    
    tenant_id = current_user.tenant_id
    
    if not tenant_id:
        return []
    
    clients = await service.get_top_clients(
        tenant_id=tenant_id,
        limit=limit
    )
    
    return clients