#!/usr/bin/env bash
# Bump the asset version used for cache-busting (?v=N on every css/js URL) and
# the service-worker cache name in one go.
#   scripts/bump.sh          # increments the current version
#   scripts/bump.sh 42       # sets an explicit version
set -euo pipefail
cd "$(dirname "$0")/.."
cur=$(grep -o 'css/style.css?v=[0-9]*' index.html | head -1 | sed 's/.*v=//')
new=${1:-$((cur + 1))}
for f in *.html; do
  sed -i '' -E "s/(\.(css|js))\?v=[0-9]+/\1?v=${new}/g" "$f"
done
sed -i '' -E "s/const CACHE = \"omni-oracle-v[0-9]+\"/const CACHE = \"omni-oracle-v${new}\"/" sw.js
echo "assets bumped: v=${cur} -> v=${new} (html + sw.js)"
