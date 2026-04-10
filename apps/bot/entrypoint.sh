#!/bin/sh
set -e

echo "Running migrations..."
cd packages/db
bunx --bun prisma migrate deploy
cd ../..

echo "Starting bot..."
cd apps/bot
bun run src/index.ts
