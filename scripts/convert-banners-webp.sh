#!/usr/bin/env bash
# Post-deploy: convert uploaded banners → WebP and rewrite DB image_* paths.
# Static /img/banners/*.webp ship inside the web image (converted in git).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dfijdsif/app}"
ENV_FILE="${ENV_FILE:-/var/www/dfijdsif/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.prod.yml}"

cd "$APP_DIR"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

echo "==> convert uploads/banners → WebP + rewrite banners.image_* in DB"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T \
  -e WEB_PUBLIC_DIR=/data/web-public \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e KEEP_ORIGINALS="${KEEP_ORIGINALS:-0}" \
  api node dist/scripts/convert-banners-webp.js

# Also convert static banners in the git checkout (for sanity / next local builds)
if [ -d "$APP_DIR/apps/web/public/img/banners" ]; then
  echo "==> convert checkout apps/web/public/img/banners"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps \
    -e WEB_PUBLIC_DIR=/work-public \
    -e DATABASE_URL= \
    -v "$APP_DIR/apps/web/public:/work-public" \
    api node dist/scripts/convert-banners-webp.js || true
fi

echo "==> banners webp conversion done"
