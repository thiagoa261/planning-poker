FROM oven/bun:1.3.11-alpine AS builder

WORKDIR /build

COPY package.json bun.lock nuxt.config.ts .env ./
COPY public ./public
COPY app ./app

RUN bun install -g @nuxt/cli
RUN bun install
RUN bun run build

############################################
############################################
############################################

FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY --from=builder /build/package.json ./
COPY --from=builder /build/.output ./.output

ENTRYPOINT ["bun", ".output/server/index.mjs"]