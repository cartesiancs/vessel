// L2 — Write-heavy
//
// Targets:  POST /api/devices, POST /api/flows
// Pressure: ~50 RPS sustained, 3 minutes.
// Watch:    SQLite WAL contention, busy_timeout (5s) hits, lingering writes
//           after stop, response time degradation across the run.

import http from "k6/http";
import { login, authHeaders, baseUrl } from "./lib/auth.js";
import { ok2xx } from "./lib/http.js";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<500"],
  },
  scenarios: {
    writes: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1s",
      duration: "3m",
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  const headers = authHeaders(data.token);
  const id = `${__VU}-${__ITER}-${Date.now()}`;

  if (Math.random() < 0.7) {
    const res = http.post(
      `${baseUrl}/api/devices`,
      JSON.stringify({
        device_id: `w-${id}`,
        name: `w-${id}`,
        manufacturer: "loadgen",
        model: "writer",
      }),
      { headers },
    );
    ok2xx(res, "POST /api/devices");
  } else {
    const res = http.post(
      `${baseUrl}/api/flows`,
      JSON.stringify({
        name: `wf-${id}`,
        description: "load-test",
        enabled: 0,
      }),
      { headers },
    );
    ok2xx(res, "POST /api/flows");
  }
}
