# ─────────────────────────────────────────────────────────────
#  Stage 1: Install dependencies
#  Uses npm ci (clean install) for reproducible, cache-friendly builds
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Native build tools: required by bcryptjs (node-pre-gyp)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

# --prefer-offline uses cache when available; --frozen-lockfile ensures reproducibility
RUN npm ci

# ─────────────────────────────────────────────────────────────
#  Stage 2: Build Next.js application
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (SQLite provider)
RUN npx prisma generate

# Production build — outputs .next/standalone + .next/static
RUN npm run build

# ─────────────────────────────────────────────────────────────
#  Stage 3: Minimal production runner (~200MB vs ~1.5GB full)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Internal port — must match docker-compose and NGINX proxy_pass
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Non-root user — principle of least privilege
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output only — no full node_modules in image
COPY --from=builder /app/public                               ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static

# Prisma schema + migrations (needed for migrate deploy at startup)
COPY --from=builder --chown=nextjs:nodejs /app/prisma         ./prisma

# Prisma runtime client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma  ./node_modules/@prisma

# SQLite data directory — permissions for volume mount
RUN mkdir -p /app/prisma && chown nextjs:nodejs /app/prisma

USER nextjs

EXPOSE 3001

# Run any pending migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
