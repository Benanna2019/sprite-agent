#!/usr/bin/env bash
# One-command redeploy of the harness to the Sprite.
#
# You should never have to think about the URL or the keys. This derives the
# Sprite's public origin automatically (so INNGEST_SERVE_ORIGIN is always right,
# even on a new Sprite) and reads keys from .env. Functions Utah wrote on the
# Sprite are preserved: the copy overlays files, it does not delete.
#
# Usage:  ./deploy.sh            (deploys to the sprite named below)
#         SPRITE=other ./deploy.sh
set -euo pipefail

SPRITE="${SPRITE:-shaun-scribe}"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE=/home/sprite/app
export PATH="$HOME/.local/bin:$HOME/.fly/bin:$PATH"

cd "$APP_DIR"
[ -f .env ] || { echo "missing .env"; exit 1; }

get() { grep "^$1=" .env | head -1 | cut -d= -f2- | tr -d "\"'\r"; }
G=$(get AI_GATEWAY_API_KEY); E=$(get INNGEST_EVENT_KEY); S=$(get INNGEST_SIGNING_KEY); C=$(get COMPOSIO_API_KEY)
[ -n "$G" ] && [ -n "$E" ] && [ -n "$S" ] || { echo "missing a key in .env (need AI_GATEWAY_API_KEY, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY)"; exit 1; }
# COMPOSIO_API_KEY is optional; carry it into the service env only when present
COMPOSIO_ENV=""; [ -n "$C" ] && COMPOSIO_ENV=",COMPOSIO_API_KEY=$C"

# Derive the Sprite's public URL so the origin is never hardcoded.
ORIGIN=$(sprite info -s "$SPRITE" 2>/dev/null | awk '/URL:/{print $2; exit}')
[ -n "$ORIGIN" ] || { echo "could not read Sprite URL for '$SPRITE' (is it created and are you logged in?)"; exit 1; }
echo "sprite: $SPRITE"
echo "origin: $ORIGIN"

echo "==> copying code (agent-written functions on the Sprite are kept)"
COPYFILE_DISABLE=1 tar czf - \
  --exclude node_modules --exclude .env --exclude 'workspace/results' \
  --exclude .git --exclude '.DS_Store' \
  src scripts workspace package.json package-lock.json \
  | sprite exec -s "$SPRITE" -- bash -lc "mkdir -p $REMOTE && cd $REMOTE && tar xzf - 2>/dev/null && find . -name '._*' -delete"

echo "==> npm install (no-op when unchanged)"
sprite exec -s "$SPRITE" -- bash -lc "cd $REMOTE && npm install --no-audit --no-fund >/dev/null 2>&1 && echo ok"

echo "==> restarting the utah service with derived origin + keys"
sprite exec -s "$SPRITE" -- bash -lc "sprite-env services delete utah >/dev/null 2>&1; sprite-env services create utah --cmd /.sprite/bin/node --args src/server.js --dir $REMOTE --http-port 8080 --env 'PORT=8080,INNGEST_SERVE_ORIGIN=$ORIGIN,INNGEST_SERVE_PATH=/api/inngest,AI_GATEWAY_API_KEY=$G,INNGEST_EVENT_KEY=$E,INNGEST_SIGNING_KEY=$S$COMPOSIO_ENV' --no-stream" 2>&1 | grep -E 'listening|error' | head -3

echo "==> syncing functions with Inngest Cloud"
sleep 2
curl -s --max-time 40 -X PUT "$ORIGIN/api/inngest" | grep -o '"message":"[^"]*"' || true
echo
echo "done. app live at $ORIGIN"
