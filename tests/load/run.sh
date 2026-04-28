#!/usr/bin/env bash
# Entrypoint for load scenarios. Assumes start-test-server.sh has been run.
#
# Usage:
#   tests/load/run.sh <scenario>
#
# Scenarios:
#   api-smoke        L1 — ramped GET hot reads
#   api-write        L2 — sustained writes
#   auth-flood       L3 — bcrypt CPU pressure
#   listing          L4 — large-list pagination (run seed.sh first)
#   rtp-fanout       L5 — gst-launch multi-SSRC (requires --enable-rtp)
#   rtp-malformed    L6 — unknown SSRC + random byte UDP flood
#   rtsp-fleet       L7 — register N RTSP topics (requires rtsp mock)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "$SCRIPT_DIR/env.sh"

scenario="${1:-}"
if [[ -z "$scenario" ]]; then
  grep -E '^#   [a-z]' "$0" | sed 's/^#   //'
  exit 2
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="$VESSEL_RESULTS_DIR/${scenario}-${ts}.json"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[run] missing dependency: $1" >&2
    exit 1
  fi
}

case "$scenario" in
  api-smoke|api-write|auth-flood|listing)
    require k6
    case "$scenario" in
      api-smoke)  script="$SCRIPT_DIR/k6/01-api-smoke.js"  ;;
      api-write)  script="$SCRIPT_DIR/k6/02-api-write.js"  ;;
      auth-flood) script="$SCRIPT_DIR/k6/03-auth-flood.js" ;;
      listing)    script="$SCRIPT_DIR/k6/04-listing-large.js" ;;
    esac
    echo "[run] k6 $script → $out"
    VESSEL_URL="$VESSEL_URL" \
    VESSEL_ADMIN_USER="$VESSEL_ADMIN_USER" \
    VESSEL_ADMIN_PASS="$VESSEL_ADMIN_PASS" \
      k6 run --summary-export="$out" "$script"
    ;;

  rtp-fanout)
    require gst-launch-1.0
    "$SCRIPT_DIR/rtp/gen-multi-ssrc.sh" "${RTP_NUM_SSRC:-64}" "${RTP_DURATION:-300}"
    ;;

  rtp-malformed)
    require python3
    "$SCRIPT_DIR/rtp/gen-malformed.py" --duration "${RTP_DURATION:-120}"
    ;;

  rtsp-fleet)
    "$SCRIPT_DIR/rtsp/seed-rtsp-topics.sh" "${RTSP_NUM:-32}"
    ;;

  *)
    echo "[run] unknown scenario: $scenario" >&2
    exit 2
    ;;
esac
