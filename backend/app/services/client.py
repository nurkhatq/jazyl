from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from app.models.client import Client
from app.models.booking import Booking, BookingStatus
from app.schemas.client import ClientCreate, ClientUpdate

class ClientService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_client(self, tenant_id: UUID, client_data: ClientCreate) -> Client:
        client = Client(
            tenant_id=tenant_id,
            **client_data.dict()
        )
        
        self.db.add(client)
        await self.db.commit()
        await self.db.refresh(client)
        
        return client
    
    async def get_clients(
        self,
        tenant_id: UUID,
        search: Optional[str] = None,
        is_vip: Optional[bool] = None
    ) -> List[Client]:
        query = select(Client).where(
            and_(
                Client.tenant_id == tenant_id,
                Client.is_blacklisted == False
            )
        )
        
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Client.first_name.ilike(search_term),
                    Client.last_name.ilike(search_term),
                    Client.email.ilike(search_term),
                    Client.phone.ilike(search_term)
                )
            )
        
        if is_vip is not None:
            query = query.where(Client.is_vip == is_vip)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_client(self, client_id: UUID) -> Optional[Client]:
        result = await self.db.execute(
            select(Client).where(Client.id == client_id)
        )
        return result.scalar_one_or_none()
    
    async def update_client(
        self,
        client_id: UUID,
        client_data: ClientUpdate
    ) -> Optional[Client]:
        client = await self.get_client(client_id)
        
        if not client:
            return None
        
        update_data = client_data.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(client, key, value)
        
        client.updated_at = datetime.utcnow()
        await self.db.commit()
        
        return client
    
    async def get_client_history(self, client_id: UUID) -> List[dict]:
        result = await self.db.execute(
            select(Booking)
            .where(Booking.client_id == client_id)
            .order_by(Booking.date.desc())
        )
        bookings = result.scalars().all()
        
        # Update client statistics
        completed_bookings = [b for b in bookings if b.status == BookingStatus.COMPLETED]
        
        if completed_bookings:
            client = await self.get_client(client_id)
            if client:
                client.total_visits = len(completed_bookings)
                client.total_spent = sum(b.price for b in completed_bookings)
                client.last_visit = max(b.date for b in completed_bookings)
                await self.db.commit()
        
        return [
            {
                "id": str(b.id),
                "date": b.date.isoformat(),
                "service_id": str(b.service_id),
                "master_id": str(b.master_id),
                "price": b.price,
                "status": b.status.value
            }
            for b in bookings
        ]
    
    async def add_note(self, client_id: UUID, note: str, user_id: UUID) -> None:
        client = await self.get_client(client_id)
        
        if client:
            timestamp = datetime.utcnow().isoformat()
            new_note = f"[{timestamp}] {note}\n"
            
            if client.notes:
                client.notes += new_note
            else:
                client.notes = new_note
            
            await self.db.commit()