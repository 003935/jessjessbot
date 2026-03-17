#!/bin/sh
set -e

# migrate
bunx drizzle-kit migrate --config ./drizzle.config.ts

# run the app
bun run start
