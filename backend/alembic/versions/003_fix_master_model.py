"""Fix master model fields

Revision ID: 003_fix_master_model
Revises: 002
Create Date: 2025-09-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '003_fix_master_model'
down_revision = '002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Добавляем недостающие поля в таблицу masters
    
    # Проверяем существование столбцов перед добавлением
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('masters')]
    
    # Добавляем поля если их нет
    if 'experience_years' not in columns:
        op.add_column('masters', sa.Column('experience_years', sa.Integer(), nullable=False, server_default='0'))
    
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
    
    # Убеждаемся что поле display_name может быть NULL (для совместимости)
    op.alter_column('masters', 'display_name', 
                   existing_type=sa.String(),
                   nullable=True)
    
    # Убеждаемся что specialization имеет правильный тип JSON
    try:
        op.alter_column('masters', 'specialization',
                       existing_type=sa.JSON(),
                       type_=sa.JSON(),
                       nullable=True,
                       server_default='[]')
    except:
        # Если поле уже правильного типа, игнорируем ошибку
        pass

def downgrade() -> None:
    # Удаляем добавленные поля
    columns_to_remove = [
        'experience_years',
        'can_edit_profile', 
        'can_edit_schedule',
        'can_edit_services',
        'can_manage_bookings',
        'can_view_analytics',
        'can_upload_photos'
    ]
    
    for column in columns_to_remove:
        try:
            op.drop_column('masters', column)
        except:
            # Игнорируем ошибки если поле не существует
            pass