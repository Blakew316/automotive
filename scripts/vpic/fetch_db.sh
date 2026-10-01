#!/usr/bin/env bash
# Download the SQLite build of NHTSA's public-domain vPIC database (bundled in the ISC-licensed
# @cardog/corgi npm package) and unpack it to scripts/vpic/.cache/vpic.lite.db.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cache="$here/.cache"
mkdir -p "$cache"
cd "$cache"
if [ ! -f vpic.lite.db ]; then
  npm pack @cardog/corgi@2.0.4 --silent >/dev/null
  tar xzf cardog-corgi-2.0.4.tgz package/dist/db/vpic.lite.db.gz
  gunzip -c package/dist/db/vpic.lite.db.gz > vpic.lite.db
  rm -rf package cardog-corgi-2.0.4.tgz
fi
echo "$cache/vpic.lite.db"
