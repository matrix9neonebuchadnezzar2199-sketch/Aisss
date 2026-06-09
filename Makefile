# AISSS orchestration wrapper.
# Single Docker Compose stack. Ollama runs on the host.
# See docs/13-deployment-docker.md and ADR-004.

AISSS_COMPOSE ?= aisss/docker-compose.yaml

.PHONY: help up down ps logs-aisss test migrate

help:
	@echo "Targets:"
	@echo "  up          Start the AISSS stack"
	@echo "  down        Stop the AISSS stack"
	@echo "  ps          Show AISSS stack containers"
	@echo "  logs-aisss  Tail AISSS stack logs"
	@echo "  test        Run API and Web checks"
	@echo "  migrate     Apply DB migrations in the api container"
	@echo ""
	@echo "Ollama must be running on the host. See docs/15-ollama-integration.md"

up:
	docker compose -f $(AISSS_COMPOSE) up -d

down:
	docker compose -f $(AISSS_COMPOSE) down

ps:
	docker compose -f $(AISSS_COMPOSE) ps

logs-aisss:
	docker compose -f $(AISSS_COMPOSE) logs -f

test:
	npm test

migrate:
	docker compose -f $(AISSS_COMPOSE) exec api node dist/db/migrate-cli.js
