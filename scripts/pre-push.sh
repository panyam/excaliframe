#!/usr/bin/env bash
set -e

echo "Running unit tests..."
npm run test

echo "Running E2E tests..."
cd e2e && uv run pytest --browser chromium -x --timeout=120

echo "All tests passed."
