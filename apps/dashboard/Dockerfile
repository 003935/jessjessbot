FROM oven/bun:debian AS base

FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/database/package.json ./packages/database/
COPY packages/discord-api/package.json ./packages/discord-api/
COPY packages/valkey/package.json ./packages/valkey/
COPY apps/dashboard/package.json ./apps/dashboard/

RUN bun install --filter './apps/dashboard' --filter './packages/database' --filter './packages/discord-api' --filter './packages/valkey'

COPY apps/dashboard ./apps/dashboard/
COPY packages/database ./packages/database/
COPY packages/discord-api ./packages/discord-api/
COPY packages/valkey ./packages/valkey/
COPY packages/config-typescript ./packages/config-typescript/

ENV DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy
ENV DIRECT_URL=postgres://dummy:dummy@localhost:5432/dummy
ENV BETTER_AUTH_SECRET=a_very_secret_dummy_value_for_build_purposes

RUN cd packages/database && bunx --bun prisma generate

ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production

RUN bun --bun run --cwd apps/dashboard build

FROM oven/bun:alpine AS runner
WORKDIR /app
RUN chown bun:bun /app

COPY --chown=bun:bun --from=builder /app/apps/dashboard/build ./build

EXPOSE 3000/tcp
USER bun

CMD ["bun", "--bun", "build/index.js"]
