"""Fix master timestamps and display_name

Revision ID: 004
Revises: 003
Create Date: 2025-09-16 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '004'
down_revision = '003'  
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Исправляем проблемы с временными метками и display_name"""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    # Проверяем существование таблицы masters
    if 'masters' not in inspector.get_table_names():
        print("⚠️ Masters table not found, skipping migration")
        return
    
    print("🔧 Fixing master timestamps and display_name...")
    
    # 1. Исправляем NULL значения в created_at
    op.execute(sa.text("""
        UPDATE masters 
        SET created_at = NOW() 
        WHERE created_at IS NULL
    """))
    
    # 2. Исправляем NULL значения в updated_at
    op.execute(sa.text("""
        UPDATE masters 
        SET updated_at = NOW() 
        WHERE updated_at IS NULL
    """))
    
    # 3. Исправляем NULL или пустые display_name
    op.execute(sa.text("""
        UPDATE masters 
        SET display_name = COALESCE(
            NULLIF(TRIM(display_name), ''),
            SPLIT_PART(
                (SELECT email FROM users WHERE users.id = masters.user_id),
                '@', 1
            ),
            'Master'
        )
        WHERE display_name IS NULL OR TRIM(display_name) = ''
    """))
    
    # 4. Устанавливаем NOT NULL для created_at если еще не установлен
    columns = [col['name'] for col in inspector.get_columns('masters')]
    created_at_col = next((col for col in inspector.get_columns('masters') if col['name'] == 'created_at'), None)
    
    if created_at_col and created_at_col.get('nullable', True):
        op.alter_column('masters', 'created_at', nullable=False)
    
    # 5. Устанавливаем NOT NULL для updated_at если еще не установлен  
    updated_at_col = next((col for col in inspector.get_columns('masters') if col['name'] == 'updated_at'), None)
    
    if updated_at_col and updated_at_col.get('nullable', True):
        op.alter_column('masters', 'updated_at', nullable=False)
    
    # 6. Проверяем и добавляем недостающие поля прав доступа
    permissions_fields = [
        'can_edit_profile',
        'can_edit_schedule', 
        'can_edit_services',
        'can_manage_bookings',
        'can_view_analytics',
        'can_upload_photos'
    ]
    
    for field in permissions_fields:
        if field not in columns:
            print(f"➕ Adding missing field: {field}")
            default_value = 'true' if field in ['can_edit_profile', 'can_manage_bookings', 'can_view_analytics', 'can_upload_photos'] else 'false'
            op.add_column('masters', sa.Column(field, sa.Boolean(), nullable=False, server_default=default_value))
    
    # 7. Добавляем experience_years если его нет
    if 'experience_years' not in columns:
        print("➕ Adding experience_years field")
        op.add_column('masters', sa.Column('experience_years', sa.Integer(), nullable=False, server_default='0'))
    
    print("✅ Master timestamps and fields fixed successfully!")

def downgrade() -> None:
    """Откат изменений"""
    # Временные метки оставляем как есть, так как откат может привести к потере данных
    pass