#!/bin/bash

# Quick status check of all services

echo "📊 Excaliframe Status Check"
echo "============================="
echo ""

# Check PostgreSQL
echo "🐘 PostgreSQL:"
if docker ps | grep -q confluence-postgres; then
    STATUS=$(docker inspect confluence-postgres --format='{{.State.Status}}')
    HEALTH=$(docker inspect confluence-postgres --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
    
    if [ "$STATUS" = "running" ]; then
        echo "   ✅ Running"
        if docker exec confluence-postgres pg_isready -U confluence > /dev/null 2>&1; then
            echo "   ✅ Database is ready"
        else
            echo "   ⚠️  Starting up (not ready yet)"
        fi
        if [ "$HEALTH" != "no-healthcheck" ]; then
            echo "   Health: $HEALTH"
        fi
    else
        echo "   ❌ Status: $STATUS"
    fi
else
    echo "   ❌ Not running"
fi

echo ""
echo "🐳 Confluence Server:"
if docker ps | grep -q confluence-server; then
    STATUS=$(docker inspect confluence-server --format='{{.State.Status}}')
    HEALTH=$(docker inspect confluence-server --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
    
    if [ "$STATUS" = "running" ]; then
        echo "   ✅ Running"
        if curl -s http://localhost:8090/status > /dev/null 2>&1; then
            echo "   ✅ Accessible at http://localhost:8090"
        else
            echo "   ⚠️  Starting up (not ready yet)"
        fi
        if [ "$HEALTH" != "no-healthcheck" ]; then
            echo "   Health: $HEALTH"
        fi
    else
        echo "   ❌ Status: $STATUS"
    fi
else
    echo "   ❌ Not running"
    echo "   Start with: npm run confluence:start"
fi

echo ""
echo "🔌 Plugin Server:"
if lsof -ti:3000 > /dev/null 2>&1; then
    PID=$(lsof -ti:3000)
    PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
    echo "   ✅ Running locally (PID: $PID, $PROCESS)"
    if curl -s http://localhost:3000/atlassian-connect.json > /dev/null 2>&1; then
        echo "   ✅ Accessible at http://localhost:3000"
        echo "   ✅ Accessible from Docker: http://host.docker.internal:3000"
    else
        echo "   ⚠️  Port in use but not responding"
    fi
else
    echo "   ❌ Not running"
    echo "   Start with: make start"
fi

echo ""
echo "📦 Webpack Watch:"
if pgrep -f "webpack.*watch" > /dev/null 2>&1; then
    echo "   ✅ Running locally - watching for changes"
else
    echo "   ⚠️  Not running (optional - run 'make dev' in another terminal)"
fi

echo ""
echo "📦 Build Status:"
if [ -f "dist/editor.html" ] && [ -f "dist/renderer.html" ] && [ -f "dist/server.js" ]; then
    echo "   ✅ Built files exist"
    echo "   Editor: $(ls -lh dist/editor.html | awk '{print $5}')"
    echo "   Renderer: $(ls -lh dist/renderer.html | awk '{print $5}')"
    echo "   Server: $(ls -lh dist/server.js | awk '{print $5}')"
else
    echo "   ❌ Build files missing"
    echo "   Build with: npm run build"
fi

echo ""
echo "🔗 Connectivity:"
if docker ps | grep -q confluence-server && lsof -ti:3000 > /dev/null 2>&1; then
    if docker exec confluence-server curl -s http://host.docker.internal:3000/atlassian-connect.json > /dev/null 2>&1; then
        echo "   ✅ Confluence can reach plugin server via host.docker.internal"
        echo "   💡 Install plugin using: http://host.docker.internal:3000/atlassian-connect.json"
    else
        echo "   ⚠️  Confluence cannot reach plugin server"
        echo "   💡 Make sure plugin server is running: make start"
        echo "   💡 Then use: http://host.docker.internal:3000/atlassian-connect.json"
    fi
else
    if [ ! -z "$(docker ps | grep confluence-server)" ] && [ -z "$(lsof -ti:3000)" ]; then
        echo "   ⚠️  Plugin server not running"
        echo "   💡 Start it with: make start"
    else
        echo "   ⚠️  Cannot test (services not running)"
    fi
fi

echo ""
