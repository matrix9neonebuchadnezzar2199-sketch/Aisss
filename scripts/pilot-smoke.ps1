# M28 pilot smoke — health, tests, build, Docker verify, optional backup-check evidence.
# Usage: pwsh scripts/pilot-smoke.ps1 [-SkipDocker] [-RecordBackupCheck]
param(
  [switch]$SkipDocker,
  [switch]$RecordBackupCheck,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$port = if ($env:AISSS_API_PORT) { $env:AISSS_API_PORT } else { '8000' }
$adminId = if ($env:AISSS_VERIFY_USER_ID) { $env:AISSS_VERIFY_USER_ID } else { '00000000-0000-4000-8000-000000000001' }
$base = "http://127.0.0.1:${port}"
$failures = @()
$results = [ordered]@{}

function Step-Ok ($name, $detail) {
  $results[$name] = @{ status = 'ok'; detail = $detail }
  Write-Host "OK  $name — $detail"
}

function Step-Warn ($name, $detail) {
  $results[$name] = @{ status = 'warn'; detail = $detail }
  Write-Host "WARN $name — $detail"
}

function Step-Err ($name, $detail) {
  $results[$name] = @{ status = 'err'; detail = $detail }
  $script:failures += $name
  Write-Host "ERR $name — $detail"
}

Write-Host "=== AISSS M28 pilot smoke ==="
Write-Host "API: $base  Admin: $adminId"

# Step 1 — stack health
try {
  $health = curl.exe -s -f "$base/api/health" | ConvertFrom-Json
  if ($health.status -ne 'ok') { throw "status=$($health.status)" }
  Step-Ok 'api_health' "version=$($health.version) sha=$($health.git_sha)"
} catch {
  Step-Err 'api_health' $_.Exception.Message
}

try {
  $ollama = curl.exe -s "$base/api/ollama/health" | ConvertFrom-Json
  if ($ollama.status -eq 'ok') {
    Step-Ok 'ollama_health' 'host Ollama reachable'
  } else {
    Step-Warn 'ollama_health' "status=$($ollama.status) — AI chat disabled until host Ollama is up"
  }
} catch {
  Step-Warn 'ollama_health' $_.Exception.Message
}

# Step 8 — rag eval (automated permission regression)
try {
  npm test -w @aisss/api -- src/rag-eval.test.ts 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
  Step-Ok 'rag_eval' 'permission scenarios pass'
} catch {
  Step-Err 'rag_eval' $_.Exception.Message
}

# Step 12 — unit tests
try {
  npm test -w @aisss/api 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "api exit $LASTEXITCODE" }
  Step-Ok 'npm_test_api' 'all api tests pass'
} catch {
  Step-Err 'npm_test_api' $_.Exception.Message
}

try {
  npm test -w @aisss/workers 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "workers exit $LASTEXITCODE" }
  Step-Ok 'npm_test_workers' 'all worker tests pass'
} catch {
  Step-Err 'npm_test_workers' $_.Exception.Message
}

if (-not $SkipBuild) {
  try {
    npm run build -w @aisss/web 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "build exit $LASTEXITCODE" }
    Step-Ok 'npm_build_web' 'tsc + vite build pass'
  } catch {
    Step-Err 'npm_build_web' $_.Exception.Message
  }
}

if (-not $SkipDocker) {
  try {
    & (Join-Path $PSScriptRoot 'verify-docker-deploy.ps1') 2>&1 | Out-Null
    Step-Ok 'docker_verify' 'running containers match git HEAD'
  } catch {
    Step-Err 'docker_verify' $_.Exception.Message
  }
}

# Admin dashboard (operator gate)
try {
  $dash = curl.exe -s -H "X-AISSS-User-Id: $adminId" "$base/api/admin/dashboard" | ConvertFrom-Json
  Step-Ok 'admin_dashboard' "cases=$($dash.cases) failed_jobs=$($dash.failed_jobs) rag_chunks=$($dash.rag_chunks)"
} catch {
  Step-Warn 'admin_dashboard' $_.Exception.Message
}

# Backup-check evidence (M28 gate)
if ($RecordBackupCheck) {
  $body = @{
    scope = 'full-stack'
    status = 'ok'
    notes = "M28 pilot-smoke automated evidence $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  } | ConvertTo-Json -Compress
  try {
    $resp = curl.exe -s -w "`n%{http_code}" -X POST "$base/api/admin/backup-checks" `
      -H "Content-Type: application/json" `
      -H "X-AISSS-User-Id: $adminId" `
      -d $body
    $lines = $resp -split "`n"
    $code = $lines[-1]
    if ($code -ne '201') { throw "HTTP $code" }
    Step-Ok 'backup_check_recorded' 'POST /api/admin/backup-checks 201'
  } catch {
    Step-Warn 'backup_check_recorded' $_.Exception.Message
  }
}

Write-Host ""
Write-Host "=== Summary ==="
foreach ($k in $results.Keys) {
  $r = $results[$k]
  Write-Host ("  [{0}] {1} — {2}" -f $r.status.ToUpper(), $k, $r.detail)
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "pilot-smoke: FAILED ($($failures.Count) step(s))"
  exit 1
}

Write-Host ""
Write-Host 'pilot-smoke: passed'
exit 0
