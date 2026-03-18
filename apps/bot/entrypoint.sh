#!/bin/sh
set -e

echo "Running migrations..."
bun run --cwd packages/db db:migrate

echo "Starting bot..."
bun run --cwd apps/bot bot:start
