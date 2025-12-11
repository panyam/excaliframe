#!/bin/bash

# Quick start script - sets up everything for local development

set -e

echo "🚀 Excalfluence Quick Start"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "   Install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "   Please start Docker Desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker is installed and running${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js is installed ($(node --version))${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm is installed ($(npm --version))${NC}"

echo ""
echo "📦 Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "   Dependencies already installed"
fi

echo ""
echo "🏗️  Building plugin..."
npm run build

echo ""
echo "📁 Setting up data directories..."
./scripts/setup-data-dirs.sh

echo ""
echo "🐳 Starting PostgreSQL and Confluence Server..."
# Check if services are already running
if docker ps | grep -q confluence-server && docker ps | grep -q confluence-postgres; then
    echo "   Confluence services are already running"
else
    make confluence-start
    echo ""
    echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
    MAX_WAIT=60
    WAITED=0
    while [ $WAITED -lt $MAX_WAIT ]; do
        if docker exec confluence-postgres pg_isready -U confluence > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"
            break
        fi
        echo -n "."
        sleep 2
        WAITED=$((WAITED + 2))
    done
    
    echo ""
    echo -e "${YELLOW}⏳ Waiting for Confluence to be ready (this takes 2-3 minutes)...${NC}"
    echo "   You can check logs with: npm run confluence:logs"
    
    MAX_WAIT=180
    WAITED=0
    while [ $WAITED -lt $MAX_WAIT ]; do
        if curl -s http://localhost:8090/status > /dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}✅ Confluence Server is ready!${NC}"
            break
        fi
        echo -n "."
        sleep 2
        WAITED=$((WAITED + 2))
    done
    
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Confluence is still starting. Check logs: npm run confluence:logs${NC}"
    fi
fi

echo ""
echo "🌐 Starting plugin server locally..."
# Check if port 3000 is already in use
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use${NC}"
    echo "   Plugin server might already be running"
else
    echo "   Starting server in background..."
    npm start > /tmp/excalfluence-server.log 2>&1 &
    SERVER_PID=$!
    sleep 2
    
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Plugin server started (PID: $SERVER_PID)${NC}"
        echo "   Logs: tail -f /tmp/excalfluence-server.log"
    else
        echo -e "${RED}❌ Failed to start plugin server${NC}"
        echo "   Check logs: cat /tmp/excalfluence-server.log"
        exit 1
    fi
fi

echo ""
echo "🔍 Testing connectivity..."
./scripts/test-connectivity.sh

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Open Confluence: http://localhost:8090"
echo "   2. Complete Confluence setup wizard (if first time)"
echo "   3. Get evaluation license: https://my.atlassian.com/products/index?evaluation=true"
echo "   4. Install plugin:"
echo "      - Go to Settings → Manage Apps → Upload app"
echo "      - Use: http://host.docker.internal:3000/atlassian-connect.json"
echo ""
echo "🛠️  Useful commands:"
echo "   - View Confluence logs: make logs"
echo "   - View plugin logs: make logs-plugin"
echo "   - View webpack logs: make logs-webpack"
echo "   - View all logs: make logs-all"
echo "   - Stop all services: make confluence-stop"
echo ""
echo "🎨 Start developing!"
echo "   - Edit files in src/ - changes are auto-detected!"
echo "   - Webpack rebuilds automatically (watch mode in Docker)"
echo "   - Plugin server restarts automatically on file changes"
echo "   - No need to restart Docker containers!"
