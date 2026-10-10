import { check, sleep } from "k6";
import http from "k6/http";

export const options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";

export default function () {
  const endpoints = [`${BASE_URL}/health`, `${BASE_URL}/hello?name=k6`];
  for (const url of endpoints) {
    const res = http.get(url);
    check(res, {
      [`${url} status is 200`]: (r) => r.status === 200,
      [`${url} responds fast`]: (r) => r.timings.duration < 1500,
    });
  }
  sleep(1);
}
