# ADR-003: Run AISSS and Dify as Two Docker Stacks

## Status

Superseded by [ADR-004](./ADR-004-native-ollama-ai.md) (2026-06-09)

## Date

2026-06-09

## Context

This ADR applied when Dify was the AI workflow layer. Dify has been removed from the product architecture.

## Superseding Decision

Run **AISSS as a single Docker Compose stack** (WebUI, API, workers, PostgreSQL, Redis, MinIO, Qdrant). Ollama runs on the **host** and is reached via `OLLAMA_BASE_URL` (typically `http://host.docker.internal:11434`).

See [Deployment (Docker)](../13-deployment-docker.md) and [Ollama Integration Guide](../15-ollama-integration.md) for the current topology.

## Historical Record

The original decision separated AISSS and Dify into two stacks on a shared Docker network to allow independent upgrades. That separation is no longer needed because Dify is not deployed.
