# Sets APP_VERSION + GIT_SHA and rebuilds the web container (Windows).
# Equivalent to `make deploy-web` on Unix.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Remove-Item Env:GIT_SHA -ErrorAction SilentlyContinue
Remove-Item Env:APP_VERSION -ErrorAction SilentlyContinue

$meta = node apps/web/scripts/resolve-build-meta.mjs | ConvertFrom-Json
$env:APP_VERSION = $meta.version
$env:GIT_SHA = $meta.gitSha
$env:DOCKER_BUILDKIT = '1'
$env:COMPOSE_DOCKER_CLI_BUILD = '1'

Write-Host "Building web: v$($env:APP_VERSION) ($($env:GIT_SHA))"
docker compose -f aisss/docker-compose.yaml build web
docker compose -f aisss/docker-compose.yaml up -d web
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-docker-deploy.ps1
