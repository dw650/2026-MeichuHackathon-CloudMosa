# Common commands. Ports come from .env (created from .env.example if missing).
-include .env
WEB_PORT ?= 8080
DB_PORT ?= 5432
export WEB_PORT DB_PORT

COMPOSE ?= docker compose

.PHONY: up down logs

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

.env:
	cp .env.example .env
