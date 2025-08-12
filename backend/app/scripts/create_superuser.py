#!/usr/bin/env python
"""Script to create superuser"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.services.auth import AuthService
import uuid
from datetime import datetime

async def create_superuser():
    async with AsyncSessionLocal() as db:
        try:
            # Create default tenant for platform admin
            tenant = Tenant(
                id=uuid.uuid4(),
                subdomain="admin",
                name="Jazyl Platform",
                email="admin@jazyl.tech",
                phone="+1234567890",
                address="Platform Administration",
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(tenant)
            await db.flush()
            
            # Create superuser
            auth_service = AuthService(db)
            hashed_password = auth_service.get_password_hash("Admin123!")
            
            superuser = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                email="admin@jazyl.tech",
                first_name="Platform",
                last_name="Admin",
                hashed_password=hashed_password,
                role=UserRole.OWNER,
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(superuser)
            
            await db.commit()
            
            print("✅ Superuser created successfully!")
            print("📧 Email: admin@jazyl.tech")
            print("🔑 Password: Admin123!")
            print("⚠️  Please change the password after first login!")
            
        except Exception as e:
            print(f"❌ Error creating superuser: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(create_superuser())
