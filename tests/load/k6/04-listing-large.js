// L4 — Listing under volume
//
// Targets:  GET /api/devices, /api/flows, /api/recordings
// Pressure: 100 RPS sustained for 2 minutes, after seed.sh has populated
//           ~10k device rows.
// Watch:    per-row JSON serialization cost, query cost without indexes,
//           memory growth during full-table reads.

import http from "k6/http";
import { login, authHeaders, baseUrl } from "./lib/auth.js";
import { ok2xx } from "./lib/http.js";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
  scenarios: {
    list: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 100,
      maxVUs: 400,
    },
  },
};

export function setup() {
  return { token: login() };
}

const PATHS = ["/api/devices", "/api/flows", "/api/recordings"];

export default function (data) {
  const headers = authHeaders(data.token);
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${baseUrl}${path}`, { headers });
  ok2xx(res, path);
}
