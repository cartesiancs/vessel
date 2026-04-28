#!/usr/bin/env bash
# C4 — Toggle the RTSP proxy down/up 5x to test pipeline reconnect behavior.
#
# Expected to surface a real gap: RtspPullAdapter currently respawns
# pipelines only when topic_map_notify fires (apps/server/src/media/rtsp_pull.rs:54-69),
# not on per-pipeline upstream loss. Document the observed behavior.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOAD_DIR="$(cd "$SCRIPT_DIR/../../load" && pwd)"
# shellcheck source=../../load/env.sh
source "$LOAD_DIR/env.sh"

TOXI="${TOXI:-http://localhost:8474}"
CYCLES="${CYCLES:-5}"
DOWN_SEC="${DOWN_SEC:-30}"
UP_SEC="${UP_SEC:-30}"

restore() {
  curl -fsS -X POST "$TOXI/proxies/rtsp-mock" \
    -H 'Content-Type: application/json' \
    -d '{"enabled":true}' >/dev/null || true
}
trap restore EXIT

for c in $(seq 1 "$CYCLES"); do
  echo "[chaos:rtsp-down] cycle $c/$CYCLES — proxy DOWN for ${DOWN_SEC}s"
  curl -fsS -X POST "$TOXI/proxies/rtsp-mock" \
    -H 'Content-Type: application/json' \
    -d '{"enabled":false}' >/dev/null
  sleep "$DOWN_SEC"

  echo "[chaos:rtsp-down] cycle $c/$CYCLES — proxy UP for ${UP_SEC}s"
  curl -fsS -X POST "$TOXI/proxies/rtsp-mock" \
    -H 'Content-Type: application/json' \
    -d '{"enabled":true}' >/dev/null
  sleep "$UP_SEC"
done

echo "[chaos:rtsp-down] done. Inspect log/app.log for pipeline-restart behavior."
