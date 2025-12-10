#!/bin/bash

# Start Confluence Server using Docker Compose

echo "🚀 Starting Confluence Server..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo "❌ Error: docker-compose is not installed."
    echo "   Install it or use 'docker compose' (Docker Desktop includes it)"
    exit 1
fi

# Use docker compose (newer) or docker-compose (older)
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Setup data directories
echo "📁 Setting up data directories..."
./scripts/setup-data-dirs.sh

# Start services
echo "📦 Pulling Docker images (this may take a few minutes)..."
$COMPOSE_CMD pull postgres confluence

echo ""
echo "🏃 Starting PostgreSQL and Confluence Server..."
$COMPOSE_CMD up -d postgres confluence

echo ""
echo "⏳ Waiting for Confluence to start (this takes 2-3 minutes)..."
echo "   You can check logs with: docker logs -f confluence-server"
echo ""

# Wait for Confluence to be ready
MAX_WAIT=180
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s http://localhost:8090/status > /dev/null 2>&1; then
        echo ""
        echo "✅ Confluence Server is running!"
        echo ""
        echo "🌐 Access Confluence at: http://localhost:8090"
        echo ""
        echo "📝 Next steps:"
        echo "   1. Open http://localhost:8090 in your browser"
        echo "   2. Follow the setup wizard"
        echo "   3. Get a FREE 30-day evaluation license:"
        echo "      👉 https://my.atlassian.com/products/index?evaluation=true"
        echo "      (See GET_LICENSE.md for detailed instructions)"
        echo "   4. Configure Confluence for local development"
        echo ""
echo "📋 Useful commands:"
echo "   - View Confluence logs:    docker logs -f confluence-server"
echo "   - View PostgreSQL logs:    docker logs -f confluence-postgres"
echo "   - Stop all:                $COMPOSE_CMD stop"
echo "   - Start all:               $COMPOSE_CMD start"
echo "   - Remove all:              $COMPOSE_CMD down"
echo "   - Remove with data:        $COMPOSE_CMD down -v && rm -rf data/"
        exit 0
    fi
    echo -n "."
    sleep 2
    WAITED=$((WAITED + 2))
done

echo ""
echo "⚠️  Confluence is starting but not ready yet."
echo "   Check status: docker logs confluence-server"
echo "   Access at: http://localhost:8090"
exit 0
