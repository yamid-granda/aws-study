import { check } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "2m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
    errors: ["rate<0.02"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  const ok = check(res, { "status is 200": (r) => r.status === 200 });
  errorRate.add(!ok);
}
