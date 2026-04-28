#!/usr/bin/env bash
# C1 — Inject 200ms ± 100 latency on the vessel-api proxy and replay api-smoke.
#
# Pass criterion: k6 still completes; no 5xx; client-side timeouts surface as
# 504s, not server panics in log/app.log.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOAD_DIR="$(cd "$SCRIPT_DIR/../../load" && pwd)"
# shellcheck source=../../load/env.sh
source "$LOAD_DIR/env.sh"

TOXI="${TOXI:-http://localhost:8474}"
PROXY_URL="http://localhost:6175"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[chaos] missing dependency: $1" >&2; exit 1
  fi
}
require curl
require k6

cleanup() {
  curl -fsS -X DELETE "$TOXI/proxies/vessel-api/toxics/lat" >/dev/null || true
}
trap cleanup EXIT

echo "[chaos:api-latency] adding latency toxic 200ms±100 on vessel-api"
curl -fsS -X POST "$TOXI/proxies/vessel-api/toxics" \
  -H 'Content-Type: application/json' \
  -d '{"name":"lat","type":"latency","stream":"downstream","attributes":{"latency":200,"jitter":100}}' \
  >/dev/null

ts="$(date +%Y%m%d-%H%M%S)"
out="$VESSEL_RESULTS_DIR/chaos-api-latency-${ts}.json"

VESSEL_URL="$PROXY_URL" \
VESSEL_ADMIN_USER="$VESSEL_ADMIN_USER" \
VESSEL_ADMIN_PASS="$VESSEL_ADMIN_PASS" \
  k6 run --summary-export="$out" "$LOAD_DIR/k6/01-api-smoke.js"

echo "[chaos:api-latency] result: $out"
