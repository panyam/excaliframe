#!/bin/bash

# Check database status and see if tables are being created

echo "🔍 Checking Confluence database status..."
echo ""

# Check if PostgreSQL is running
if ! docker ps | grep -q confluence-postgres; then
    echo "❌ PostgreSQL is not running"
    exit 1
fi

# Check if database exists
echo "📊 Database Status:"
docker exec confluence-postgres psql -U confluence -lqt | cut -d \| -f 1 | grep -qw confluence && echo "✅ Database 'confluence' exists" || echo "❌ Database 'confluence' does not exist"

echo ""
echo "📋 Checking for Confluence tables..."

# List of key Confluence tables to check
TABLES=("spaces" "content" "bodycontent" "attachments" "cwd_user" "cwd_group")

for table in "${TABLES[@]}"; do
    EXISTS=$(docker exec confluence-postgres psql -U confluence -d confluence -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null)
    if [ "$EXISTS" = "t" ]; then
        echo "  ✅ Table '$table' exists"
    else
        echo "  ⚠️  Table '$table' does not exist yet"
    fi
done

echo ""
echo "📈 Table Count:"
TABLE_COUNT=$(docker exec confluence-postgres psql -U confluence -d confluence -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null)
echo "   Total tables: $TABLE_COUNT"

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo ""
    echo "✅ Database initialization is in progress or complete!"
    echo "   Confluence is creating tables - this is normal."
else
    echo ""
    echo "ℹ️  No tables found yet - Confluence hasn't started creating tables."
    echo "   Complete the setup wizard to initialize the database."
fi

echo ""
echo "💡 Note: 'relation does not exist' errors are NORMAL during initialization."
echo "   Confluence checks for tables before creating them."
