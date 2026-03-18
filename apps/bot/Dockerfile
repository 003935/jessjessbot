FROM oven/bun:debian AS base

ENV TURBO_TELEMETRY_DISABLED=1

FROM base AS prepare
WORKDIR /app

RUN bun add -g turbo
COPY . .
RUN turbo prune bot --docker

FROM base AS builder
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN bun install

COPY --from=prepare /app/out/full/ .

FROM oven/bun:alpine AS runner
WORKDIR /app
RUN chown bun:bun /app

COPY --chown=bun:bun --from=builder /app .

USER bun

CMD ["apps/bot/entrypoint.sh"]
