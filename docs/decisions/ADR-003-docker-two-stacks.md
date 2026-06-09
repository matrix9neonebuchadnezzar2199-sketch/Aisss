# ADR-003: Run Aisss and Dify as Two Docker Stacks

## Status

Accepted

## Date

2026-06-09

## Context

Aisss needs Dify for AI workflow and chat, plus its own WebUI, backend API, PostgreSQL, object storage, queue, workers, and vector database. A common question is whether the whole system should be one Docker Compose stack.

Two facts shape this decision:

- Dify is not a single container. The official Dify deployment is already a multi-container Compose stack with its own database, redis, and vector store.
- Aisss must remain the source of truth and the permission authority, and must stay maintainable across frequent Dify updates.

## Decision

Run Aisss and Dify as two independent Docker Compose stacks connected by a shared external Docker network. Each stack keeps its own PostgreSQL. Cross-stack communication uses HTTP APIs only.

A repository `Makefile` provides single-command startup that brings up both stacks, while still allowing each stack to be started, stopped, and upgraded independently.

## Alternatives Considered

### Single Combined Stack

Pros:

- One `docker compose up` for everything.
- Fewer files at first glance.

Cons:

- Forking or merging the Dify Compose stack makes Dify upgrades painful.
- Coupled lifecycle: restarting or upgrading Dify risks the case system.
- Tendency to share a database, which couples migrations and backups.
- Weaker failure isolation.

Rejected because it harms maintenance and upgrade safety.

### Shared Database Between Aisss and Dify

Pros:

- One database to operate.

Cons:

- Schema migrations and backups become entangled.
- A Dify change can affect Aisss data integrity.
- Breaks the source-of-truth boundary from ADR-001.

Rejected because it defeats separation and increases risk.

### Two Independent Stacks with Shared Network

Pros:

- Independent upgrades, restarts, and backups.
- Clear failure isolation; Aisss survives Dify downtime.
- Permission middleware stays inside the Aisss stack.
- Single-command startup is still possible through a wrapper.

Cons:

- Requires a shared network and a small Dify override file.
- Two `.env` files to manage.

Accepted because it gives the best maintenance and security properties with minimal extra setup.

## Consequences

- Dify runs from its official Compose stack, attached to a shared external network via an override file.
- Aisss provides its own `aisss/docker-compose.yaml` and `aisss/.env.example`.
- A `Makefile` wraps both stacks for convenience.
- Operators back up Aisss and Dify separately.
- The Aisss vector database is treated as rebuildable from PostgreSQL and object storage.
- After each Dify upgrade, the search middleware contract must be re-tested.
