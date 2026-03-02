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

RUN npm ci

# ─────────────────────────────────────────────────────────────
#  Stage 2: Build Next.js application
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client using the LOCAL prisma@5 — never the global CLI
RUN node_modules/.bin/prisma generate

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

# OpenSSL and libc6-compat are required by the Prisma query engine binary on Alpine
RUN apk add --no-cache openssl libc6-compat

# Non-root user — principle of least privilege
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output only — no full node_modules in image
COPY --from=builder /app/public                               ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static

# Prisma schema + migrations (needed for migrate deploy at startup)
COPY --from=builder --chown=nextjs:nodejs /app/prisma         ./prisma

# ── Prisma runtime client (query engine) ──
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma  ./node_modules/@prisma

# ── Prisma CLI v5 (the project-local version) ──────────────────
# Copy the full prisma package — the WASM files live here alongside the JS.
# Do NOT copy node_modules/.bin/prisma: Docker resolves the symlink to its
# target file, whose __dirname becomes /app/node_modules/.bin/ and cannot
# find the sibling .wasm files. Call the real entry point directly instead.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma    ./node_modules/prisma

# SQLite data directory — permissions for volume mount
RUN mkdir -p /app/prisma/db && chown -R nextjs:nodejs /app/prisma

# Entrypoint: detects corrupt migration state, re-migrates, verifies, then starts
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

USER nextjs

EXPOSE 3001

# Self-healing entrypoint: detects corrupt DB → wipes → migrates → verifies → starts
CMD ["sh", "entrypoint.sh"]
