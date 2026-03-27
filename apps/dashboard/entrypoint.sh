#!/bin/sh
set -e

echo "Running migrations..."
cd db
bun install drizzle-orm drizzle-kit pg
bun run drizzle-kit migrate
cd ..

echo "Starting dashboard..."
bun run build/index.js
