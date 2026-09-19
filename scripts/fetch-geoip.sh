#!/usr/bin/env bash
# Downloads the free DB-IP Lite City database (no account needed) to infra/geoip/city.mmdb.
# License: CC BY 4.0 — "IP Geolocation by DB-IP" (https://db-ip.com). Never commit the file.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/infra/geoip/city.mmdb"
month="${1:-$(date -u +%Y-%m)}"
url="https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz"

echo "Downloading $url"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
if ! curl -fsSL --retry 2 -o "$tmp" "$url"; then
  prev="$(date -u -d "${month}-01 -1 month" +%Y-%m)"
  echo "Not available yet; trying $prev"
  curl -fsSL --retry 2 -o "$tmp" "https://download.db-ip.com/free/dbip-city-lite-${prev}.mmdb.gz"
fi
gunzip -c "$tmp" > "$out.part"
mv "$out.part" "$out"
echo "Saved $out ($(du -h "$out" | cut -f1)). Restart the api to use it: docker compose restart api"
