# Simple Dockerfile for Coolify / manual docker deploy.
# SQLite data lives in /app/data — mount a persistent volume there.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf .next -- \
    && node node_modules/.bin/next build

FROM base AS proddeps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DB_PATH=/app/data/app.db
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Guaranteed copy of prod deps (includes native better-sqlite3)
COPY --from=proddeps /app/node_modules ./node_modules
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server.js"]