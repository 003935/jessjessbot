FROM oven/bun:debian AS base

FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/db/package.json ./packages/db/
COPY apps/dashboard/package.json ./apps/dashboard/

RUN bun install --filter './apps/dashboard' --filter './packages/db'

COPY apps/dashboard ./apps/dashboard/
COPY packages/db ./packages/db/
COPY packages/config-typescript ./packages/config-typescript/

ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production
ENV DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy
ENV BETTER_AUTH_SECRET=a_very_secret_dummy_value_for_build_purposes

RUN bun --bun run --cwd apps/dashboard build

FROM oven/bun:alpine AS runner
WORKDIR /app
RUN chown bun:bun /app

COPY --chown=bun:bun --from=builder /app/apps/dashboard/entrypoint.sh ./entrypoint.sh
COPY --chown=bun:bun --from=builder /app/apps/dashboard/build ./build
COPY --chown=bun:bun --from=builder /app/packages/db/drizzle.config.ts ./db/drizzle.config.ts
COPY --chown=bun:bun --from=builder /app/packages/db/drizzle ./db/drizzle

EXPOSE 3000/tcp
USER bun

CMD ["./entrypoint.sh"]
