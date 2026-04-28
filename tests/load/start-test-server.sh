#!/usr/bin/env bash
# Boots a release server with an isolated config and temp DB so load/chaos
# tests don't pollute the dev DB at the repo root.
#
# Steps (mirrors plan):
#   1. Wipe ./tmp DB.
#   2. Render config.test.toml with fresh secret.
#   3. cargo build --release -p server (idempotent).
#   4. Boot once briefly to let migrations + seed run, then stop.
#   5. Optional: enable rtp_broker_port via direct UPDATE on system_configurations.
#   6. Boot for real, write pid, poll /info.
#
# Flags:
#   --enable-rtp     flip rtp_broker_port enabled=1 (default off)
#   --enable-mqtt    flip mqtt_broker_url enabled=1 (default off)
#   --skip-build     reuse existing target/release/server
#
# Usage:
#   tests/load/start-test-server.sh [--enable-rtp] [--enable-mqtt] [--skip-build]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "$SCRIPT_DIR/env.sh"

ENABLE_RTP=0
ENABLE_MQTT=0
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --enable-rtp) ENABLE_RTP=1 ;;
    --enable-mqtt) ENABLE_MQTT=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

echo "[start] repo=$VESSEL_REPO_ROOT tmp=$VESSEL_TMP_DIR"

if [[ -f "$VESSEL_PID_FILE" ]] && kill -0 "$(cat "$VESSEL_PID_FILE")" 2>/dev/null; then
  echo "[start] server already running with pid $(cat "$VESSEL_PID_FILE"). Run stop-test-server.sh first." >&2
  exit 1
fi

# Detect a different process holding the port (e.g. the user's dev server).
if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$VESSEL_LISTEN_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[start] port $VESSEL_LISTEN_PORT is already bound by another process:" >&2
    lsof -nP -iTCP:"$VESSEL_LISTEN_PORT" -sTCP:LISTEN >&2 || true
    echo "[start] stop that process or set VESSEL_LISTEN_PORT to a free port." >&2
    exit 1
  fi
fi

rm -f "$VESSEL_DB_PATH" "$VESSEL_DB_PATH-shm" "$VESSEL_DB_PATH-wal"

# `tr | head` triggers SIGPIPE under pipefail; isolate it.
JWT_SECRET="$(set +o pipefail; LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
sed \
  -e "s|__JWT_SECRET__|$JWT_SECRET|" \
  -e "s|__LISTEN_ADDRESS__|${VESSEL_LISTEN_HOST}:${VESSEL_LISTEN_PORT}|" \
  -e "s|__DATABASE_URL__|$VESSEL_DB_PATH|" \
  "$SCRIPT_DIR/config.test.toml" > "$VESSEL_CONFIG_PATH"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "[start] cargo build --release -p server"
  (cd "$VESSEL_REPO_ROOT" && cargo build --release -p server)
fi

if [[ ! -x "$VESSEL_SERVER_BIN" ]]; then
  echo "[start] missing $VESSEL_SERVER_BIN" >&2
  exit 1
fi

# First boot: let migrations + seed run, then stop.
echo "[start] priming DB (migrations + seed)"
pushd "$VESSEL_TMP_DIR" >/dev/null
"$VESSEL_SERVER_BIN" >"$VESSEL_TMP_DIR/server.prime.log" 2>&1 &
PRIME_PID=$!
popd >/dev/null
sleep 4
kill -INT "$PRIME_PID" 2>/dev/null || true
for _ in $(seq 1 10); do
  kill -0 "$PRIME_PID" 2>/dev/null || break
  sleep 0.5
done
kill -KILL "$PRIME_PID" 2>/dev/null || true
wait "$PRIME_PID" 2>/dev/null || true

if [[ "$ENABLE_RTP" -eq 1 || "$ENABLE_MQTT" -eq 1 ]]; then
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "[start] sqlite3 not found; cannot toggle config flags" >&2
    exit 1
  fi
  if [[ "$ENABLE_RTP" -eq 1 ]]; then
    sqlite3 "$VESSEL_DB_PATH" "UPDATE system_configurations SET enabled=1 WHERE key='rtp_broker_port';"
    echo "[start] enabled rtp_broker_port"
  fi
  if [[ "$ENABLE_MQTT" -eq 1 ]]; then
    sqlite3 "$VESSEL_DB_PATH" "UPDATE system_configurations SET enabled=1 WHERE key='mqtt_broker_url';"
    echo "[start] enabled mqtt_broker_url"
  fi
fi

echo "[start] launching server"
pushd "$VESSEL_TMP_DIR" >/dev/null
"$VESSEL_SERVER_BIN" >"$VESSEL_TMP_DIR/server.stdout.log" 2>&1 &
SERVER_PID=$!
popd >/dev/null
echo "$SERVER_PID" > "$VESSEL_PID_FILE"

echo "[start] pid=$SERVER_PID, polling $VESSEL_URL/info"
for _ in $(seq 1 30); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[start] server pid $SERVER_PID exited prematurely; tail of stdout:" >&2
    tail -n 50 "$VESSEL_TMP_DIR/server.stdout.log" >&2 || true
    rm -f "$VESSEL_PID_FILE"
    exit 1
  fi
  if curl -fsS "$VESSEL_URL/info" >/dev/null 2>&1; then
    echo "[start] ready at $VESSEL_URL"
    exit 0
  fi
  sleep 1
done

echo "[start] server failed to become ready in 30s; tail of stdout:" >&2
tail -n 50 "$VESSEL_TMP_DIR/server.stdout.log" >&2 || true
exit 1
