#!/bin/bash

# Create data directories for persistent storage

echo "📁 Setting up data directories for persistent storage..."

# Create directories if they don't exist
mkdir -p data/postgres
mkdir -p data/confluence

# Set proper permissions
# PostgreSQL needs write access
chmod 700 data/postgres 2>/dev/null || true
chmod 755 data/confluence 2>/dev/null || true

echo "✅ Data directories created:"
echo "   - ./data/postgres (PostgreSQL data)"
echo "   - ./data/confluence (Confluence data)"
echo ""
echo "💡 These directories will persist data across container restarts"
echo "   To reset everything, delete these directories"
