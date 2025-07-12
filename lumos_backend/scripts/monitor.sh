#!/bin/bash

# Monitoring script for Lumos services

echo "📊 Lumos Service Status"
echo "====================="

# Check if services are running
services=("lumos-backend" "postgres" "neo4j" "redis")

for service in "${services[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Not running"
    fi
done

echo ""
echo "🏥 Health Checks"
echo "==============="

# Backend health
if curl -s http://localhost:8000/health | jq -e '.status == "healthy"' >/dev/null 2>&1; then
    echo "✅ Backend: Healthy"
else
    echo "❌ Backend: Unhealthy"
fi

echo ""
echo "📝 Recent Logs"
echo "=============="

# Show last 5 lines of each service
for service in "${services[@]}"; do
    echo "--- $service ---"
    docker-compose logs --tail=5 "$service"
    echo ""
done 