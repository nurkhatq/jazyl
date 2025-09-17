"""Add permission request system

Revision ID: 003
Revises: 002
Create Date: 2025-09-17 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    connection = op.get_bind()
    
    # Check if enum types already exist
    result = connection.execute(sa.text("""
        SELECT typname FROM pg_type WHERE typtype = 'e' AND typname IN 
        ('permissionrequeststatus', 'permissionrequesttype')
    """))
    existing_enums = [row[0] for row in result.fetchall()]
    
    # Create status enum if it doesn't exist
    if 'permissionrequeststatus' not in existing_enums:
        op.execute("CREATE TYPE permissionrequeststatus AS ENUM ('pending', 'approved', 'rejected')")
    
    # Create type enum if it doesn't exist  
    if 'permissionrequesttype' not in existing_enums:
        op.execute("CREATE TYPE permissionrequesttype AS ENUM ('edit_schedule', 'edit_services', 'edit_profile', 'upload_photos', 'manage_bookings', 'view_analytics')")
    
    # Check if table already exists
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()
    
    if 'permission_requests' not in existing_tables:
        # Create permission_requests table
        op.create_table('permission_requests',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('master_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('permission_type', sa.Enum(
                'edit_schedule', 'edit_services', 'edit_profile', 
                'upload_photos', 'manage_bookings', 'view_analytics', 
                name='permissionrequesttype'
            ), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('additional_info', sa.Text(), nullable=True),
            sa.Column('status', sa.Enum(
                'pending', 'approved', 'rejected', 
                name='permissionrequeststatus'
            ), nullable=False, server_default='pending'),
            sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('review_note', sa.Text(), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['master_id'], ['masters.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL')
        )
        
        # Create indexes
        op.create_index('ix_permission_requests_master_id', 'permission_requests', ['master_id'])
        op.create_index('ix_permission_requests_tenant_id', 'permission_requests', ['tenant_id'])
        op.create_index('ix_permission_requests_status', 'permission_requests', ['status'])

def downgrade() -> None:
    # Drop table if exists
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()
    
    if 'permission_requests' in existing_tables:
        op.drop_table('permission_requests')
    
    # Drop enum types (but check if they're used elsewhere)
    op.execute('DROP TYPE IF EXISTS permissionrequesttype CASCADE')
    op.execute('DROP TYPE IF EXISTS permissionrequeststatus CASCADE')
