#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Kill dev processes for this project (best-effort)
# Note: avoid broad pkill patterns; keep them scoped.

echo "[restart] killing dev processes (best-effort)..."
pgrep -f "${ROOT_DIR}/api" | xargs -r kill || true
pgrep -f "${ROOT_DIR}/web" | xargs -r kill || true

# Also kill common commands if still hanging under this path
pkill -f "${ROOT_DIR}.*turbo run dev" || true
pkill -f "${ROOT_DIR}.*tsx watch src/index.ts" || true
pkill -f "${ROOT_DIR}.*vite --host 127.0.0.1" || true

sleep 0.5

echo "[restart] starting dev (web=5175, api=4318)..."
cd "$ROOT_DIR"

# Force ports (web already fixed via package.json; api via env)
PORT=4318 HOST=127.0.0.1 pnpm dev
