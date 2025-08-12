#!/bin/bash

# Health check script for monitoring

check_service() {
    SERVICE=$1
    if docker ps | grep -q $SERVICE; then
        echo "✅ $SERVICE is running"
    else
        echo "❌ $SERVICE is down!"
        # Send alert (implement your alerting mechanism)
        # curl -X POST https://your-alerting-service.com/alert
    fi
}

check_endpoint() {
    URL=$1
    NAME=$2
    if curl -f -s -o /dev/null $URL; then
        echo "✅ $NAME is accessible"
    else
        echo "❌ $NAME is not accessible!"
    fi
}

echo "🔍 Checking Jazyl Platform Health..."
echo "================================"

# Check Docker containers
check_service "jazyl-nginx"
check_service "jazyl-frontend"
check_service "jazyl-backend"
check_service "jazyl-postgres"
check_service "jazyl-redis"
check_service "jazyl-celery"

echo "--------------------------------"

# Check endpoints
check_endpoint "https://jazyl.tech" "Frontend"
check_endpoint "https://api.jazyl.tech/health" "Backend API"

echo "================================"