#!/bin/bash

# Comprehensive validation of the Confluence Connect app

echo "🔍 Comprehensive Confluence Connect App Validation"
echo "=================================================="
echo ""

ERRORS=0

# 1. Validate JSON schema
echo "1. Validating JSON schema..."
if node scripts/validate-connect-json.js > /dev/null 2>&1; then
    echo "   ✅ JSON schema is valid"
else
    echo "   ❌ JSON schema validation failed"
    node scripts/validate-connect-json.js
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Check plugin server is running
echo "2. Checking plugin server..."
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "   ✅ Plugin server is running"
else
    echo "   ❌ Plugin server is not running"
    echo "      Start it with: make start"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Test descriptor endpoint
echo "3. Testing descriptor endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/atlassian-connect.json 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Descriptor accessible (HTTP $HTTP_CODE)"
else
    echo "   ❌ Descriptor not accessible (HTTP $HTTP_CODE)"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Check Content-Type header
echo "4. Checking Content-Type header..."
CONTENT_TYPE=$(curl -s -I http://localhost:3000/atlassian-connect.json 2>/dev/null | grep -i "content-type" | head -1)
if echo "$CONTENT_TYPE" | grep -qi "application/json"; then
    echo "   ✅ Content-Type is correct: $CONTENT_TYPE"
else
    echo "   ⚠️  Content-Type may be incorrect: $CONTENT_TYPE"
fi
echo ""

# 5. Verify referenced files exist
echo "5. Checking referenced files..."
FILES=("editor.html" "renderer.html" "images/excalidraw-icon.svg")
for file in "${FILES[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/$file" 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ $file (HTTP $HTTP_CODE)"
    else
        echo "   ❌ $file not accessible (HTTP $HTTP_CODE)"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# 6. Test lifecycle endpoints
echo "6. Testing lifecycle endpoints..."
INSTALLED_CODE=$(curl -s -X POST -o /dev/null -w "%{http_code}" http://localhost:3000/lifecycle/installed 2>/dev/null)
UNINSTALLED_CODE=$(curl -s -X POST -o /dev/null -w "%{http_code}" http://localhost:3000/lifecycle/uninstalled 2>/dev/null)
if [ "$INSTALLED_CODE" = "204" ] || [ "$INSTALLED_CODE" = "200" ]; then
    echo "   ✅ /lifecycle/installed (HTTP $INSTALLED_CODE)"
else
    echo "   ❌ /lifecycle/installed failed (HTTP $INSTALLED_CODE)"
    ERRORS=$((ERRORS + 1))
fi
if [ "$UNINSTALLED_CODE" = "204" ] || [ "$UNINSTALLED_CODE" = "200" ]; then
    echo "   ✅ /lifecycle/uninstalled (HTTP $UNINSTALLED_CODE)"
else
    echo "   ❌ /lifecycle/uninstalled failed (HTTP $UNINSTALLED_CODE)"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 7. Test from Confluence container (if running)
if docker ps | grep -q confluence-server; then
    echo "7. Testing from Confluence container..."
    DESC_CODE=$(docker exec confluence-server curl -s -o /dev/null -w "%{http_code}" http://host.docker.internal:3000/atlassian-connect.json 2>/dev/null)
    if [ "$DESC_CODE" = "200" ]; then
        echo "   ✅ Confluence can reach descriptor (HTTP $DESC_CODE)"
    else
        echo "   ❌ Confluence cannot reach descriptor (HTTP $DESC_CODE)"
        ERRORS=$((ERRORS + 1))
    fi
    
    EDITOR_CODE=$(docker exec confluence-server curl -s -o /dev/null -w "%{http_code}" http://host.docker.internal:3000/editor.html 2>/dev/null)
    RENDERER_CODE=$(docker exec confluence-server curl -s -o /dev/null -w "%{http_code}" http://host.docker.internal:3000/renderer.html 2>/dev/null)
    ICON_CODE=$(docker exec confluence-server curl -s -o /dev/null -w "%{http_code}" http://host.docker.internal:3000/images/excalidraw-icon.svg 2>/dev/null)
    
    if [ "$EDITOR_CODE" = "200" ] && [ "$RENDERER_CODE" = "200" ] && [ "$ICON_CODE" = "200" ]; then
        echo "   ✅ Confluence can reach all referenced files"
    else
        echo "   ❌ Confluence cannot reach some files:"
        [ "$EDITOR_CODE" != "200" ] && echo "      - editor.html (HTTP $EDITOR_CODE)"
        [ "$RENDERER_CODE" != "200" ] && echo "      - renderer.html (HTTP $RENDERER_CODE)"
        [ "$ICON_CODE" != "200" ] && echo "      - icon.svg (HTTP $ICON_CODE)"
        ERRORS=$((ERRORS + 1))
    fi
    echo ""
fi

# Summary
echo "=================================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All validations passed!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Install plugin in Confluence:"
    echo "      URL: http://host.docker.internal:3000/atlassian-connect.json"
    echo "   2. If installation still fails, check Confluence logs:"
    echo "      make logs | grep -i 'connect\|app\|install'"
    exit 0
else
    echo "❌ Validation failed with $ERRORS error(s)"
    echo ""
    echo "💡 Fix the errors above and run again:"
    echo "   make validate-all"
    exit 1
fi
