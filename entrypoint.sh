#!/bin/sh

# migrate
bunx drizzle-kit migrate --config ./drizzle.config.ts

# run the app
bun run start
