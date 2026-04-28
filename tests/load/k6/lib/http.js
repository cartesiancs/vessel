import { check } from "k6";

export const standardThresholds = {
  http_req_failed: ["rate<0.01"],
  http_req_duration: ["p(95)<200", "p(99)<500"],
};

export function ok2xx(res, name) {
  return check(res, {
    [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
}
