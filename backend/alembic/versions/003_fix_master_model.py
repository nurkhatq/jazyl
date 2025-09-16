"""Add master features and permission requests

Revision ID: 003
Revises: 002
Create Date: 2025-09-16 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '003'
down_revision = '002'
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
        op.create_table(
            'permission_requests',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
            sa.Column('master_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('permission_type', sa.Enum('edit_schedule', 'edit_services', 'edit_profile', 'upload_photos', 'manage_bookings', 'view_analytics', name='permissionrequesttype'), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('additional_info', sa.Text(), nullable=True),
            sa.Column('status', sa.Enum('pending', 'approved', 'rejected', name='permissionrequeststatus'), nullable=False, default='pending'),
            sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('review_note', sa.Text(), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, default=sa.func.now()),
            sa.ForeignKeyConstraint(['master_id'], ['masters.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Создаем индексы для производительности
        op.create_index('idx_permission_requests_master_id', 'permission_requests', ['master_id'])
        op.create_index('idx_permission_requests_status', 'permission_requests', ['status'])
        op.create_index('idx_permission_requests_tenant_id', 'permission_requests', ['tenant_id'])
    
    # Проверяем и обновляем таблицу block_times если нужно
    if 'block_times' in existing_tables:
        # Если таблица уже есть, проверяем есть ли нужные поля
        columns = [col['name'] for col in inspector.get_columns('block_times')]
        
        if 'tenant_id' not in columns:
            op.add_column('block_times', sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True))
            # Обновляем существующие записи, установив tenant_id из связанного мастера
            op.execute(sa.text("""
                UPDATE block_times 
                SET tenant_id = (
                    SELECT m.tenant_id 
                    FROM masters m 
                    WHERE m.id = block_times.master_id
                )
                WHERE tenant_id IS NULL
            """))
            # Делаем поле обязательным после заполнения данных
            op.alter_column('block_times', 'tenant_id', nullable=False)
            op.create_foreign_key(
                'fk_block_times_tenant_id', 'block_times', 'tenants', 
                ['tenant_id'], ['id'], ondelete='CASCADE'
            )
    
    # Исправляем поле display_name в таблице masters (может быть NULL)
    masters_columns = [col['name'] for col in inspector.get_columns('masters')]
    if 'display_name' in masters_columns:
        op.alter_column('masters', 'display_name', 
                       existing_type=sa.String(),
                       nullable=True)
    
    # Убеждаемся что specialization имеет правильный тип JSON
    if 'specialization' in masters_columns:
        try:
            op.alter_column('masters', 'specialization',
                           existing_type=sa.JSON(),
                           type_=sa.JSON(),
                           nullable=True,
                           server_default='[]')
        except Exception as e:
            # Если поле уже правильного типа, игнорируем ошибку
            print(f"Specialization column already correct: {e}")

def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()
    
    # Удаляем индексы если они есть
    if 'permission_requests' in existing_tables:
        try:
            op.drop_index('idx_permission_requests_tenant_id', table_name='permission_requests')
            op.drop_index('idx_permission_requests_status', table_name='permission_requests')
            op.drop_index('idx_permission_requests_master_id', table_name='permission_requests')
        except:
            pass
        
        # Удаляем таблицу
        op.drop_table('permission_requests')
    
    # Удаляем enum типы если они есть
    try:
        connection.execute(sa.text('DROP TYPE IF EXISTS permissionrequesttype'))
        connection.execute(sa.text('DROP TYPE IF EXISTS permissionrequeststatus'))
    except:
        pass