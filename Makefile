# AISSS orchestration wrapper.
# Single Docker Compose stack. Ollama runs on the host.
# See docs/13-deployment-docker.md and ADR-004.

AISSS_COMPOSE ?= aisss/docker-compose.yaml

# SemVer + git SHA baked into web/api images (docs/21-versioning.md)
APP_VERSION := $(shell node -p "require('./package.json').version")
GIT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
export APP_VERSION
export GIT_SHA

# BuildKit: required for RUN --mount=type=cache in Dockerfiles (see rule 56)
export DOCKER_BUILDKIT := 1
export COMPOSE_DOCKER_CLI_BUILD := 1

.PHONY: help up down ps logs-aisss test migrate build build-web build-api build-worker
.PHONY: verify-deploy deploy deploy-web deploy-api deploy-worker

help:
	@echo "Targets:"
	@echo "  up          Start the AISSS stack"
	@echo "  down        Stop the AISSS stack"
	@echo "  build       Rebuild all application images (api, web, worker)"
	@echo "  build-web   Rebuild web only (faster when only apps/web changed)"
	@echo "  build-api   Rebuild api only"
	@echo "  build-worker Rebuild worker only"
	@echo "  deploy      build + up + verify-deploy (required after apps code push)"
	@echo "  deploy-web  build-web + up web + verify-deploy"
	@echo "  deploy-api  build-api + up api + verify-deploy"
	@echo "  deploy-worker build-worker + up worker"
	@echo "  verify-deploy  Assert running containers are not stale (web CSS, api BOM)"
	@echo "  ps          Show AISSS stack containers"
	@echo "  logs-aisss  Tail AISSS stack logs"
	@echo "  test        Run API and Web checks"
	@echo "  migrate     Apply DB migrations in the api container"
	@echo ""
	@echo "Ollama must be running on the host. See docs/15-ollama-integration.md"
	@echo "Build cache: docs/13-deployment-docker.md § Build cache"

up:
	docker compose -f $(AISSS_COMPOSE) up -d

down:
	docker compose -f $(AISSS_COMPOSE) down

build:
	docker compose -f $(AISSS_COMPOSE) build api web worker

build-web:
	docker compose -f $(AISSS_COMPOSE) build web

build-api:
	docker compose -f $(AISSS_COMPOSE) build api

build-worker:
	docker compose -f $(AISSS_COMPOSE) build worker

deploy: build
	docker compose -f $(AISSS_COMPOSE) up -d
	$(MAKE) verify-deploy

deploy-web: build-web
	docker compose -f $(AISSS_COMPOSE) up -d web
	$(MAKE) verify-deploy

deploy-api: build-api
	docker compose -f $(AISSS_COMPOSE) up -d api
	$(MAKE) verify-deploy

deploy-worker: build-worker
	docker compose -f $(AISSS_COMPOSE) up -d worker

verify-deploy:
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-docker-deploy.ps1

ps:
	docker compose -f $(AISSS_COMPOSE) ps

logs-aisss:
	docker compose -f $(AISSS_COMPOSE) logs -f

test:
	npm test

migrate:
	docker compose -f $(AISSS_COMPOSE) exec api node dist/db/migrate-cli.js
