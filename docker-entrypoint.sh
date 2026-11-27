#!/bin/sh
set -eu

# Restore the database from object storage when a replica is configured, then
# keep replicating while the app runs. Without replica settings the app still
# starts, but saves live only on the container filesystem.
if [ -n "${LITESTREAM_BUCKET:-}" ] && [ -n "${LITESTREAM_ACCESS_KEY_ID:-}" ]; then
  litestream restore -if-replica-exists -config /etc/litestream.yml "$DATA_DIR/game.db"
  exec litestream replicate -config /etc/litestream.yml -exec "node server/index.js"
fi

echo "No Litestream replica configured - database will not survive a restart."
exec node server/index.js
