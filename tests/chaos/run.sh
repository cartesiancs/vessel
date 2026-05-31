#!/usr/bin/env bash
# Entry for chaos scenarios. Assumes:
#   - vessel server running on host :6174 (tests/load/start-test-server.sh)
#   - docker compose up -d in this directory  (toxiproxy + mediamtx)
#
# Usage: tests/chaos/run.sh <scenario>
#
# Scenarios:
#   api-latency       C1 — 200ms±100 latency on /api proxy, replay api-smoke
#   api-slow-close    C2 — slow_close + timeout, replay api-smoke
#   rtsp-bandwidth    C3 — 64kbps cap on RTSP origin proxy
#   rtsp-down         C4 — toggle RTSP proxy down/up 5x

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

scenario="${1:-}"
if [[ -z "$scenario" ]]; then
  grep -E '^#   [a-z]' "$0" | sed 's/^#   //'
  exit 2
fi

case "$scenario" in
  api-latency|api-slow-close|rtsp-bandwidth|rtsp-down)
    exec "$SCRIPT_DIR/scenarios/${scenario}.sh"
    ;;
  *)
    echo "[chaos] unknown scenario: $scenario" >&2
    exit 2
    ;;
esac
