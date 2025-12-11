#!/bin/bash

# Monitor Confluence startup progress

echo "🔍 Monitoring Confluence startup..."
echo "===================================="
echo ""

START_TIME=$(date +%s)
LAST_LOG_TIME=""

while true; do
    # Check if container is running
    if ! docker ps | grep -q confluence-server; then
        echo "❌ Confluence container is not running"
        exit 1
    fi
    
    # Get latest log line
    LATEST_LOG=$(docker logs --tail 1 confluence-server 2>&1)
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    # Only print if log changed
    if [ "$LATEST_LOG" != "$LAST_LOG_TIME" ]; then
        printf "[%3ds] %s\n" "$ELAPSED" "$LATEST_LOG"
        LAST_LOG_TIME="$LATEST_LOG"
    fi
    
    # Check for startup completion
    if echo "$LATEST_LOG" | grep -q "Server startup"; then
        echo ""
        echo "✅ Confluence started successfully!"
        echo "⏱️  Total startup time: ${ELAPSED} seconds"
        break
    fi
    
    # Check for errors
    if echo "$LATEST_LOG" | grep -qi "error\|exception\|failed"; then
        echo ""
        echo "⚠️  Possible error detected:"
        echo "$LATEST_LOG"
    fi
    
    # Timeout after 5 minutes
    if [ $ELAPSED -gt 300 ]; then
        echo ""
        echo "⏱️  Startup taking longer than expected (>5 minutes)"
        echo "   Check logs: make logs"
        exit 1
    fi
    
    sleep 2
done
