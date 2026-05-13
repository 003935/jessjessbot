#!/bin/sh
set -e

echo "Running migrations..."
cd packages/database
bunx --bun prisma migrate deploy
cd ../..

echo "Starting bot..."
cd apps/bot
bun --bun src/index.ts
