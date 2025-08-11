from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from uuid import UUID

from app.models.booking import Booking, BookingStatus
from app.models.client import Client
from app.models.master import Master
from app.models.service import Service
from app.models.user import UserRole

class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_stats(
        self,
        tenant_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        user_role: UserRole = UserRole.OWNER,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        # Default date range (last 30 days)
        if not date_to:
            date_to = date.today()
        if not date_from:
            date_from = date_to - timedelta(days=30)
        
        # Base query
        query = select(Booking).where(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.date >= datetime.combine(date_from, datetime.min.time()),
                Booking.date <= datetime.combine(date_to, datetime.max.time())
            )
        )
        
        # Filter by master if user is a master
        if user_role == UserRole.MASTER and user_id:
            master_result = await self.db.execute(
                select(Master).where(Master.user_id == user_id)
            )
            master = master_result.scalar_one_or_none()
            if master:
                query = query.where(Booking.master_id == master.id)
        
        result = await self.db.execute(query)
        bookings = result.scalars().all()
        
        # Calculate statistics
        total_bookings = len(bookings)
        confirmed_bookings = len([b for b in bookings if b.status == BookingStatus.CONFIRMED])
        completed_bookings = len([b for b in bookings if b.status == BookingStatus.COMPLETED])
        cancelled_bookings = len([b for b in bookings if b.status == BookingStatus.CANCELLED])
        
        total_revenue = sum(b.price for b in bookings if b.status == BookingStatus.COMPLETED)
        
        # Get unique clients
        unique_clients = len(set(b.client_id for b in bookings))
        
        return {
            "total_bookings": total_bookings,
            "confirmed_bookings": confirmed_bookings,
            "completed_bookings": completed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "cancellation_rate": (cancelled_bookings / total_bookings * 100) if total_bookings > 0 else 0,
            "total_revenue": total_revenue,
            "average_booking_value": total_revenue / completed_bookings if completed_bookings > 0 else 0,
            "unique_clients": unique_clients,
            "date_range": {
                "from": date_from.isoformat(),
                "to": date_to.isoformat()
            }
        }
    
    async def get_today_overview(
        self,
        tenant_id: UUID,
        user_role: UserRole = UserRole.OWNER,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        today = date.today()
        start_of_day = datetime.combine(today, datetime.min.time())
        end_of_day = datetime.combine(today, datetime.max.time())
        
        query = select(Booking).where(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.date >= start_of_day,
                Booking.date <= end_of_day
            )
        )
        
        # Filter by master if user is a master
        if user_role == UserRole.MASTER and user_id:
            master_result = await self.db.execute(
                select(Master).where(Master.user_id == user_id)
            )
            master = master_result.scalar_one_or_none()
            if master:
                query = query.where(Booking.master_id == master.id)
        
        query = query.order_by(Booking.date)
        
        result = await self.db.execute(query)
        bookings = result.scalars().all()
        
        return {
            "date": today.isoformat(),
            "total_bookings": len(bookings),
            "upcoming": len([b for b in bookings if b.date > datetime.utcnow()]),
            "completed": len([b for b in bookings if b.status == BookingStatus.COMPLETED]),
            "expected_revenue": sum(b.price for b in bookings if b.status in [BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
            "bookings": [
                {
                    "id": str(b.id),
                    "time": b.date.strftime("%H:%M"),
                    "client_id": str(b.client_id),
                    "service_id": str(b.service_id),
                    "master_id": str(b.master_id),
                    "status": b.status.value,
                    "price": b.price
                }
                for b in bookings
            ]
        }
    
    async def get_revenue_report(
        self,
        tenant_id: UUID,
        period: str = "month",
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        if not date_to:
            date_to = date.today()
        
        if not date_from:
            if period == "day":
                date_from = date_to - timedelta(days=30)
            elif period == "week":
                date_from = date_to - timedelta(weeks=12)
            elif period == "month":
                date_from = date_to - timedelta(days=365)
            else:  # year
                date_from = date_to - timedelta(days=365 * 5)
        
        # Group by period
        if period == "day":
            date_trunc = func.date_trunc('day', Booking.date)
        elif period == "week":
            date_trunc = func.date_trunc('week', Booking.date)
        elif period == "month":
            date_trunc = func.date_trunc('month', Booking.date)
        else:  # year
            date_trunc = func.date_trunc('year', Booking.date)
        
        result = await self.db.execute(
            select(
                date_trunc.label('period'),
                func.count(Booking.id).label('bookings_count'),
                func.sum(Booking.price).label('revenue')
            )
            .where(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == BookingStatus.COMPLETED,
                    Booking.date >= datetime.combine(date_from, datetime.min.time()),
                    Booking.date <= datetime.combine(date_to, datetime.max.time())
                )
            )
            .group_by(date_trunc)
            .order_by(date_trunc)
        )
        
        rows = result.all()
        
        return [
            {
                "period": row.period.isoformat() if row.period else None,
                "bookings_count": row.bookings_count,
                "revenue": float(row.revenue) if row.revenue else 0
            }
            for row in rows
        ]
    
    async def get_masters_performance(
        self,
        tenant_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        if not date_to:
            date_to = date.today()
        if not date_from:
            date_from = date_to - timedelta(days=30)
        
        result = await self.db.execute(
            select(
                Master.id,
                Master.display_name,
                func.count(Booking.id).label('bookings_count'),
                func.sum(Booking.price).label('revenue'),
                func.avg(Master.rating).label('rating')
            )
            .join(Booking, Master.id == Booking.master_id)
            .where(
                and_(
                    Master.tenant_id == tenant_id,
                    Booking.status == BookingStatus.COMPLETED,
                    Booking.date >= datetime.combine(date_from, datetime.min.time()),
                    Booking.date <= datetime.combine(date_to, datetime.max.time())
                )
            )
            .group_by(Master.id, Master.display_name)
            .order_by(func.sum(Booking.price).desc())
        )
        
        rows = result.all()
        
        return [
            {
                "master_id": str(row.id),
                "name": row.display_name,
                "bookings_count": row.bookings_count,
                "revenue": float(row.revenue) if row.revenue else 0,
                "rating": float(row.rating) if row.rating else 0
            }
            for row in rows
        ]
    
    async def get_popular_services(
        self,
        tenant_id: UUID,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            select(
                Service.id,
                Service.name,
                Service.price,
                func.count(Booking.id).label('bookings_count'),
                func.sum(Booking.price).label('revenue')
            )
            .join(Booking, Service.id == Booking.service_id)
            .where(
                and_(
                    Service.tenant_id == tenant_id,
                    Booking.status == BookingStatus.COMPLETED
                )
            )
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
                "bookings_count": row.bookings_count,
                "revenue": float(row.revenue) if row.revenue else 0
            }
            for row in rows
        ]
    
    async def get_top_clients(
        self,
        tenant_id: UUID,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            select(
                Client.id,
                Client.first_name,
                Client.last_name,
                Client.email,
                Client.total_visits,
                Client.total_spent,
                Client.last_visit
            )
            .where(
                and_(
                    Client.tenant_id == tenant_id,
                    Client.is_blacklisted == False
                )
            )
            .order_by(Client.total_spent.desc())
            .limit(limit)
        )
        
        rows = result.all()
        
        return [
            {
                "client_id": str(row.id),
                "name": f"{row.first_name} {row.last_name or ''}".strip(),
                "email": row.email,
                "total_visits": row.total_visits,
                "total_spent": float(row.total_spent) if row.total_spent else 0,
                "last_visit": row.last_visit.isoformat() if row.last_visit else None
            }
            for row in rows
        ]