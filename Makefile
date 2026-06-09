# Aisss orchestration wrapper.
# Runs Aisss and Dify as two independent Docker Compose stacks that share
# one external network. See docs/13-deployment-docker.md and ADR-003.

SHARED_NETWORK ?= aisss-shared
AISSS_COMPOSE ?= aisss/docker-compose.yaml
# Path to the official Dify docker compose, vendored outside app code.
DIFY_COMPOSE ?= dify/docker-compose.yaml

.PHONY: help net up down up-aisss down-aisss up-dify down-dify ps logs-aisss

help:
	@echo "Targets:"
	@echo "  net         Create the shared docker network (run once)"
	@echo "  up          Start Dify stack, then Aisss stack"
	@echo "  down        Stop both stacks"
	@echo "  up-aisss    Start only the Aisss stack"
	@echo "  down-aisss  Stop only the Aisss stack"
	@echo "  up-dify     Start only the Dify stack"
	@echo "  down-dify   Stop only the Dify stack"
	@echo "  ps          Show Aisss stack containers"
	@echo "  logs-aisss  Tail Aisss stack logs"

net:
	docker network inspect $(SHARED_NETWORK) >/dev/null 2>&1 || docker network create $(SHARED_NETWORK)

up: net up-dify up-aisss

down: down-aisss down-dify

up-aisss:
	docker compose -f $(AISSS_COMPOSE) up -d

down-aisss:
	docker compose -f $(AISSS_COMPOSE) down

up-dify:
	docker compose -f $(DIFY_COMPOSE) up -d

down-dify:
	docker compose -f $(DIFY_COMPOSE) down

ps:
	docker compose -f $(AISSS_COMPOSE) ps

logs-aisss:
	docker compose -f $(AISSS_COMPOSE) logs -f
