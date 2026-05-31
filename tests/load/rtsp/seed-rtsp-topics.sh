#!/usr/bin/env bash
# L7 — Register N RTSP feeds as entities so RtspPullAdapter spawns pipelines.
#
# Pipeline: device → entity (platform=RTSP) → entity_configurations.rtsp_url
# After remap_topics fires (on entity create), the RTSP puller picks up new
# topics on the next topic_map_notify tick.
#
# Usage:
#   tests/load/rtsp/seed-rtsp-topics.sh [num=32]
#
# Env:
#   RTSP_HOST    default: localhost
#   RTSP_MOCK_PORT  default: 8554

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../env.sh
source "$SCRIPT_DIR/../env.sh"

NUM="${1:-32}"
RTSP_HOST="${RTSP_HOST:-localhost}"
RTSP_MOCK_PORT="${RTSP_MOCK_PORT:-8554}"

token="$(curl -fsS -X POST "$VESSEL_URL/api/auth" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":\"$VESSEL_ADMIN_USER\",\"password\":\"$VESSEL_ADMIN_PASS\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

if [[ -z "$token" ]]; then
  echo "[rtsp-seed] auth failed" >&2; exit 1
fi

run_id="$(date +%s)"
echo "[rtsp-seed] registering $NUM RTSP entities (run=$run_id)"

for i in $(seq 0 $((NUM - 1))); do
  device_id="rtsp-${run_id}-${i}"
  rtsp_url="rtsp://${RTSP_HOST}:${RTSP_MOCK_PORT}/cam${i}"

  device_resp="$(curl -fsS -X POST "$VESSEL_URL/api/devices" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "{\"device_id\":\"$device_id\",\"name\":\"$device_id\",\"manufacturer\":\"loadgen\",\"model\":\"rtsp\"}")"

  device_pk="$(echo "$device_resp" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

  curl -fsS -X POST "$VESSEL_URL/api/entities" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "$(cat <<JSON
{
  "entity_id": "$device_id-cam",
  "device_id": $device_pk,
  "friendly_name": "rtsp-cam-$i",
  "platform": "RTSP",
  "entity_type": "camera",
  "configuration": { "rtsp_url": "$rtsp_url" }
}
JSON
)" >/dev/null

  if (( (i + 1) % 8 == 0 )); then echo "[rtsp-seed] $((i + 1))/$NUM"; fi
done

echo "[rtsp-seed] done. RtspPullAdapter should spawn pipelines on the next topic_map tick."
