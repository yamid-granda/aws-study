import { check } from "k6";
import http from "k6/http";
import type { Options } from "k6/options";

// LocalStack scenario, four ascending stages: 10 → 20 → 30 → 50
// product creations/s (10s each, ~40s, ~900 requests total).
// NOTE: `stages` sets the arrival rate — VUs are just workers. Against
// LocalStack (emulated Lambda, ~30s/req under load) expect VU starvation
// (`dropped_iterations`) and crossed thresholds; that measures the
// emulator, not this code. maxVUs stays modest on purpose: ~900 piled-up
// VUs already OOM-killed the k6 Docker container once.
export const options: Options = {
  scenarios: {
    create_products: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      stages: [
        { target: 10, duration: "2s" },
        { target: 20, duration: "2s" },
        { target: 30, duration: "2s" },
      ],
      preAllocatedVUs: 300,
      maxVUs: 2000,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000", "p(99)<3000"],
  },
};

const BASE_URL: string = __ENV.BASE_URL ?? "";
if (!BASE_URL) {
  throw new Error(
    "BASE_URL is required — run this test via `npm run tests:perf` or " +
      "`npm run test:perf:products:docker` (they boot LocalStack and set it), " +
      "or export BASE_URL=$(npm run -s stack:url).",
  );
}

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
