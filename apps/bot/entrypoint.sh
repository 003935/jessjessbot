#!/bin/sh
set -e

echo "Running migrations..."
cd packages/db
bunx drizzle-kit migrate
cd ../..

echo "Starting bot..."
cd apps/bot
bun run src/index.ts
