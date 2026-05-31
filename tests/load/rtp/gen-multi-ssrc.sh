#!/usr/bin/env bash
# L5 — RTP multi-SSRC fan-out
#
# Spawns N parallel gst-launch pipelines, each producing a different SSRC,
# all targeting UDP:$VESSEL_RTP_PORT (default 5004).
#
# Usage: gen-multi-ssrc.sh [num_ssrc=64] [duration_sec=300]
#
# Requirements: server started with --enable-rtp; gst-launch-1.0 in PATH;
#               for each SSRC there should be a registered stream in the DB
#               with the matching ssrc — otherwise the server will silently
#               drop packets for that SSRC. Use this script alongside the
#               server's stream creation API or the "Devices/Streams" UI.
#
# Watch on the server side:
#   tail -f log/app.log | grep -E 'ONLINE|lagging|unmarshal'

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../env.sh
source "$SCRIPT_DIR/../env.sh"

NUM="${1:-64}"
DURATION="${2:-300}"
HOST="${VESSEL_LISTEN_HOST}"
PORT="${VESSEL_RTP_PORT}"

if ! command -v gst-launch-1.0 >/dev/null 2>&1; then
  echo "[rtp] gst-launch-1.0 not found" >&2; exit 1
fi

echo "[rtp] sending $NUM SSRCs to ${HOST}:${PORT} for ${DURATION}s"

pids=()
for i in $(seq 1 "$NUM"); do
  ssrc=$((1000 + i))
  gst-launch-1.0 -q \
    videotestsrc is-live=true pattern=ball ! \
    video/x-raw,width=320,height=240,framerate=25/1 ! \
    x264enc tune=zerolatency speed-preset=ultrafast bitrate=200 ! \
    rtph264pay config-interval=1 pt=96 ssrc="$ssrc" ! \
    udpsink host="$HOST" port="$PORT" sync=false &
  pids+=($!)
done

trap 'echo "[rtp] stopping"; kill "${pids[@]}" 2>/dev/null || true; wait 2>/dev/null || true' EXIT INT TERM

sleep "$DURATION"
