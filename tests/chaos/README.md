# Chaos tests (Toxiproxy)

Network-level fault injection in front of the vessel API and RTSP origin.
Server code is untouched — toxiproxy sits in between and applies toxics.

## Prerequisites

- `docker` + `docker compose`
- `k6` (for C1, C2)
- The load-test server already booted: `tests/load/start-test-server.sh`

## Running

```bash
# 1. Bring up toxiproxy + mediamtx
docker compose -f tests/chaos/docker-compose.yml up -d

# 2. Run a scenario
tests/chaos/run.sh api-latency
tests/chaos/run.sh api-slow-close
tests/chaos/run.sh rtsp-bandwidth
tests/chaos/run.sh rtsp-down

# 3. Tear down
docker compose -f tests/chaos/docker-compose.yml down
```

## Scenarios

| ID | Scenario | Toxic | Pass criterion |
|----|----------|-------|----------------|
| C1 | `api-latency`     | `latency` 200ms±100 on `vessel-api` proxy | k6 finishes; no 5xx; no server panic |
| C2 | `api-slow-close`  | `slow_close` + `timeout` on `vessel-api` | FD count bounded before vs after |
| C3 | `rtsp-bandwidth`  | `bandwidth=64kbps` on `rtsp-mock`        | Pipelines stay alive; logs show throttling |
| C4 | `rtsp-down`       | proxy `enabled=false` 30s × 5 cycles     | Pipelines reconnect (likely surfaces real gap) |

## Endpoints exposed by docker-compose

- `http://localhost:8474` — Toxiproxy admin API
- `http://localhost:6175` — proxy in front of host:6174 (vessel API)
- `rtsp://localhost:8555` — proxy in front of mediamtx:8554

## Pointing the load suite at the proxy

```bash
VESSEL_URL=http://localhost:6175 tests/load/run.sh api-smoke
```

For RTSP fleet against the proxy:

```bash
RTSP_HOST=localhost RTSP_MOCK_PORT=8555 tests/load/rtsp/seed-rtsp-topics.sh 8
```

## Adding a new toxic ad hoc

```bash
curl -X POST http://localhost:8474/proxies/vessel-api/toxics \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-toxic","type":"latency","attributes":{"latency":500}}'
```

Toxic types: `latency`, `bandwidth`, `slow_close`, `timeout`, `slicer`,
`limit_data`, `reset_peer`. See [Toxiproxy docs](https://github.com/Shopify/toxiproxy#toxics).
