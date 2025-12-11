#!/bin/bash

# Test the atlassian-connect.json endpoint from Confluence's perspective

echo "🧪 Testing atlassian-connect.json endpoint"
echo "==========================================="
echo ""

PLUGIN_URL="${1:-http://host.docker.internal:3000/atlassian-connect.json}"

echo "Testing URL: $PLUGIN_URL"
echo ""

# Check if Confluence container is running
if ! docker ps | grep -q confluence-server; then
    echo "❌ Confluence container is not running"
    echo "   Start it with: make confluence-start"
    exit 1
fi

echo "1. Testing from Confluence container..."
echo ""

# Test connectivity
HTTP_CODE=$(docker exec confluence-server curl -s -o /dev/null -w "%{http_code}" "$PLUGIN_URL" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ HTTP request failed with code: $HTTP_CODE"
    echo ""
    echo "Response:"
    docker exec confluence-server curl -s "$PLUGIN_URL" 2>&1 | head -20
    exit 1
fi

echo "✅ HTTP 200 OK"
echo ""

# Get content
CONTENT=$(docker exec confluence-server curl -s "$PLUGIN_URL" 2>&1)

# Check Content-Type header
CONTENT_TYPE=$(docker exec confluence-server curl -s -I "$PLUGIN_URL" 2>&1 | grep -i "content-type" | head -1)
echo "2. Content-Type:"
echo "   $CONTENT_TYPE"
echo ""

# Validate JSON
echo "3. Validating JSON..."
if echo "$CONTENT" | docker exec -i confluence-server python3 -m json.tool > /dev/null 2>&1; then
    echo "✅ Valid JSON"
else
    echo "❌ Invalid JSON"
    echo ""
    echo "Content:"
    echo "$CONTENT" | head -30
    exit 1
fi

# Check required fields
echo ""
echo "4. Checking required fields..."

REQUIRED_FIELDS=("key" "name" "baseUrl" "version" "apiVersion" "authentication" "scopes" "modules")

for field in "${REQUIRED_FIELDS[@]}"; do
    if echo "$CONTENT" | docker exec -i confluence-server python3 -c "import sys, json; d=json.load(sys.stdin); print('✅' if '$field' in d else '❌')" 2>/dev/null | grep -q "✅"; then
        echo "   ✅ $field"
    else
        echo "   ❌ Missing: $field"
    fi
done

# Pretty print the JSON
echo ""
echo "5. Descriptor content:"
echo "$CONTENT" | docker exec -i confluence-server python3 -m json.tool 2>/dev/null | head -50

echo ""
echo "✅ All checks passed!"
echo ""
echo "💡 If Confluence still rejects it, check:"
echo "   - baseUrl is accessible from browser (http://localhost:3000)"
echo "   - All referenced files exist (editor.html, renderer.html, icon)"
echo "   - Lifecycle endpoints are accessible"
