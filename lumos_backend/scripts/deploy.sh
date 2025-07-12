#!/bin/bash
set -e

echo "🚀 Starting Lumos Hybrid RAG deployment..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create one from .env.example"
    exit 1
fi

# Build and start services
echo "📦 Building Docker images..."
docker-compose build --no-cache

echo "🔄 Starting services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services..."
sleep 30

# Run migrations
echo "🗃️ Running database migrations..."
docker-compose exec lumos-backend alembic upgrade head

# Health check
echo "🏥 Checking health..."
for i in {1..10}; do
    if curl -f http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    else
        echo "⏳ Attempt $i/10: Backend not ready..."
        sleep 10
    fi
done

echo "🎉 Deployment completed!"
echo "📍 Backend: http://localhost:8000"
echo "📍 API Docs: http://localhost:8000/docs"
echo "📍 Neo4j: http://localhost:7474"