#!/bin/sh
set -e

# Seed the durable volume the first time it is empty, so the app ships with its
# workspace (SOUL, the ping function) but the agent's later writes persist.
if [ ! -d /app/workspace ] || [ -z "$(ls -A /app/workspace 2>/dev/null)" ]; then
  echo "[entrypoint] seeding empty workspace volume from image"
  mkdir -p /app/workspace
  cp -R /app/workspace-seed/. /app/workspace/
fi

exec "$@"
