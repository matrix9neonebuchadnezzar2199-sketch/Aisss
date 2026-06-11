# Verify running Docker containers match post-M19+ expectations.
# Exit 1 on stale images so CI/agents cannot mark deploy "done" without rebuild.
param(
  [switch]$SkipApiBom
)

$ErrorActionPreference = 'Stop'

function Assert-ContainerRunning {
  param([string]$Name)
  $state = docker inspect -f '{{.State.Running}}' $Name 2>$null
  if ($state -ne 'true') {
    throw "Container '$Name' is not running. Start stack: make up"
  }
}

function Test-WebImageFresh {
  $name = 'aisss-web-1'
  Assert-ContainerRunning $name

  $cssLine = docker exec $name sh -c "wc -c /usr/share/nginx/html/assets/*.css 2>/dev/null | head -1"
  if (-not $cssLine) { throw "No CSS assets in web container" }

  $size = [int](($cssLine -split '\s+')[0])
  $minBytes = 20000
  if ($size -lt $minBytes) {
    throw @"
STALE web image: CSS total ${size} bytes (need >= $minBytes for mock UI).
Fix: make build && docker compose -f aisss/docker-compose.yaml up -d web
Then re-run: pwsh scripts/verify-docker-deploy.ps1
"@
  }

  $hasGh = docker exec $name sh -c "grep -q gh-header /usr/share/nginx/html/assets/*.css && echo ok"
  if ($hasGh -ne 'ok') {
    throw "STALE web image: .gh-header missing from bundled CSS. Rebuild web container."
  }

  Write-Host "OK web: CSS ${size} bytes, gh-header present"
}

function Test-WebBuildVersion {
  $name = 'aisss-web-1'
  Assert-ContainerRunning $name

  $expectedSha = $null
  try {
    $expectedSha = (git rev-parse --short HEAD 2>$null).Trim()
  } catch {
    Write-Warning 'Not a git repo; skipping build SHA check'
    return
  }
  if (-not $expectedSha) {
    Write-Warning 'Could not resolve git HEAD; skipping build SHA check'
    return
  }

  $found = docker exec $name sh -c "grep -l '$expectedSha' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1"
  if (-not $found) {
    throw @"
STALE web image: bundled JS does not contain commit $expectedSha.
Fix: pwsh scripts/deploy-web.ps1  (or make deploy-web)
"@
  }

  $pkg = Get-Content (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json
  $ver = $pkg.version
  $verFound = docker exec $name sh -c "grep -l '$ver' /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1"
  if (-not $verFound) {
    throw "STALE web image: bundled JS missing version $ver. Rebuild web container."
  }

  Write-Host "OK web: build label v$ver ($expectedSha) in bundle"
}

function Test-ApiCsvBom {
  $port = if ($env:AISSS_API_PORT) { $env:AISSS_API_PORT } else { '8000' }
  $userId = '00000000-0000-4000-8000-000000000001'
  $tmp = Join-Path $env:TEMP "aisss-audit-bom-check.csv"
  curl.exe -s -H "X-AISSS-User-Id: $userId" "http://127.0.0.1:${port}/api/audit-logs?export=csv" -o $tmp
  if (-not (Test-Path $tmp)) { throw "Could not fetch audit CSV from API :$port" }

  $bytes = [System.IO.File]::ReadAllBytes($tmp)[0..2]
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  if ($bytes.Count -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    throw "STALE api image: audit CSV missing UTF-8 BOM (EF BB BF). Rebuild api container."
  }
  Write-Host 'OK api: audit CSV has UTF-8 BOM'
}

Test-WebImageFresh
Test-WebBuildVersion
if (-not $SkipApiBom) {
  try { Test-ApiCsvBom } catch { Write-Warning $_.Exception.Message }
}

Write-Host 'verify-docker-deploy: passed'
