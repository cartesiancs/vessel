// L3 — Auth flood (bcrypt CPU pressure)
//
// Targets:  POST /api/auth
// Pressure: ramp 5→100 RPS over 3 minutes.
// Watch:    server CPU saturates on bcrypt, p95 latency for unrelated GETs
//           climbs (read /info from a side scenario in a separate run to
//           confirm runtime starvation).
//
// Note: this is expected to surface a real DoS vector. Treat failures as
// findings, not as broken tests.

import http from "k6/http";
import { check } from "k6";
import { baseUrl } from "./lib/auth.js";

export const options = {
  thresholds: {
    // Allow server to reject; we want to observe behavior, not assert success.
    http_req_failed: ["rate<0.50"],
  },
  scenarios: {
    flood: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 60 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 100 },
      ],
      preAllocatedVUs: 50,
      maxVUs: 300,
    },
  },
};

const ADMIN_USER = __ENV.VESSEL_ADMIN_USER || "admin";
const ADMIN_PASS = __ENV.VESSEL_ADMIN_PASS || "admin1";

export default function () {
  const res = http.post(
    `${baseUrl}/api/auth`,
    JSON.stringify({ id: ADMIN_USER, password: ADMIN_PASS }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, {
    "status not 5xx": (r) => r.status < 500,
  });
}
