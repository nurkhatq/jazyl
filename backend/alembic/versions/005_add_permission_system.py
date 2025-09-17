"""Add permission request system

Revision ID: 005
Revises: 004
Create Date: 2025-09-17 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None

def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    # Проверяем существуют ли уже enum типы
    existing_enums = connection.execute(sa.text(
        "SELECT typname FROM pg_type WHERE typtype = 'e'"
    )).fetchall()
    existing_enum_names = [row[0] for row in existing_enums]
    
    # Создаем enum для статусов запросов разрешений если его нет
    if 'permissionrequeststatus' not in existing_enum_names:
        permission_status_enum = postgresql.ENUM(
            'pending', 'approved', 'rejected',
            name='permissionrequeststatus'
        )
        permission_status_enum.create(connection)
    
    # Создаем enum для типов разрешений если его нет
    if 'permissionrequesttype' not in existing_enum_names:
        permission_type_enum = postgresql.ENUM(
            'edit_schedule', 'edit_services', 'edit_profile', 
            'upload_photos', 'manage_bookings', 'view_analytics',
            name='permissionrequesttype'
        )
        permission_type_enum.create(connection)
    
    # Проверяем существование таблиц
    existing_tables = inspector.get_table_names()
    
    # Создаем таблицу запросов разрешений если её нет
    if 'permission_requests' not in existing_tables:
        op.create_table('permission_requests',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('master_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('permission_type', sa.Enum('edit_schedule', 'edit_services', 'edit_profile', 'upload_photos', 'manage_bookings', 'view_analytics', name='permissionrequesttype'), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('additional_info', sa.Text(), nullable=True),
            sa.Column('status', sa.Enum('pending', 'approved', 'rejected', name='permissionrequeststatus'), nullable=True),
            sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('review_note', sa.Text(), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['master_id'], ['masters.id'], ),
            sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_permission_requests_master_id'), 'permission_requests', ['master_id'], unique=False)
        op.create_index(op.f('ix_permission_requests_status'), 'permission_requests', ['status'], unique=False)
        op.create_index(op.f('ix_permission_requests_tenant_id'), 'permission_requests', ['tenant_id'], unique=False)

def downgrade() -> None:
    # Удаляем таблицу
    op.drop_table('permission_requests')
    
    # Удаляем enum типы
    connection = op.get_bind()
    connection.execute(sa.text('DROP TYPE IF EXISTS permissionrequeststatus'))
    connection.execute(sa.text('DROP TYPE IF EXISTS permissionrequesttype'))
