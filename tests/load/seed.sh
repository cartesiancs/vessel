#!/usr/bin/env bash
# Inflate the test DB with bulk rows so listing scenarios surface query cost.
# Idempotent: re-running adds another batch (uses unique suffixes from $RANDOM).
#
# Env knobs:
#   SEED_DEVICES=10000   number of devices to create
#   SEED_FLOWS=200       number of flows to create

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "$SCRIPT_DIR/env.sh"

SEED_DEVICES="${SEED_DEVICES:-10000}"
SEED_FLOWS="${SEED_FLOWS:-200}"

token="$(curl -fsS -X POST "$VESSEL_URL/api/auth" \
  -H 'Content-Type: application/json' \
  -d "{\"id\":\"$VESSEL_ADMIN_USER\",\"password\":\"$VESSEL_ADMIN_PASS\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

if [[ -z "$token" ]]; then
  echo "[seed] auth failed" >&2; exit 1
fi

echo "[seed] inserting $SEED_DEVICES devices"
suffix="$RANDOM"
for i in $(seq 1 "$SEED_DEVICES"); do
  curl -fsS -X POST "$VESSEL_URL/api/devices" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "{\"device_id\":\"seed-${suffix}-${i}\",\"name\":\"seed-${suffix}-${i}\",\"manufacturer\":\"loadgen\",\"model\":\"L-${i}\"}" \
    >/dev/null || { echo "[seed] device $i failed (continuing)"; }
  if (( i % 500 == 0 )); then echo "[seed] devices: $i"; fi
done

echo "[seed] inserting $SEED_FLOWS flows"
for i in $(seq 1 "$SEED_FLOWS"); do
  curl -fsS -X POST "$VESSEL_URL/api/flows" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"seed-flow-${suffix}-${i}\",\"description\":\"load-test\",\"enabled\":0}" \
    >/dev/null || { echo "[seed] flow $i failed (continuing)"; }
done

echo "[seed] done"
