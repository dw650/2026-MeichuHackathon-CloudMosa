#!/usr/bin/env bash
# Saves real API responses as the frontend's msw fixtures (frontend/src/test/fixtures).
# Uses the backend test database with the mock data of a fixed moment, so reruns are identical.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/frontend/src/test/fixtures"
rm -rf "$out"
(cd "$root/backend" && uv run --frozen python -m tests.dump_api_fixtures "$out")
