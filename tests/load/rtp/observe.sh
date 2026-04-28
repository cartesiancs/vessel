#!/usr/bin/env bash
# Tails the server log for events relevant to RTP load runs:
#   ONLINE / OFFLINE  — stream state transitions (rtp_push.rs)
#   lagging           — broadcast::Sender backpressure (state.rs)
#   unmarshal         — malformed-packet warnings
#   panic / FATAL     — crashes
#
# Usage: tests/load/rtp/observe.sh [logfile]
#   default logfile: log/app.log under repo root.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../env.sh
source "$SCRIPT_DIR/../env.sh"

LOG="${1:-$VESSEL_REPO_ROOT/log/app.log}"

if [[ ! -f "$LOG" ]]; then
  echo "[observe] waiting for $LOG to appear..."
  while [[ ! -f "$LOG" ]]; do sleep 1; done
fi

echo "[observe] tailing $LOG"
exec tail -F "$LOG" | grep --line-buffered -E 'ONLINE|OFFLINE|lagging|unmarshal|panic|FATAL'
