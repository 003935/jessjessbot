#!/bin/sh
set -e

echo "Running migrations..."
cd packages/database
bunx --bun prisma migrate deploy
cd ../..

echo "Starting bot..."
cd apps/bot
exec bun --bun src/index.ts
