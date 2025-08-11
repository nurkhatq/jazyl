#!/bin/bash

set -e

echo "🚀 Starting Jazyl Platform Deployment..."

# Check if .env exists
if [ ! -f "./backend/.env" ]; then
    echo "❌ Error: backend/.env file not found. Please create it from .env.example"
    exit 1
fi

# Create necessary directories
mkdir -p nginx/ssl
mkdir -p nginx/conf.d

# Generate SSL certificates if they don't exist
if [ ! -f "./nginx/ssl/jazyl.tech.crt" ]; then
    echo "📜 Generating SSL certificates..."
    ./generate-ssl.sh
fi

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Run database migrations
echo "📊 Running database migrations..."
docker-compose exec backend alembic upgrade head

# Create superuser
echo "👤 Creating superuser..."
docker-compose exec backend python -m app.scripts.create_superuser

echo "✅ Deployment completed successfully!"
echo "🌐 Platform is available at: https://jazyl.tech"
echo "📊 API documentation: https://api.jazyl.tech/docs"