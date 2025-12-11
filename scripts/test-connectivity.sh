#!/bin/bash

# Test connectivity between Confluence and plugin server

echo "🔍 Testing connectivity..."
echo ""

# Check if plugin server is running
echo "1. Checking plugin server (local)..."
if curl -s http://localhost:3000/atlassian-connect.json > /dev/null 2>&1; then
    echo "   ✅ Plugin server is accessible at http://localhost:3000"
else
    echo "   ❌ Plugin server is NOT accessible"
    echo "      Start with: make start"
    exit 1
fi

# Check if Confluence is running
echo ""
echo "2. Checking Confluence Server (localhost:8090)..."
if curl -s http://localhost:8090/status > /dev/null 2>&1; then
    echo "   ✅ Confluence Server is running"
else
    echo "   ❌ Confluence Server is NOT running"
    echo "      Make sure to run: npm run confluence:start"
    exit 1
fi

# Test if Confluence container can reach plugin server
echo ""
echo "3. Testing connectivity from Confluence container to plugin server..."
if docker exec confluence-server curl -s http://host.docker.internal:3000/atlassian-connect.json > /dev/null 2>&1; then
    echo "   ✅ Confluence can reach plugin server via host.docker.internal"
    echo "   💡 Use this URL in Confluence: http://host.docker.internal:3000/atlassian-connect.json"
else
    echo "   ⚠️  Confluence container cannot reach plugin server"
    echo "   💡 Make sure plugin server is running locally: make start"
    echo "   💡 Then use: http://host.docker.internal:3000/atlassian-connect.json"
fi

# Test plugin endpoints
echo ""
echo "4. Testing plugin endpoints..."
ENDPOINTS=("/atlassian-connect.json" "/editor.html" "/renderer.html")
for endpoint in "${ENDPOINTS[@]}"; do
    if curl -s "http://localhost:3000$endpoint" > /dev/null 2>&1; then
        echo "   ✅ $endpoint - OK"
    else
        echo "   ❌ $endpoint - FAILED"
    fi
done

echo ""
echo "✅ Connectivity test complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Install plugin in Confluence:"
echo "      Settings → Manage Apps → Upload app"
echo "   2. Use one of these URLs:"
echo "      - http://localhost:3000/atlassian-connect.json (if Confluence allows localhost)"
echo "      - http://host.docker.internal:3000/atlassian-connect.json (recommended)"
echo "      - http://172.17.0.1:3000/atlassian-connect.json (fallback)"
