#!/usr/bin/env bash
#
# Production deploy for lorawan-analyzer.
#
# Runs ON the monitoring.buoy.fish box, as root (via `sudo bash deploy/deploy.sh`),
# invoked by the CI/CD workflow AFTER it has fast-forwarded the checkout to
# origin/main. Rebuilds and restarts ONLY the `analyzer` service — postgres and
# mosquitto keep running, and the DB migration runs automatically on analyzer
# startup (runMigrations() at boot). Idempotent and safe to re-run.
set -euo pipefail

# Repo root = parent of this script's dir, regardless of CWD.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HOST_PORT=15337  # docker-compose maps host 15337 -> container 3000

echo "==> Rebuilding + restarting the analyzer service"
docker compose up -d --build analyzer

echo "==> Pruning dangling images"
docker image prune -f || true

echo "==> Waiting for the analyzer API to respond"
up=false
for _ in $(seq 1 30); do
  # The API requires auth, so any HTTP status (200/302/401) means it's listening.
  # A "000" from curl means no connection yet.
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${HOST_PORT}/" 2>/dev/null || echo 000)"
  if [ "$code" != "000" ]; then
    echo "    analyzer is up (HTTP ${code})"
    up=true
    break
  fi
  sleep 2
done

if [ "$up" != true ]; then
  echo "ERROR: analyzer did not respond on :${HOST_PORT} within 60s" >&2
  docker compose logs --tail 60 analyzer >&2
  exit 1
fi

echo "==> Deploy complete: $(git rev-parse --short HEAD)"
