#!/usr/bin/env bash
# Shared env for tests/load and tests/chaos. Source this from other scripts.
# Override any value via environment before sourcing.
#
# Designed to be sourced from bash. zsh fallback uses $0 when BASH_SOURCE is
# unset.

set -eu

_env_self="${BASH_SOURCE[0]:-$0}"
VESSEL_REPO_ROOT="$(cd "$(dirname "$_env_self")/../.." && pwd)"
export VESSEL_REPO_ROOT

export VESSEL_LOAD_DIR="${VESSEL_LOAD_DIR:-$VESSEL_REPO_ROOT/tests/load}"
export VESSEL_TMP_DIR="${VESSEL_TMP_DIR:-$VESSEL_LOAD_DIR/.tmp}"
export VESSEL_RESULTS_DIR="${VESSEL_RESULTS_DIR:-$VESSEL_TMP_DIR/results}"
export VESSEL_PID_FILE="${VESSEL_PID_FILE:-$VESSEL_TMP_DIR/server.pid}"
export VESSEL_DB_PATH="${VESSEL_DB_PATH:-$VESSEL_TMP_DIR/database.db}"
export VESSEL_CONFIG_PATH="${VESSEL_CONFIG_PATH:-$VESSEL_TMP_DIR/config.toml}"
export VESSEL_SERVER_BIN="${VESSEL_SERVER_BIN:-$VESSEL_REPO_ROOT/target/release/server}"

export VESSEL_LISTEN_HOST="${VESSEL_LISTEN_HOST:-127.0.0.1}"
export VESSEL_LISTEN_PORT="${VESSEL_LISTEN_PORT:-6174}"
export VESSEL_URL="${VESSEL_URL:-http://${VESSEL_LISTEN_HOST}:${VESSEL_LISTEN_PORT}}"

export VESSEL_ADMIN_USER="${VESSEL_ADMIN_USER:-admin}"
# This is the password seeded by create_initial_admin (apps/server/src/init/db_record.rs).
# Note: tests/api.test.js uses "admin1" because the dev DB has had its password
# rotated manually. The load suite always boots a fresh DB, so it uses the seed.
export VESSEL_ADMIN_PASS="${VESSEL_ADMIN_PASS:-admin}"

export VESSEL_RTP_PORT="${VESSEL_RTP_PORT:-5004}"

mkdir -p "$VESSEL_TMP_DIR" "$VESSEL_RESULTS_DIR"
