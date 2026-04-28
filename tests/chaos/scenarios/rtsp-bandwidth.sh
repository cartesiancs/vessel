#!/usr/bin/env bash
# C3 — Bandwidth cap on the RTSP origin proxy (64kbps).
#
# Setup:
#   1. tests/load/start-test-server.sh
#   2. docker compose -f tests/chaos/docker-compose.yml up -d
#   3. (separately, register a few entities pointing at rtsp://localhost:8555/cam0)
#      Use tests/load/rtsp/seed-rtsp-topics.sh with RTSP_HOST=localhost RTSP_MOCK_PORT=8555
#
# Pass criterion: gst pipelines stay alive (DashMap entries unchanged); logs
# show throttling, not panics.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOAD_DIR="$(cd "$SCRIPT_DIR/../../load" && pwd)"
# shellcheck source=../../load/env.sh
source "$LOAD_DIR/env.sh"

TOXI="${TOXI:-http://localhost:8474}"
DURATION="${DURATION:-180}"

cleanup() {
  curl -fsS -X DELETE "$TOXI/proxies/rtsp-mock/toxics/bw" >/dev/null || true
}
trap cleanup EXIT

echo "[chaos:rtsp-bandwidth] adding bandwidth=64kbps to rtsp-mock for ${DURATION}s"
curl -fsS -X POST "$TOXI/proxies/rtsp-mock/toxics" \
  -H 'Content-Type: application/json' \
  -d '{"name":"bw","type":"bandwidth","stream":"downstream","attributes":{"rate":64}}' \
  >/dev/null

echo "[chaos:rtsp-bandwidth] running for ${DURATION}s. tail log/app.log in another shell."
sleep "$DURATION"
echo "[chaos:rtsp-bandwidth] done"
