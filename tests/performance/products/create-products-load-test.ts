import { check } from "k6";
import http from "k6/http";
import type { Options } from "k6/options";

// Single 10s stage at a constant 100 product creations/s (1000 total).
// NOTE: `stages` controls concurrent VUs, not request rate — pinning RPS
// needs the arrival-rate executor below (still counts as staged load).
export const options: Options = {
  scenarios: {
    create_products: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
  },
};

const BASE_URL: string = __ENV.BASE_URL || "http://127.0.0.1:3000";

interface CreateProductPayload {
  name: string;
  description: string;
  price: number;
  stock: number;
}

export default function (): void {
  const payload: CreateProductPayload = {
    name: `Perf k6 ${__VU}x${__ITER}`,
    description: `Load-test product from VU ${__VU}, iteration ${__ITER}`,
    price: 99.9,
    stock: 10,
  };
  const res = http.post(`${BASE_URL}/products`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
  check(res, {
    "status is 201": (r) => r.status === 201,
    "has product id": (r) => r.json("product.id") !== undefined,
  });
}
