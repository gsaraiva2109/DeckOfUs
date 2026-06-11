#!/bin/sh
set -e

# Ensure the SQLite data + uploads directories exist on the mounted volume.
# (The volume may be empty on first boot or after a fresh named volume.)
mkdir -p ./data/uploads

# Apply pending Prisma migrations against the SQLite database. Idempotent:
# `migrate deploy` only applies migrations that haven't run yet.
echo "[entrypoint] running prisma migrate deploy..."
npx prisma migrate deploy

# Hand off to the container CMD (node dist/index.js) as PID-managed child.
echo "[entrypoint] starting app: $*"
exec "$@"
