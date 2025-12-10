#!/bin/bash

# Check Docker Desktop resource allocation

echo "🐳 Docker Resource Check"
echo "========================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

# Get Docker system info
echo "📊 Docker System Information:"
echo ""

# Total memory available to Docker
TOTAL_MEM=$(docker system info --format '{{.MemTotal}}' 2>/dev/null || echo "unknown")
if [ "$TOTAL_MEM" != "unknown" ]; then
    TOTAL_MEM_GB=$(echo "scale=2; $TOTAL_MEM / 1024 / 1024 / 1024" | bc)
    echo "  Total Memory: ${TOTAL_MEM_GB} GB"
else
    echo "  Total Memory: Unable to determine"
fi

# CPU count
CPU_COUNT=$(docker system info --format '{{.NCPU}}' 2>/dev/null || echo "unknown")
echo "  CPU Cores: $CPU_COUNT"

echo ""
echo "📈 Current Container Resource Usage:"
echo ""

# Check Confluence container
if docker ps | grep -q confluence-server; then
    echo "Confluence Server:"
    docker stats --no-stream --format "  Memory: {{.MemUsage}} | CPU: {{.CPUPerc}}" confluence-server 2>/dev/null || echo "  Unable to get stats"
else
    echo "Confluence Server: Not running"
fi

# Check PostgreSQL container
if docker ps | grep -q confluence-postgres; then
    echo "PostgreSQL:"
    docker stats --no-stream --format "  Memory: {{.MemUsage}} | CPU: {{.CPUPerc}}" confluence-postgres 2>/dev/null || echo "  Unable to get stats"
else
    echo "PostgreSQL: Not running"
fi

echo ""
echo "💡 Recommended Docker Desktop Settings:"
echo ""
echo "  Memory:"
echo "    Minimum: 6 GB"
echo "    Recommended: 8 GB"
echo "    Current: ${TOTAL_MEM_GB} GB"
echo ""
echo "  CPUs:"
echo "    Minimum: 4 cores"
echo "    Recommended: 6+ cores"
echo "    Current: $CPU_COUNT cores"
echo ""

# Check if resources are sufficient
SUFFICIENT=true

if [ "$TOTAL_MEM" != "unknown" ]; then
    TOTAL_MEM_BYTES=$(echo "$TOTAL_MEM" | awk '{print $1}')
    MIN_MEM_BYTES=$((6 * 1024 * 1024 * 1024))  # 6GB in bytes
    
    if [ "$TOTAL_MEM_BYTES" -lt "$MIN_MEM_BYTES" ]; then
        echo "⚠️  WARNING: Docker memory is below recommended minimum (6GB)"
        SUFFICIENT=false
    fi
fi

if [ "$CPU_COUNT" != "unknown" ] && [ "$CPU_COUNT" -lt 4 ]; then
    echo "⚠️  WARNING: Docker CPU cores is below recommended minimum (4)"
    SUFFICIENT=false
fi

if [ "$SUFFICIENT" = true ]; then
    echo "✅ Docker resources appear sufficient"
else
    echo ""
    echo "📝 How to increase Docker Desktop resources:"
    echo ""
    echo "  macOS:"
    echo "    1. Open Docker Desktop"
    echo "    2. Click Settings (gear icon)"
    echo "    3. Go to Resources → Advanced"
    echo "    4. Increase Memory to at least 6GB (8GB recommended)"
    echo "    5. Increase CPUs to at least 4 (6+ recommended)"
    echo "    6. Click 'Apply & Restart'"
    echo ""
    echo "  After changing settings, restart containers:"
    echo "    make confluence-restart"
fi

echo ""
