#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Kill dev processes for this project (best-effort)
# Note: avoid broad pkill patterns; keep them scoped.

echo "[restart] killing dev processes (best-effort)..."

# 1) Graceful shutdown (SIGTERM)
PIDS="$( (pgrep -f "${ROOT_DIR}/api" || true; pgrep -f "${ROOT_DIR}/web" || true) | tr '\n' ' ' | xargs -n1 2>/dev/null | sort -u | tr '\n' ' ' )"
if [[ -n "${PIDS// }" ]]; then
  echo "[restart] SIGTERM -> ${PIDS}"
  kill ${PIDS} || true
fi

# Also try to gracefully stop common dev commands scoped to this repo
pkill -f "${ROOT_DIR}.*turbo run dev" || true
pkill -f "${ROOT_DIR}.*tsx watch src/index.ts" || true
pkill -f "${ROOT_DIR}.*vite --host 127.0.0.1" || true

# 2) Wait briefly
sleep 2

# 3) Escalate to SIGKILL (-9) only for remaining PIDs
if [[ -n "${PIDS// }" ]]; then
  STILL=""
  for pid in ${PIDS}; do
    if kill -0 "$pid" 2>/dev/null; then
      STILL+=" $pid"
    fi
  done
  if [[ -n "${STILL// }" ]]; then
    echo "[restart] SIGKILL (-9) ->${STILL}"
    kill -9 ${STILL} || true
  fi
fi

echo "[restart] starting dev (web=5175, api=4318)..."
cd "$ROOT_DIR"

# Force ports (web already fixed via package.json; api via env)
PORT=4318 HOST=127.0.0.1 pnpm dev
