import { check, sleep } from "k6";
import http from "k6/http";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";

export default function () {
  const res = http.get(`${BASE_URL}/hello?name=k6`);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "has greeting": (r) => r.json("message") !== undefined,
  });
  sleep(1);
}
