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

.PHONY: up down logs db-up test test-frontend test-backend lint lint-frontend lint-backend

## Start all services (production build) and wait until they are healthy.
up: .env
	$(COMPOSE) up -d --build --wait
	@echo "Ready: http://localhost:$(WEB_PORT)"

## Stop all services.
down:
	$(COMPOSE) down

## Follow service logs.
logs:
	$(COMPOSE) logs -f --tail=200

## Start only the database (used by the backend tests).
db-up: .env
	$(COMPOSE) up -d --wait db

## Run all tests.
test: db-up test-frontend test-backend

test-frontend: frontend/node_modules/.package-lock.json
	cd frontend && npm test

test-backend:
	cd backend && uv run pytest -q

## Run all linters and type checks.
lint: lint-frontend lint-backend

lint-frontend: frontend/node_modules/.package-lock.json
	cd frontend && npm run lint && npm run typecheck

lint-backend:
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy

.env:
	cp .env.example .env

# Install frontend dependencies when the lock file changes.
frontend/node_modules/.package-lock.json: frontend/package-lock.json
	cd frontend && npm ci --no-audit --no-fund
