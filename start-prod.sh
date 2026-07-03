#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Building project in production mode ==="
bun run build

echo "=== Starting all services concurrently ==="

# Store PIDs of background processes
PIDs=()

# Cleanup function to kill all background processes on Ctrl+C (SIGINT/SIGTERM)
cleanup() {
  echo ""
  echo "=== Stopping all services... ==="
  for pid in "${PIDs[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
    fi
  done
  exit 0
}

# Bind cleanup function to signals
trap cleanup SIGINT SIGTERM EXIT

# Start server
bun run --cwd apps/server start &
PIDs+=($!)

# Start worker
bun run --cwd apps/worker start &
PIDs+=($!)

# Start web preview
bun run --cwd apps/web serve &
PIDs+=($!)

# Wait for all background processes to finish
wait
