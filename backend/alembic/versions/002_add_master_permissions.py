"""Add master permissions

Revision ID: 002
Revises: 001
Create Date: 2025-09-17 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    print("��� Добавление полей разрешений в таблицу masters...")
    
    # Добавляем поля разрешений
    op.add_column('masters', sa.Column('can_edit_profile', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_edit_schedule', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('masters', sa.Column('can_edit_services', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('masters', sa.Column('can_manage_bookings', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_view_analytics', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_upload_photos', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('experience_years', sa.Integer(), nullable=False, server_default='0'))
    
    print("✅ Поля разрешений добавлены")

def downgrade() -> None:
    op.drop_column('masters', 'experience_years')
    op.drop_column('masters', 'can_upload_photos')
    op.drop_column('masters', 'can_view_analytics')
    op.drop_column('masters', 'can_manage_bookings')
    op.drop_column('masters', 'can_edit_services')
    op.drop_column('masters', 'can_edit_schedule')
    op.drop_column('masters', 'can_edit_profile')
