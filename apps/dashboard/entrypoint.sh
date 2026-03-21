#!/bin/sh
set -e

echo "Running migrations..."
bun run --cwd packages/db db:migrate

echo "Starting dashboard..."
bun run --cwd apps/dashboard build/index.js
