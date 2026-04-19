FROM oven/bun:debian AS base

FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/database/package.json ./packages/database/
COPY packages/discord-api/package.json ./packages/discord-api/
COPY packages/valkey/package.json ./packages/valkey/
COPY apps/bot/package.json ./apps/bot/

RUN bun install --filter './apps/bot' --filter './packages/database' --filter './packages/discord-api' --filter './packages/valkey'

COPY apps/bot ./apps/bot/
COPY packages/database ./packages/database/
COPY packages/discord-api ./packages/discord-api/
COPY packages/valkey ./packages/valkey/
COPY packages/config-typescript ./packages/config-typescript/

ENV DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy
ENV DIRECT_URL=postgres://dummy:dummy@localhost:5432/dummy

RUN cd packages/database && bunx --bun prisma generate

FROM oven/bun:alpine AS runner
WORKDIR /app
RUN chown bun:bun /app

COPY --chown=bun:bun --from=builder /app .

USER bun

ENTRYPOINT []
CMD ["sh", "apps/bot/entrypoint.sh"]
