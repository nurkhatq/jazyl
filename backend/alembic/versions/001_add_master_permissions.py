"""Add master permissions

Revision ID: add_master_permissions
Revises: previous_revision
Create Date: 2025-09-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'add_master_permissions'
down_revision = 'previous_revision'  # Замените на актуальную последнюю ревизию
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Добавляем поля прав доступа в таблицу masters
    op.add_column('masters', sa.Column('can_edit_profile', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_edit_schedule', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('masters', sa.Column('can_edit_services', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('masters', sa.Column('can_manage_bookings', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_view_analytics', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_upload_photos', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('experience_years', sa.Integer(), nullable=False, server_default='0'))

def downgrade() -> None:
    # Удаляем добавленные поля
    op.drop_column('masters', 'can_upload_photos')
    op.drop_column('masters', 'can_view_analytics')
    op.drop_column('masters', 'can_manage_bookings')
    op.drop_column('masters', 'can_edit_services')
    op.drop_column('masters', 'can_edit_schedule')
    op.drop_column('masters', 'can_edit_profile')
    op.drop_column('masters', 'experience_years')