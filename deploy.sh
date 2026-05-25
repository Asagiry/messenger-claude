#!/usr/bin/env bash
# Deploy script for the Web Messenger MVP.
# Runs on the target Ubuntu VM. Assumes Node 18+, npm, PostgreSQL 16,
# and PM2 are already installed and the `app` database exists.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "==> Project directory: $APP_DIR"

# 1. Pull latest code (best-effort; ignore failure on fresh clone)
if [ -d .git ]; then
  echo "==> Pulling latest code"
  git fetch --all --prune || true
  git reset --hard origin/main || true
fi

# 2. Install dependencies
echo "==> Installing server dependencies"
( cd server && npm install --no-audit --no-fund )

echo "==> Installing client dependencies"
( cd client && npm install --no-audit --no-fund )

# 3. Build client
echo "==> Building client (Vite)"
( cd client && npm run build )

# 4. Build server (TypeScript -> dist)
echo "==> Building server (tsc)"
( cd server && npm run build )

# 5. Database migrations + seed
echo "==> Running database migrations"
( cd server && npx ts-node src/db/migrate.ts )

echo "==> Seeding database"
( cd server && npx ts-node src/db/seed.ts )

# 6. Allow Node to bind to privileged port 80 without sudo for PM2
NODE_BIN="$(readlink -f "$(which node)")"
if [ -n "$NODE_BIN" ]; then
  echo "==> Granting cap_net_bind_service to $NODE_BIN"
  sudo setcap 'cap_net_bind_service=+ep' "$NODE_BIN" || true
fi

# 7. Logs directory
mkdir -p logs

# 8. Start / reload via PM2
echo "==> Starting messenger under PM2"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo
echo "==> Deployment complete."
pm2 status
echo
echo "App should be reachable at http://claude-messenger.voimaxgm.online (port 80)."
