#!/bin/bash
# Script to update baseUrl in atlassian-connect.json with the tunnel URL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONNECT_JSON="$PROJECT_DIR/atlassian-connect.json"

# Check if a URL was provided as argument
if [ -n "$1" ]; then
    NEW_URL="$1"
else
    # Try to get URL from tunnel logs
    echo "Fetching tunnel URL from Docker logs..."
    NEW_URL=$(docker compose -f "$PROJECT_DIR/docker-compose.cloud.yml" logs tunnel 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1)

    if [ -z "$NEW_URL" ]; then
        echo "Error: Could not find tunnel URL in logs."
        echo "Usage: $0 [tunnel-url]"
        echo "Example: $0 https://random-words.trycloudflare.com"
        exit 1
    fi
fi

echo "Updating baseUrl to: $NEW_URL"

# Update the baseUrl in atlassian-connect.json
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|\"baseUrl\": \"[^\"]*\"|\"baseUrl\": \"$NEW_URL\"|g" "$CONNECT_JSON"
else
    # Linux
    sed -i "s|\"baseUrl\": \"[^\"]*\"|\"baseUrl\": \"$NEW_URL\"|g" "$CONNECT_JSON"
fi

echo "Updated $CONNECT_JSON"
echo ""
echo "Next steps:"
echo "1. Rebuild the plugin: docker compose -f docker-compose.cloud.yml up --build"
echo "2. Install in Confluence Cloud using: $NEW_URL/atlassian-connect.json"
