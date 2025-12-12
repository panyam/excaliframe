#!/bin/sh
# Entrypoint script for cloudflared that captures tunnel URL and updates atlassian-connect.json

CONNECT_JSON="/app/atlassian-connect.json"
TUNNEL_TARGET="${TUNNEL_TARGET:-http://plugin:3000}"

echo "Starting cloudflared tunnel to $TUNNEL_TARGET..."

# Start cloudflared and capture output
cloudflared tunnel --no-autoupdate --url "$TUNNEL_TARGET" 2>&1 | while read -r line; do
    echo "$line"

    # Look for the tunnel URL in the output
    if echo "$line" | grep -q 'https://.*\.trycloudflare\.com'; then
        TUNNEL_URL=$(echo "$line" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com')

        if [ -n "$TUNNEL_URL" ] && [ -f "$CONNECT_JSON" ]; then
            echo ""
            echo "============================================"
            echo "TUNNEL URL DETECTED: $TUNNEL_URL"
            echo "============================================"

            # Update baseUrl in atlassian-connect.json
            # Use awk to avoid sed's temp file issue with Docker bind mounts
            TEMP_CONTENT=$(awk -v url="$TUNNEL_URL" '{gsub(/"baseUrl": "[^"]*"/, "\"baseUrl\": \"" url "\"")}1' "$CONNECT_JSON")
            printf '%s\n' "$TEMP_CONTENT" > "$CONNECT_JSON"

            echo "Updated atlassian-connect.json with new baseUrl"
            echo ""
            echo "Install in Confluence Cloud:"
            echo "  ${TUNNEL_URL}/confluence/atlassian-connect.json"
            echo ""
            echo "============================================"
        fi
    fi
done
