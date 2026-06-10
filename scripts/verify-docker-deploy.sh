#!/usr/bin/env bash
# Verify running Docker containers are not stale (web CSS + optional API BOM).
set -euo pipefail

WEB_CONTAINER="${AISSS_WEB_CONTAINER:-aisss-web-1}"
MIN_CSS_BYTES="${AISSS_MIN_WEB_CSS_BYTES:-20000}"
API_PORT="${AISSS_API_PORT:-8000}"
USER_ID="${AISSS_VERIFY_USER_ID:-00000000-0000-4000-8000-000000000001}"

if [[ "$(docker inspect -f '{{.State.Running}}' "$WEB_CONTAINER" 2>/dev/null || echo false)" != true ]]; then
  echo "Container $WEB_CONTAINER not running. Run: make up" >&2
  exit 1
fi

css_bytes="$(docker exec "$WEB_CONTAINER" sh -c 'wc -c /usr/share/nginx/html/assets/*.css 2>/dev/null | head -1 | awk "{print \$1}"')"
if [[ -z "$css_bytes" ]] || [[ "$css_bytes" -lt "$MIN_CSS_BYTES" ]]; then
  echo "STALE web image: CSS ${css_bytes:-0} bytes (need >= $MIN_CSS_BYTES). Run: make build && docker compose -f aisss/docker-compose.yaml up -d web" >&2
  exit 1
fi

if ! docker exec "$WEB_CONTAINER" sh -c 'grep -q gh-header /usr/share/nginx/html/assets/*.css'; then
  echo "STALE web image: .gh-header missing from CSS" >&2
  exit 1
fi

echo "OK web: CSS ${css_bytes} bytes, gh-header present"

if [[ "${SKIP_API_BOM:-0}" != 1 ]]; then
  head_bytes="$(curl -s -H "X-AISSS-User-Id: $USER_ID" "http://127.0.0.1:${API_PORT}/api/audit-logs?export=csv" | head -c 3 | xxd -p 2>/dev/null || true)"
  if [[ "$head_bytes" != "efbbbf" ]]; then
    echo "WARN api: audit CSV BOM check failed (got: ${head_bytes:-none})" >&2
  else
    echo "OK api: audit CSV has UTF-8 BOM"
  fi
fi

echo "verify-docker-deploy: passed"
