FROM oven/bun:debian AS base

ENV TURBO_TELEMETRY_DISABLED=1

FROM base AS prepare
WORKDIR /app

RUN bun add -g turbo
COPY . .
RUN turbo prune dashboard --docker

FROM base AS builder
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN bun install

COPY --from=prepare /app/out/full/ .

ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production
ENV DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy
ENV BETTER_AUTH_SECRET=a_very_secret_dummy_value_for_build_purposes

RUN bun --bun run --cwd apps/dashboard dash:build

FROM oven/bun:alpine AS runner
WORKDIR /app
RUN chown bun:bun /app

COPY --chown=bun:bun --from=builder /app .

EXPOSE 3000/tcp
USER bun

CMD ["apps/dashboard/entrypoint.sh"]
