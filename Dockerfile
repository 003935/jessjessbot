FROM oven/bun:debian AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including dev) for building
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source code and build
COPY . .

ENV NODE_ENV=production

# Production stage
FROM oven/bun:alpine AS runner

WORKDIR /app

COPY --chown=bun:bun --from=builder /app/src src/
COPY --chown=bun:bun --from=builder /app/commands commands/
COPY --chown=bun:bun --from=builder /app/package.json package.json
COPY --chown=bun:bun --from=builder /app/bun.lock* bun.lock*
COPY --chown=bun:bun --from=builder /app/node_modules node_modules/

COPY --chown=bun:bun --from=builder /app/drizzle drizzle/
COPY --chown=bun:bun --from=builder /app/drizzle.config.ts drizzle.config.ts

COPY --chown=bun:bun --from=builder /app/entrypoint.sh entrypoint.sh

USER bun

CMD ["/entrypoint.sh"]
