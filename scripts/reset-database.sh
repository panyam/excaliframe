#!/bin/bash

# Reset Confluence database - properly drop and recreate

set -e

echo "🔄 Resetting Confluence database..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if PostgreSQL is running
if ! docker ps | grep -q confluence-postgres; then
    echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    echo "   Start it with: make confluence-start"
    exit 1
fi

echo -e "${YELLOW}⚠️  This will delete all Confluence data!${NC}"
read -p "Are you sure? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "🛑 Stopping Confluence..."
if docker ps | grep -q confluence-server; then
    docker stop confluence-server
fi

echo ""
echo "🗑️  Dropping and recreating database..."

# Connect to PostgreSQL and drop/recreate database
docker exec confluence-postgres psql -U confluence -c "
    -- Terminate all connections to the database
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'confluence'
      AND pid <> pg_backend_pid();
" 2>/dev/null || true

# Drop database
docker exec confluence-postgres psql -U confluence -c "DROP DATABASE IF EXISTS confluence;" 2>/dev/null || true

# Create fresh database
docker exec confluence-postgres psql -U confluence -c "CREATE DATABASE confluence;" || {
    echo -e "${RED}❌ Failed to create database${NC}"
    exit 1
}

echo -e "${GREEN}✅ Database reset complete${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Start Confluence: make confluence-start"
echo "   2. Open http://localhost:8090"
echo "   3. Complete setup wizard with database:"
echo "      - Hostname: postgres"
echo "      - Port: 5432"
echo "      - Database: confluence"
echo "      - Username: confluence"
echo "      - Password: confluence"
