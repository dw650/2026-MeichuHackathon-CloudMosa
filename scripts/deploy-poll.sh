#!/usr/bin/env bash
# Deploys what the Deploy workflow marked as ready (docs/07 §5.3). After CI passes on main, the
# workflow moves the `deploy` branch to that commit; a systemd timer on the server runs this
# script every minute. The server only makes outgoing connections, because its firewall does
# not let GitHub in. A commit that failed to deploy is not retried until a newer one arrives.
set -euo pipefail

cd "$(dirname "$0")/.."
target="$(git ls-remote --heads origin refs/heads/deploy | cut -f1)"
[[ -n "$target" ]] || exit 0 # nothing marked yet
[[ "$target" != "$(cat .git/deploy-last-good 2>/dev/null)" ]] || exit 0
[[ "$target" != "$(cat .git/deploy-last-attempt 2>/dev/null)" ]] || exit 0

echo "$target" >.git/deploy-last-attempt
exec scripts/deploy.sh "$target"
