# Common commands. Ports come from .env (created from .env.example if missing).
-include .env
WEB_PORT ?= 8080
DB_PORT ?= 5432
POSTGRES_USER ?= agri
POSTGRES_PASSWORD ?= agri-local-only
export WEB_PORT DB_PORT POSTGRES_USER POSTGRES_PASSWORD

COMPOSE ?= docker compose
# Backend tests use their own database on the compose `db` (CI points this at its service).
TEST_DATABASE_URL ?= postgresql+psycopg://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@127.0.0.1:$(DB_PORT)/agri_test
export TEST_DATABASE_URL

.PHONY: up dev down logs seed db-up test test-frontend test-backend lint lint-frontend lint-backend \
	audit audit-frontend audit-backend build-frontend types geoip

## Start all services (production build) and wait until they are healthy.
up: .env
	$(COMPOSE) up -d --build --wait
	@echo "Ready: http://localhost:$(WEB_PORT)"

## Development mode: Vite HMR and api --reload behind the same Caddy origin.
dev: .env
	$(COMPOSE) -f compose.yaml -f compose.dev.yaml up -d --build --wait
	@echo "Dev server: http://localhost:$(WEB_PORT)"

## Stop all services (production or development).
down:
	$(COMPOSE) down --remove-orphans

## Follow the api and worker logs.
logs:
	$(COMPOSE) logs -f --tail=200 api worker

## Re-sync the seed files and regenerate the mock data (one worker pass).
seed: .env
	$(COMPOSE) run --rm worker python -m app.worker --once

## Start only the database (used by the backend tests).
db-up: .env
	$(COMPOSE) up -d --wait db

## Run all tests.
test: db-up test-frontend test-backend

# Tests run with coverage and print a one-line summary per side.
test-frontend: frontend/node_modules/.package-lock.json
	cd frontend && npm run coverage

# Gate: app/services + app/ingest together must stay at 90% or more.
BACKEND_CORE = app/services/*,app/ingest/*

test-backend:
	cd backend && uv run pytest -q --cov=app --cov-report=
	@cd backend && echo "backend coverage (app): $$(uv run coverage report --format=total)%"
	@cd backend && echo "backend core coverage (services + ingest, gate 90%):" \
		"$$(uv run coverage report --include='$(BACKEND_CORE)' --format=total)%"
	@cd backend && uv run coverage report --include='$(BACKEND_CORE)' --fail-under=90 > /dev/null

## Run all linters and type checks.
lint: lint-frontend lint-backend

lint-frontend: frontend/node_modules/.package-lock.json
	cd frontend && npm run lint && npm run typecheck

lint-backend:
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy

## Dependency vulnerability checks (runtime dependencies only).
audit: audit-frontend audit-backend

audit-frontend: frontend/node_modules/.package-lock.json
	cd frontend && npm audit --omit=dev --audit-level=high

audit-backend:
	cd backend && uv export --frozen --no-dev --no-emit-project --quiet > .audit-requirements.txt
	cd backend && uvx pip-audit -r .audit-requirements.txt --disable-pip --progress-spinner off; \
		status=$$?; rm -f .audit-requirements.txt; exit $$status

## Download the free DB-IP Lite City database for /locate (not in Git).
geoip:
	./scripts/fetch-geoip.sh

## Regenerate the frontend API types from the backend OpenAPI document.
types: frontend/node_modules/.package-lock.json
	./scripts/gen-api-types.sh

## Production build of the frontend (the web image runs the same script).
build-frontend: frontend/node_modules/.package-lock.json
	cd frontend && npm run build

.env:
	cp .env.example .env

# Install frontend dependencies when the lock file changes.
frontend/node_modules/.package-lock.json: frontend/package-lock.json
	cd frontend && npm ci --no-audit --no-fund
