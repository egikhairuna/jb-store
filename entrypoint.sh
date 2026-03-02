#!/bin/sh
# entrypoint.sh — Production entrypoint for POS system
# Runs Prisma migrations, validates the DB state, then starts the app.
set -e

DB_PATH="${DATABASE_URL#file:}"   # strip "file:" prefix → /app/prisma/pos.db
PRISMA="node node_modules/prisma/build/index.js"

echo "==> Checking database at: $DB_PATH"

# ── Detect corrupt migration state ─────────────────────────────
# If the DB exists but is missing the User table, a previous run crashed
# mid-migration (schema engine recorded migrations without running SQL).
# The only safe recovery for SQLite is to wipe and re-migrate.
if [ -f "$DB_PATH" ]; then
  TABLE_COUNT=$(node -e "
    const { PrismaClient } = require('.prisma/client');
    const p = new PrismaClient();
    p.\$queryRawUnsafe(\"SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name != '_prisma_migrations';\")
      .then(r => { console.log(r[0].c); p.\$disconnect(); })
      .catch(() => { console.log(0); p.\$disconnect(); });
  " 2>/dev/null || echo "0")

  if [ "$TABLE_COUNT" = "0" ]; then
    echo "==> WARNING: DB exists but has no app tables (corrupt migration state)."
    echo "==> Wiping corrupt DB and re-running migrations from scratch..."
    rm -f "$DB_PATH" "${DB_PATH}-shm" "${DB_PATH}-wal"
  else
    echo "==> DB OK — $TABLE_COUNT app table(s) found."
  fi
else
  echo "==> No DB file found — will create fresh."
fi

# ── Run migrations ──────────────────────────────────────────────
echo "==> Running: prisma migrate deploy"
$PRISMA migrate deploy

# ── Verify migration result ─────────────────────────────────────
TABLE_COUNT=$(node -e "
  const { PrismaClient } = require('.prisma/client');
  const p = new PrismaClient();
  p.\$queryRawUnsafe(\"SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name != '_prisma_migrations';\")
    .then(r => { console.log(r[0].c); p.\$disconnect(); })
    .catch(e => { console.error(e); process.exit(1); });
" 2>/dev/null)

if [ "$TABLE_COUNT" = "0" ]; then
  echo "==> ERROR: Migration ran but no app tables were created. Aborting."
  exit 1
fi

echo "==> Migration complete — $TABLE_COUNT app tables ready."
echo "==> Starting Next.js server..."
exec node server.js
