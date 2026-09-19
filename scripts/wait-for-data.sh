#!/usr/bin/env bash
# Waits until the worker's first pass has prices for every country. `docker compose --wait` only
# waits for the containers, and generating the demo data takes tens of seconds, so without this
# the first screens legitimately show "no data" and the checks fail for the wrong reason.
set -euo pipefail

base="${1:-http://localhost:8080}/api/v1"
tries="${WAIT_FOR_DATA_TRIES:-90}" # every 2 seconds

countries=$(curl -fsS "$base/countries" |
  python3 -c 'import json,sys; print(" ".join(c["code"] for c in json.load(sys.stdin)["countries"]))')

for country in $countries; do
  area=$(curl -fsS "$base/countries/$country/areas" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["areas"][0]["id"])')
  for try in $(seq "$tries"); do
    # A country may report only one of the two price types (Malaysia has no wholesale).
    for price_type in wholesale retail; do
      if curl -fsS "$base/prices?country=$country&area=$area&type=$price_type" |
        grep -q '"price_per_kg":[0-9]'; then
        echo "$country: prices after $((try * 2 - 2))s"
        continue 3
      fi
    done
    sleep 2
  done
  echo "wait-for-data: no prices for $country after $((tries * 2))s;" \
    "the worker's first pass failed or is too slow (make logs)" >&2
  exit 1
done
