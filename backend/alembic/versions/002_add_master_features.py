"""Add master permissions

Revision ID: 002
Revises: 001
Create Date: 2025-09-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Проверяем существование столбцов перед добавлением
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('masters')]
    
    # Добавляем поля прав доступа в таблицу masters если их нет
    if 'can_edit_profile' not in columns:
        op.add_column('masters', sa.Column('can_edit_profile', sa.Boolean(), nullable=False, server_default='true'))
    
    if 'can_edit_schedule' not in columns:
        op.add_column('masters', sa.Column('can_edit_schedule', sa.Boolean(), nullable=False, server_default='false'))
    
    if 'can_edit_services' not in columns:
        op.add_column('masters', sa.Column('can_edit_services', sa.Boolean(), nullable=False, server_default='false'))
    
    if 'can_manage_bookings' not in columns:
        op.add_column('masters', sa.Column('can_manage_bookings', sa.Boolean(), nullable=False, server_default='true'))
    
    if 'can_view_analytics' not in columns:
        op.add_column('masters', sa.Column('can_view_analytics', sa.Boolean(), nullable=False, server_default='true'))
    
    if 'can_upload_photos' not in columns:
        op.add_column('masters', sa.Column('can_upload_photos', sa.Boolean(), nullable=False, server_default='true'))
    
    if 'experience_years' not in columns:
        op.add_column('masters', sa.Column('experience_years', sa.Integer(), nullable=False, server_default='0'))

def downgrade() -> None:
    # Удаляем добавленные поля (только если они есть)
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('masters')]
    
    columns_to_remove = [
        'can_upload_photos',
        'can_view_analytics', 
        'can_manage_bookings',
        'can_edit_services',
        'can_edit_schedule',
        'can_edit_profile',
        'experience_years'
    ]
    
    for column in columns_to_remove:
        if column in columns:
            try:
                op.drop_column('masters', column)
            except:
                pass