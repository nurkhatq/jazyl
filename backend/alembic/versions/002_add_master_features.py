"""Add master features and permissions

Revision ID: 002
Revises: 001
Create Date: 2025-09-17 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Step 1: Add permission fields to masters table
    op.add_column('masters', sa.Column('can_edit_profile', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_edit_schedule', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('masters', sa.Column('can_edit_services', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('masters', sa.Column('can_manage_bookings', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_view_analytics', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('can_upload_photos', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('masters', sa.Column('experience_years', sa.Integer(), nullable=False, server_default='0'))
    
    # Step 2: Create enum types for permission requests
    op.execute("CREATE TYPE permissionrequeststatus AS ENUM ('pending', 'approved', 'rejected')")
    op.execute("CREATE TYPE permissionrequesttype AS ENUM ('edit_schedule', 'edit_services', 'edit_profile', 'upload_photos', 'manage_bookings', 'view_analytics')")
    
    # Step 3: Create permission_requests table
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
    
    # Step 4: Create indexes
    op.create_index('ix_permission_requests_master_id', 'permission_requests', ['master_id'])
    op.create_index('ix_permission_requests_tenant_id', 'permission_requests', ['tenant_id'])
    op.create_index('ix_permission_requests_status', 'permission_requests', ['status'])

def downgrade() -> None:
    # Drop table and indexes
    op.drop_table('permission_requests')
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS permissionrequesttype')
    op.execute('DROP TYPE IF EXISTS permissionrequeststatus')
    
    # Drop permission columns from masters
    op.drop_column('masters', 'experience_years')
    op.drop_column('masters', 'can_upload_photos')
    op.drop_column('masters', 'can_view_analytics')
    op.drop_column('masters', 'can_manage_bookings')
    op.drop_column('masters', 'can_edit_services')
    op.drop_column('masters', 'can_edit_schedule')
    op.drop_column('masters', 'can_edit_profile')
