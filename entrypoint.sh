#!/bin/sh
set -e

# migrate
#bunx drizzle-kit migrate --config ./packages/db/drizzle.config.ts
bun run migrate

# run the app
bun run bot
