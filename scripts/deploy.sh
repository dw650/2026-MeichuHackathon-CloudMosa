#!/usr/bin/env bash
# Deploys a Git ref on the server (docs/07 §5.2): fetch it, build the images, start every service
# and wait until the app answers through the web server. If that fails, it goes back to the last
# commit that deployed fine and exits non-zero.
#   scripts/deploy.sh [ref]   ref: a branch or tag of the remote, or a commit (default: main)
# CD runs it through scripts/deploy-poll.sh when the Deploy workflow moves the `deploy` branch
# (docs/07 §5.3); run it by hand to deploy or roll back a given ref.
set -euo pipefail

cd "$(dirname "$0")/.."
ref="${1:-main}"
if [[ ! "$ref" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]]; then
  echo "deploy: not a branch, tag or commit: $ref" >&2
  exit 2
fi

# One deploy at a time (a manual one and the workflow's may overlap).
exec 9>.git/deploy.lock
flock -w 900 9

docker=(docker)
docker info >/dev/null 2>&1 || docker=(sudo -n docker)
compose=("${docker[@]}" compose)

[[ -f .env ]] || { echo "deploy: .env is missing (start from .env.example)" >&2; exit 2; }
env_value() { sed -n "s/^$1=//p" .env | tail -n 1; }
site="$(env_value SITE_ADDRESS)"
if [[ -z "$site" || "$site" == :* ]]; then
  port="$(env_value WEB_PORT)"
  health="http://127.0.0.1:${port:-8080}/api/v1/health"
else
  health="https://$site/api/v1/health"
fi
last_good=.git/deploy-last-good

# Chained with && because `set -e` does not apply inside a function called from `if`.
deploy() {
  git checkout --quiet --force --detach "$1" &&
    APP_VERSION="$(git rev-parse --short HEAD)" &&
    export APP_VERSION &&
    "${compose[@]}" up --detach --build --wait --wait-timeout 300 --remove-orphans &&
    curl -fsS --retry 10 --retry-delay 3 --retry-all-errors -o /dev/null "$health"
}

git fetch --quiet --prune --tags origin
sha="$(git rev-parse --verify --quiet "origin/$ref^{commit}" ||
  git rev-parse --verify --quiet "$ref^{commit}")" || {
  echo "deploy: $ref not found on origin" >&2
  exit 2
}

echo "Deploying $(git log -1 --format='%h %s' "$sha")"
if deploy "$sha"; then
  echo "$sha" >"$last_good"
  echo "Deployed $(git rev-parse --short "$sha"); health check passed: $health"
  exit 0
fi

echo "deploy: $(git rev-parse --short "$sha") failed; recent logs:" >&2
"${compose[@]}" ps >&2 || true
"${compose[@]}" logs --tail 40 api worker web >&2 || true
if [[ -s "$last_good" && "$(cat "$last_good")" != "$sha" ]]; then
  previous="$(cat "$last_good")"
  echo "deploy: rolling back to $(git rev-parse --short "$previous")" >&2
  deploy "$previous" || echo "deploy: rollback failed too" >&2
fi
exit 1
