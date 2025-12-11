#!/bin/bash

# Fix connectivity issues by trying different approaches

echo "🔧 Fixing Confluence → Plugin Server Connectivity"
echo "==================================================="
echo ""

# Check if plugin server is running
if ! lsof -ti:3000 > /dev/null 2>&1; then
    echo "❌ Plugin server is not running"
    echo "   Start it with: make start"
    exit 1
fi

echo "✅ Plugin server is running locally"
echo ""

# Get Docker bridge IP
BRIDGE_IP=$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || echo "172.17.0.1")
echo "📋 Available connection methods:"
echo ""

# Test each method
METHODS=(
    "host.docker.internal:3000"
    "$BRIDGE_IP:3000"
    "localhost:3000"
)

WORKING_METHOD=""

for method in "${METHODS[@]}"; do
    HOST=$(echo $method | cut -d: -f1)
    PORT=$(echo $method | cut -d: -f2)
    echo -n "   Testing $method... "
    if docker exec confluence-server curl -s -f --max-time 3 http://$method/atlassian-connect.json > /dev/null 2>&1; then
        echo "✅ WORKS"
        WORKING_METHOD="http://$method/atlassian-connect.json"
        break
    else
        echo "❌"
    fi
done

echo ""

if [ -n "$WORKING_METHOD" ]; then
    echo "✅ Found working connection!"
    echo ""
    echo "📝 Use this URL in Confluence:"
    echo "   $WORKING_METHOD"
    echo ""
    echo "💡 To make this permanent, you can:"
    echo "   1. Use the URL above when installing"
    echo "   2. Or restart Confluence with host network mode"
else
    echo "❌ No working connection found"
    echo ""
    echo "🔧 Solutions to try:"
    echo ""
    echo "Option 1: Restart Confluence with host network mode"
    echo "  1. Stop Confluence: make confluence-stop"
    echo "  2. Edit docker-compose.yml:"
    echo "     Add 'network_mode: \"host\"' to confluence service"
    echo "     Remove 'ports:' section"
    echo "  3. Start: make confluence-start"
    echo "  4. Use: http://localhost:3000/atlassian-connect.json"
    echo ""
    echo "Option 2: Use ngrok tunnel"
    echo "  1. Start plugin server: make start"
    echo "  2. Start tunnel: make tunnel-ngrok"
    echo "  3. Use the ngrok HTTPS URL"
    echo ""
    echo "Option 3: Check firewall settings"
    echo "  macOS: System Settings → Firewall"
    echo "  Ensure Node.js has network access"
fi
