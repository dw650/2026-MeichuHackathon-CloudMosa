#!/usr/bin/env bash
# Regenerates frontend/src/api/schema.d.ts from the backend's OpenAPI document.
# The CI `contract` job runs this and fails when the committed file is out of date.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
spec="$(mktemp --suffix=.json)"
trap 'rm -f "$spec"' EXIT

(cd "$root/backend" && uv run --frozen python -m app.openapi) > "$spec"
mkdir -p "$root/frontend/src/api"
(cd "$root/frontend" && npx --no-install openapi-typescript "$spec" \
  --output src/api/schema.d.ts --root-types --alphabetize >/dev/null)
echo "frontend/src/api/schema.d.ts updated"
