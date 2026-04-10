FROM oven/bun:debian AS base

FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/db/package.json ./packages/db/
COPY apps/bot/package.json ./apps/bot/

RUN bun install --filter './apps/bot' --filter './packages/db'

COPY apps/bot ./apps/bot/
COPY packages/db ./packages/db/
COPY packages/config-typescript ./packages/config-typescript/

ENV DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy

RUN cd packages/db && bunx --bun prisma generate

FROM oven/bun:alpine AS runner
WORKDIR /app
RUN chown bun:bun /app

COPY --chown=bun:bun --from=builder /app .

USER bun

ENTRYPOINT []
CMD ["sh", "apps/bot/entrypoint.sh"]
