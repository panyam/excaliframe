#!/bin/bash

# Debug connectivity between Confluence and plugin server

echo "🔍 Debugging Confluence → Plugin Server Connectivity"
echo "===================================================="
echo ""

# Check if plugin server is running locally
echo "1. Checking plugin server (local)..."
if lsof -ti:3000 > /dev/null 2>&1; then
    PID=$(lsof -ti:3000 | head -1)
    PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
    echo "   ✅ Plugin server is running (PID: $PID, $PROCESS)"
    
    # Test local access
    if curl -s http://localhost:3000/atlassian-connect.json > /dev/null 2>&1; then
        echo "   ✅ Accessible locally at http://localhost:3000"
    else
        echo "   ❌ NOT accessible locally - server may not be responding"
        echo "      Check: curl http://localhost:3000/atlassian-connect.json"
    fi
else
    echo "   ❌ Plugin server is NOT running"
    echo "      Start it with: make start"
    exit 1
fi

echo ""
echo "2. Checking Confluence container..."
if docker ps | grep -q confluence-server; then
    echo "   ✅ Confluence container is running"
else
    echo "   ❌ Confluence container is NOT running"
    echo "      Start it with: make confluence-start"
    exit 1
fi

echo ""
echo "3. Testing connectivity from Confluence container..."

# Test host.docker.internal
echo "   Testing host.docker.internal:3000..."
if docker exec confluence-server curl -s -f --max-time 5 http://host.docker.internal:3000/atlassian-connect.json > /dev/null 2>&1; then
    echo "   ✅ SUCCESS: Confluence can reach plugin via host.docker.internal:3000"
    echo ""
    echo "   💡 Use this URL in Confluence:"
    echo "      http://host.docker.internal:3000/atlassian-connect.json"
    exit 0
else
    echo "   ❌ FAILED: Cannot reach via host.docker.internal:3000"
fi

# Test alternative methods
echo ""
echo "   Testing alternative methods..."

# Try Docker bridge IP
BRIDGE_IP=$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || echo "172.17.0.1")
echo "   Testing Docker bridge IP: $BRIDGE_IP:3000..."
if docker exec confluence-server curl -s -f --max-time 5 http://$BRIDGE_IP:3000/atlassian-connect.json > /dev/null 2>&1; then
    echo "   ✅ SUCCESS: Confluence can reach plugin via $BRIDGE_IP:3000"
    echo ""
    echo "   💡 Use this URL in Confluence:"
    echo "      http://$BRIDGE_IP:3000/atlassian-connect.json"
    exit 0
else
    echo "   ❌ FAILED: Cannot reach via $BRIDGE_IP:3000"
fi

# Try localhost (unlikely to work but worth checking)
echo "   Testing localhost:3000..."
if docker exec confluence-server curl -s -f --max-time 5 http://localhost:3000/atlassian-connect.json > /dev/null 2>&1; then
    echo "   ✅ SUCCESS: Confluence can reach plugin via localhost:3000"
    echo ""
    echo "   💡 Use this URL in Confluence:"
    echo "      http://localhost:3000/atlassian-connect.json"
    exit 0
else
    echo "   ❌ FAILED: Cannot reach via localhost:3000"
fi

echo ""
echo "❌ All connectivity tests failed!"
echo ""
echo "🔧 Troubleshooting steps:"
echo ""
echo "1. Verify plugin server is running:"
echo "   curl http://localhost:3000/atlassian-connect.json"
echo ""
echo "2. Check Docker network configuration:"
echo "   docker network inspect bridge"
echo ""
echo "3. Try adding network_mode to docker-compose.yml:"
echo "   (See troubleshooting guide)"
echo ""
echo "4. Check if firewall is blocking:"
echo "   lsof -i :3000"
echo ""
echo "5. Verify extra_hosts is set in docker-compose.yml:"
echo "   Should have: extra_hosts:"
echo "                 - \"host.docker.internal:host-gateway\""
