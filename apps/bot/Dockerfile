FROM oven/bun:debian AS base

FROM base AS prepare
WORKDIR /app

COPY . .
RUN bunx turbo prune bot --docker

FROM base AS builder
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN bun install

FROM oven/bun:alpine AS runner
WORKDIR /app

COPY --chown=bun:bun --from=builder /app .

USER bun

CMD ["/entrypoint.sh"]
