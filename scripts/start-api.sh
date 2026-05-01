#!/bin/sh
set -e

MMDB_DIR="${MAXMIND_DB_PATH:-/data}"
MMDB_FILE="$MMDB_DIR/GeoLite2-City.mmdb"

if [ ! -f "$MMDB_FILE" ]; then
  YEAR=$(date +%Y)
  MONTH=$(date +%m)
  URL="https://download.db-ip.com/free/dbip-city-lite-${YEAR}-${MONTH}.mmdb.gz"
  mkdir -p "$MMDB_DIR"
  echo "Downloading GeoLite2-City.mmdb..."
  wget -q -O /tmp/dbip.mmdb.gz "$URL" && gunzip -c /tmp/dbip.mmdb.gz > "$MMDB_FILE" && rm /tmp/dbip.mmdb.gz
  echo "GeoLite2-City.mmdb ready at $MMDB_FILE"
else
  echo "GeoLite2-City.mmdb already present, skipping download"
fi

export MAXMIND_DB_PATH="$MMDB_FILE"
exec node dist/src/main
