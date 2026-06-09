# Deployment: Docker Topology

## Decision Summary

AISSS runs as a **single Docker Compose stack**. Ollama runs on the **host** outside Compose and is reached via `OLLAMA_BASE_URL`.

See [ADR-004](./decisions/ADR-004-native-ollama-ai.md). ADR-003 (two-stack with Dify) is superseded.

## Topology

```mermaid
flowchart LR
  subgraph host [Host OS]
    ollama["Ollama :11434"]
  end
  subgraph aisssStack [AISSS Compose Stack]
    web["AISSS WebUI"]
    api["Backend API and Search Middleware"]
    pg["PostgreSQL"]
    minio["MinIO"]
    redis["Redis Queue"]
    worker["Workers"]
    vector["Qdrant"]
  end
  browser["Browser"] --> web
  web --> api
  api --> pg
  api --> minio
  api --> redis
  api --> vector
  api -->|"OLLAMA_BASE_URL"| ollama
  worker --> pg
  worker --> minio
  worker --> vector
  worker -->|"embeddings"| ollama
```

## Stack Services

| Service | Image / build | Role |
|---|---|---|
| `web` | `apps/web` | WebUI |
| `api` | `apps/api` | API, RAG middleware, Ollama proxy, AI chat |
| `worker` | `apps/workers` | Extraction, embedding, RAG sync |
| `db` | `postgres:16` | Source of truth |
| `redis` | `redis:7` | Job queue |
| `minio` | `minio/minio` | Object storage |
| `vector` | `qdrant/qdrant` | Vector index (rebuildable) |

## Host Ollama

Ollama is **not** a Compose service. Requirements:

1. Install and start Ollama on the host.
2. Pull required models (`nomic-embed-text`, chat model, optional rerank).
3. Set `OLLAMA_BASE_URL` in `aisss/.env`.

Default from containers:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

On Linux, if `host.docker.internal` is unavailable, use the Docker bridge gateway (often `172.17.0.1`) or add `extra_hosts` to the `api` and `worker` services.

Ensure Ollama listens on an address reachable from containers. Verify with:

```bash
curl http://localhost:11434/api/tags
```

After AISSS API is running:

```bash
curl http://localhost:8000/api/ollama/health
```

## Quick Start

```bash
cp aisss/.env.example aisss/.env   # edit passwords and OLLAMA_BASE_URL
make up
```

Or:

```bash
docker compose -f aisss/docker-compose.yaml up -d
```

## Environment

Copy [`aisss/.env.example`](../aisss/.env.example). Key variables:

- `DATABASE_URL`
- `OBJECT_STORAGE_*`
- `REDIS_URL`
- `VECTOR_DB_URL`
- `OLLAMA_BASE_URL`
- `OLLAMA_HEALTH_INTERVAL_SEC`

Never commit `aisss/.env`.

## Ports (defaults)

| Service | Host port |
|---|---|
| WebUI | 3000 |
| API | 8000 |
| MinIO API | 9000 |
| MinIO console | 9001 |
| Qdrant | 6333 |
| Ollama | 11434 (host only) |

## Backup

Back up independently:

- PostgreSQL volume (`aisss_postgres_data`)
- MinIO volume (`aisss_minio_data`)
- Optional: Qdrant volume (rebuildable from PG + MinIO)

Ollama models live on the host filesystem; back up the Ollama model directory if needed.

## Failure Isolation

| Failure | Effect |
|---|---|
| Ollama down | Case management works; AI search disabled; WebUI shows status |
| Qdrant down | Metadata search works; semantic AI search degraded |
| AISSS API down | Full application unavailable |
| Worker down | New extractions/embeddings queue; existing data intact |

## Production Notes

- Put TLS termination in front of WebUI/API.
- Restrict MinIO and Qdrant ports to internal networks in production.
- Do not expose Ollama to the public internet; only AISSS API/workers should reach it.
- Run permission regression tests after embedding or chat model changes.

## Related

- [Ollama Integration Guide](./15-ollama-integration.md)
- [Makefile](../Makefile)
