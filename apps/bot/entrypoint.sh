#!/bin/sh
set -e


# migrate
echo "Running migrations..."
bun run --cwd packages/db db:migrate

echo "Starting bot..."
bun run turbo bot:start
