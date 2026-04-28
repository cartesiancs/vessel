// L1 — REST API smoke
//
// Targets:  GET /info, /api/devices, /api/flows, /api/streams, /api/recordings
// Pressure: ramp 50→500 VU over 5 minutes.
// Watch:    p95 < 200ms, error rate < 1%, r2d2 pool exhaustion (5xx, timeout),
//           SQLite "database is locked" log lines on the server side.

import http from "k6/http";
import { sleep } from "k6";
import { login, authHeaders, baseUrl } from "./lib/auth.js";
import { standardThresholds, ok2xx } from "./lib/http.js";

export const options = {
  thresholds: standardThresholds,
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "1m", target: 200 },
        { duration: "2m", target: 500 },
        { duration: "1m", target: 500 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
};

export function setup() {
  return { token: login() };
}

const READ_PATHS = [
  "/api/devices",
  "/api/flows",
  "/api/streams",
  "/api/recordings",
];

export default function (data) {
  const headers = authHeaders(data.token);

  const info = http.get(`${baseUrl}/info`);
  ok2xx(info, "info");

  const path = READ_PATHS[Math.floor(Math.random() * READ_PATHS.length)];
  const res = http.get(`${baseUrl}${path}`, { headers });
  ok2xx(res, path);

  sleep(0.2 + Math.random() * 0.3);
}
