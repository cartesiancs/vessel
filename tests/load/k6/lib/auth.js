import http from "k6/http";
import { check, fail } from "k6";

const VESSEL_URL = __ENV.VESSEL_URL || "http://127.0.0.1:6174";
const ADMIN_USER = __ENV.VESSEL_ADMIN_USER || "admin";
const ADMIN_PASS = __ENV.VESSEL_ADMIN_PASS || "admin1";

export function login() {
  const res = http.post(
    `${VESSEL_URL}/api/auth`,
    JSON.stringify({ id: ADMIN_USER, password: ADMIN_PASS }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (!check(res, { "auth 200": (r) => r.status === 200 })) {
    fail(`auth failed: ${res.status} ${res.body}`);
  }
  return res.json("token");
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export const baseUrl = VESSEL_URL;
