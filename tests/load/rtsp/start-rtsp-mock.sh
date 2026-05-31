#!/usr/bin/env bash
# Brings up a mediamtx container that serves N synthetic RTSP feeds at
# rtsp://localhost:${RTSP_MOCK_PORT}/cam0..cam{N-1}.
#
# Usage:
#   tests/load/rtsp/start-rtsp-mock.sh         # foreground, default port 8554
#
# Stop with Ctrl-C or `docker stop vessel-rtsp-mock`.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../env.sh
source "$SCRIPT_DIR/../env.sh"

PORT="${RTSP_MOCK_PORT:-8554}"
NAME="${RTSP_MOCK_NAME:-vessel-rtsp-mock}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[rtsp-mock] docker not found" >&2; exit 1
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true

echo "[rtsp-mock] starting $NAME on rtsp://localhost:${PORT}"
exec docker run --rm --name "$NAME" \
  -p "${PORT}:8554" \
  -v "$SCRIPT_DIR/mediamtx.yml:/mediamtx.yml" \
  bluenviron/mediamtx:latest
