# AISSS Agent Notes

## Docker deploy is mandatory after app changes

**Push ≠ deploy.** After editing `apps/web`, `apps/api`, or `apps/workers`:

```powershell
make deploy-web    # UI only (fastest)
make deploy-api    # API only
make deploy        # multiple services / Dockerfile / lockfile
```

Do not mark work complete until `make verify-deploy` passes.

After deploy, confirm the footer shows **`vX.Y.Z (abcdef0)`** matching `git rev-parse --short HEAD`. See `docs/21-versioning.md`.

## Build speed

- Root `.dockerignore` + BuildKit npm cache mounts in Dockerfiles (see `docs/13-deployment-docker.md` § Build cache).
- Prefer **service-scoped** `make deploy-*` over full `make deploy` when only one app changed.

Rules: `55-aisss-docker-deploy.mdc`, `56-aisss-docker-build-cache.mdc`.
