#!/usr/bin/env bash
# C2 — slow_close + timeout toxic on vessel-api proxy.
#
# Pass criterion: server-side connection count and FD count stay bounded
# during the run. Verify with `lsof -p $(cat tests/load/.tmp/server.pid) | wc -l`
# before and after.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOAD_DIR="$(cd "$SCRIPT_DIR/../../load" && pwd)"
# shellcheck source=../../load/env.sh
source "$LOAD_DIR/env.sh"

TOXI="${TOXI:-http://localhost:8474}"
PROXY_URL="http://localhost:6175"

cleanup() {
  curl -fsS -X DELETE "$TOXI/proxies/vessel-api/toxics/slowclose" >/dev/null || true
  curl -fsS -X DELETE "$TOXI/proxies/vessel-api/toxics/timeout" >/dev/null || true
}
trap cleanup EXIT

echo "[chaos:api-slow-close] FD count before:"
if [[ -f "$VESSEL_PID_FILE" ]]; then
  PID="$(cat "$VESSEL_PID_FILE")"
  lsof -p "$PID" 2>/dev/null | wc -l || true
fi

echo "[chaos:api-slow-close] adding slow_close=5000 + timeout=2000 toxics"
curl -fsS -X POST "$TOXI/proxies/vessel-api/toxics" \
  -H 'Content-Type: application/json' \
  -d '{"name":"slowclose","type":"slow_close","stream":"downstream","attributes":{"delay":5000}}' \
  >/dev/null
curl -fsS -X POST "$TOXI/proxies/vessel-api/toxics" \
  -H 'Content-Type: application/json' \
  -d '{"name":"timeout","type":"timeout","stream":"downstream","attributes":{"timeout":2000}}' \
  >/dev/null

ts="$(date +%Y%m%d-%H%M%S)"
out="$VESSEL_RESULTS_DIR/chaos-api-slow-close-${ts}.json"

VESSEL_URL="$PROXY_URL" \
  k6 run --summary-export="$out" "$LOAD_DIR/k6/01-api-smoke.js" || true

echo "[chaos:api-slow-close] FD count after:"
if [[ -f "$VESSEL_PID_FILE" ]]; then
  PID="$(cat "$VESSEL_PID_FILE")"
  lsof -p "$PID" 2>/dev/null | wc -l || true
fi
echo "[chaos:api-slow-close] result: $out"
