# Load tests

Runnable scripts. No CI integration. All artifacts land in `.tmp/` (gitignored).

## Quick start

```bash
# 1. Boot an isolated server (own DB at tests/load/.tmp/database.db)
tests/load/start-test-server.sh

# 2. Run a scenario
tests/load/run.sh api-smoke

# 3. Stop
tests/load/stop-test-server.sh
```

> Admin credentials are `admin / admin` (the value seeded by
> `create_initial_admin` in `apps/server/src/init/db_record.rs`). This
> intentionally differs from `tests/api.test.js`, which targets the dev DB at
> the repo root where the password has been rotated. The load suite always
> boots a fresh `.tmp/database.db` so the seeded value applies.

For RTP scenarios, start the server with `--enable-rtp`:

```bash
tests/load/start-test-server.sh --enable-rtp
tests/load/run.sh rtp-fanout
```

For listing scenarios, populate bulk rows first:

```bash
tests/load/start-test-server.sh
tests/load/seed.sh                   # or: SEED_DEVICES=20000 tests/load/seed.sh
tests/load/run.sh listing
```

## Scenarios

| ID | `run.sh` arg | What it does |
|----|--------------|--------------|
| L1 | `api-smoke`     | k6 ramps 50→500 VU on hot GET endpoints. |
| L2 | `api-write`     | k6 sustained POST/PUT for 3m. |
| L3 | `auth-flood`    | k6 ramps `POST /api/auth` to surface bcrypt CPU pressure. |
| L4 | `listing`       | k6 paginates large lists; run `seed.sh` first. |
| L5 | `rtp-fanout`    | gst-launch fans out N synthetic SSRCs to UDP:5004. |
| L6 | `rtp-malformed` | Python flood of unknown-SSRC and random bytes to UDP:5004. |
| L7 | `rtsp-fleet`    | Registers N RTSP URLs as streams; needs `rtsp/start-rtsp-mock.sh`. |

## Dependencies

- `k6` for L1–L4 (`brew install k6` / [k6.io](https://k6.io))
- `gst-launch-1.0` for L5 (already required by the server)
- `python3` for L6
- `docker` for L7 (mediamtx mock)
- `sqlite3` only if you pass `--enable-rtp` / `--enable-mqtt` to the start script

## Config

`env.sh` exports defaults. Override before running, e.g.:

```bash
VESSEL_LISTEN_PORT=6175 tests/load/start-test-server.sh
VESSEL_URL=http://localhost:6175 tests/load/run.sh api-smoke
```

## Results

k6 summaries → `tests/load/.tmp/results/<scenario>-<timestamp>.json`.
Server stdout → `tests/load/.tmp/server.stdout.log`.
Server tracing log → `log/app.log` at repo root (rotated daily by the server).
