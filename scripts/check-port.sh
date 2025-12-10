#!/bin/bash

# Check if a port is in use and optionally kill the process

PORT=${1:-3000}
ACTION=${2:-check}

if lsof -ti:$PORT > /dev/null 2>&1; then
    PID=$(lsof -ti:$PORT | head -1)
    PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
    
    if [ "$ACTION" = "kill" ]; then
        echo "Port $PORT is in use by PID $PID ($PROCESS)"
        kill -9 $PID 2>/dev/null
        echo "Killed process $PID"
        exit 0
    else
        echo "Port $PORT is in use by PID $PID ($PROCESS)"
        exit 1
    fi
else
    echo "Port $PORT is available"
    exit 0
fi
