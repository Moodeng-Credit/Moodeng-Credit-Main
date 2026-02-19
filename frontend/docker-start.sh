#!/bin/sh
set -e
echo "[Docker] Installing dependencies..."
pnpm install
echo "[Docker] Starting Vite on http://0.0.0.0:3000 ..."
if [ -f .env.local ]; then
  exec pnpm run dev:local -- --host 0.0.0.0
elif [ -f .env.staging ]; then
  exec pnpm run dev -- --host 0.0.0.0
else
  exec npx vite --host 0.0.0.0
fi
