#!/bin/bash

# Backup script for Lumos data

set -e

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "💾 Creating backup in $BACKUP_DIR..."

# Backup PostgreSQL
echo "📊 Backing up PostgreSQL..."
docker-compose exec -T postgres pg_dump -U lumos lumos > "$BACKUP_DIR/postgres_backup.sql"

# Backup Neo4j
echo "🕸️ Backing up Neo4j..."
docker-compose exec -T neo4j neo4j-admin database dump neo4j --to-path=/tmp
docker cp $(docker-compose ps -q neo4j):/tmp/neo4j.dump "$BACKUP_DIR/neo4j_backup.dump"

echo "✅ Backup completed: $BACKUP_DIR"