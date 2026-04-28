#!/usr/bin/env bash
# Stop the load-test server started by start-test-server.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "$SCRIPT_DIR/env.sh"

if [[ ! -f "$VESSEL_PID_FILE" ]]; then
  echo "[stop] no pid file at $VESSEL_PID_FILE; nothing to do"
  exit 0
fi

PID="$(cat "$VESSEL_PID_FILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "[stop] pid $PID not running; cleaning pid file"
  rm -f "$VESSEL_PID_FILE"
  exit 0
fi

echo "[stop] sending SIGINT to $PID"
kill -INT "$PID" || true

for _ in $(seq 1 30); do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$VESSEL_PID_FILE"
    echo "[stop] stopped"
    exit 0
  fi
  sleep 1
done

echo "[stop] SIGINT timed out; sending SIGKILL"
kill -KILL "$PID" 2>/dev/null || true
rm -f "$VESSEL_PID_FILE"
