#!/bin/bash

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="jazyl_backup_$TIMESTAMP"

# Create backup directory
mkdir -p $BACKUP_DIR/$BACKUP_NAME

# Backup database
echo "Backing up database..."
docker-compose exec -T postgres pg_dump -U jazyl_user jazyl_db > $BACKUP_DIR/$BACKUP_NAME/database.sql

# Backup uploaded files
echo "Backing up uploaded files..."
docker cp jazyl-backend:/app/uploads $BACKUP_DIR/$BACKUP_NAME/uploads

# Backup environment files
echo "Backing up configuration..."
cp ./backend/.env $BACKUP_DIR/$BACKUP_NAME/backend.env

# Create archive
echo "Creating archive..."
tar -czf $BACKUP_DIR/$BACKUP_NAME.tar.gz -C $BACKUP_DIR $BACKUP_NAME

# Remove temporary directory
rm -rf $BACKUP_DIR/$BACKUP_NAME

echo "✅ Backup completed: $BACKUP_DIR/$BACKUP_NAME.tar.gz"