#!/usr/bin/env bash
# Postgres logical backup for x-reviewer (local Docker or remote via DATABASE_URL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1090
  source .env
  set +a
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/xreviewer-${STAMP}.sql.gz"

CONTAINER="${POSTGRES_CONTAINER:-xreviewer-postgres}"
USER_NAME="${POSTGRES_USER:-xreviewer}"
DB_NAME="${POSTGRES_DB:-xreviewer}"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "→ dump from container $CONTAINER → $FILE"
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-xreviewer}" "$CONTAINER" \
    pg_dump -U "$USER_NAME" -d "$DB_NAME" --no-owner --no-acl \
    | gzip -c >"$FILE"
elif [[ -n "${DATABASE_URL:-}" ]]; then
  echo "→ dump via DATABASE_URL → $FILE"
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -c >"$FILE"
  else
    echo "pg_dump not found and container $CONTAINER is not running" >&2
    exit 1
  fi
else
  echo "Neither Docker container $CONTAINER nor DATABASE_URL available" >&2
  exit 1
fi

SIZE="$(du -h "$FILE" | awk '{print $1}')"
echo "✓ backup ok ($SIZE): $FILE"

# Keep last N backups (default 14)
KEEP="${BACKUP_KEEP:-14}"
ls -1t "$OUT_DIR"/xreviewer-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f || true
