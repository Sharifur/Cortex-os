#!/bin/sh
set -e

MMDB_PATH="/app/data/GeoLite2-City.mmdb"

if [ ! -f "$MMDB_PATH" ]; then
  YEAR=$(date +%Y)
  MONTH=$(date +%m)
  URL="https://download.db-ip.com/free/dbip-city-lite-${YEAR}-${MONTH}.mmdb.gz"
  mkdir -p /app/data
  echo "Downloading GeoLite2-City.mmdb from DB-IP..."
  wget -q -O /tmp/dbip.mmdb.gz "$URL" && gunzip -c /tmp/dbip.mmdb.gz > "$MMDB_PATH" && rm /tmp/dbip.mmdb.gz
  echo "GeoLite2-City.mmdb ready"
else
  echo "GeoLite2-City.mmdb already present, skipping download"
fi

exec "$@"
