FROM oven/bun:1.3.11-alpine AS builder

WORKDIR /api/build

COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY .env .env

RUN bun install

RUN bun run build

############################################
############################################
############################################

FROM oven/bun:1.3.11-alpine

WORKDIR /api

COPY --from=builder /api/build/node_modules ./node_modules
COPY --from=builder /api/build/package.json ./
COPY --from=builder /api/build/dist ./dist

COPY .env .env

ENTRYPOINT ["bun", "run", "start:prod"]