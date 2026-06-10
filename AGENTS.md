# AISSS Agent Notes

## Docker deploy is mandatory after app changes

**Push ≠ deploy.** After editing `apps/web`, `apps/api`, or `apps/workers`:

```powershell
make deploy
```

Do not mark work complete until `make verify-deploy` passes.

See `docs/19-operational-runbook.md` § Deploy verification and `.cursor/rules/55-aisss-docker-deploy.mdc`.
