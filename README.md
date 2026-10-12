# aws-study — Multi-Lambda SAM Scaffold (TypeScript)

Multiple AWS Lambdas orchestrated with SAM. Every test runs locally against
[LocalStack](https://localstack.cloud) — no AWS account needed until deploy.

## Prerequisites

- Node.js 20 (`fnm use` / `nvm use`), npm 9+
- Docker running (LocalStack needs it)
- AWS SAM CLI ≥ 1.130 (`sam --version`; ≤ 1.120 fails against modern Docker with `DockerIsNotReachableException`) — used for `build` / `deploy` / `validate`
- AWS CLI (deploys the packaged template to LocalStack)
- k6 via Docker for perf tests (no install needed) or global `k6` · Playwright Chromium only for E2E · AWS credentials only for deploy

> `arm64` throughout (`template.yaml` Globals): native on Apple Silicon, Graviton in AWS. Need `x86_64`? Change the one line, but enable Rosetta in colima or emulation turns flaky.

## Install

```bash
fnm use
npm install
npx playwright install --with-deps chromium   # E2E only
```

## Quickstart

```bash
npm run test:unit     # no setup needed
npm run dev:stack     # LocalStack up + stack deployed + clickable URLs
```

```bash
BASE_URL=$(npm run -s stack:url)
curl "$BASE_URL/health"
curl -X POST "$BASE_URL/products" \
  -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":79.9,"stock":10}'
curl "$BASE_URL/products?limit=10"
```

## Local dev environment

LocalStack is the only local environment: a full AWS emulator (API Gateway +
Lambda + DynamoDB + S3 + CloudFormation) on `:4566`. The app is deployed there
as a real CloudFormation stack from `template.yaml`, so routes, IAM policies
and the products table all match what AWS will see.

One command (start → deploy → print URLs → follow logs):

```bash
npm run dev:stack
```

Manual steps (same stages individually):

```bash
npm run stack:up      # start emulator (:4566). Empty — no API yet!
npm run stack:deploy  # deploy template as stack `aws-study-localstack`
npm run stack:logs    # follow logs
npm run stack:down    # stop (a restart wipes the deployed stack → redeploy)
```

Notes: dummy `test`/`test` creds, `us-east-1`, no account — the image is pinned to `localstack/localstack:4.14` because `latest` requires a `LOCALSTACK_AUTH_TOKEN` since March 2026. Lambda code needs no endpoint config (`src/shared/dynamo.ts` honors LocalStack's injected `AWS_ENDPOINT_URL_*` vars). The API URL changes per deploy (`/restapis/<apiId>/Prod/_user_request_`) — always resolve it with `npm run -s stack:url`.

## Test

| Level | Command | Requires |
|---|---|---|
| Unit (Vitest) | `npm run test:unit` (watch: `test:unit:watch`, coverage: `test:unit:coverage`) | nothing |
| E2E (Playwright) | `npm run test:e2e` (`--ui`, `--headed` variants) | Docker (boots LocalStack + deploys via `scripts/e2e-stack.sh`, or reuses a running stack) |
| Perf suite (k6 via Docker) | `npm run tests:perf` | Docker (self-boots LocalStack + deploys if needed) |
| Perf singles (k6 via Docker) | `npm run test:perf:products:docker` | LocalStack deployed (image `grafana/k6:2.3.0`, override with `K6_IMAGE=...`) |
| Perf singles (k6 global) | `npm run test:perf:products` | `BASE_URL` set + `k6` |
| Static | `npm run check` (Biome) · `npm run typecheck` · `npm run validate` (`sam validate --lint`) | nothing / SAM CLI |

```bash
npm run test:unit
npm run test:e2e      # boots LocalStack + deploys if needed, zero setup
npm run tests:perf    # boots LocalStack + deploys if needed, zero setup
```

## Performance testing (k6)

Load tests live in `tests/performance/*-load-test.ts` (TypeScript, runs natively on k6 ≥ v0.57 — no transpile step). Each file defines staged load (`scenarios`) plus `thresholds` (`http_req_failed`, `http_req_duration`); k6 is for load only, never E2E/smoke. Runner is Dockerized (`grafana/k6:2.3.0`, override with `K6_IMAGE=...`), so no global `k6` install is needed except for the `test:perf:*` (non-Docker) singles.

```bash
npm run tests:perf                                               # full suite (self-booting)
PERF_TESTS="tests/performance/products/create-products-load-test.ts" npm run tests:perf  # one file
npm run test:perf:products:docker                                # one file, direct (stack deployed)
BASE_URL=$(npm run -s stack:url) npm run tests:perf             # target a running stack explicitly
```

Target URL: resolved from the LocalStack deployment (`scripts/localstack-boot.sh` → `scripts/localstack-url.sh` → `scripts/k6-docker.sh`). `BASE_URL` short-circuits the boot and runs against whatever API you point at. LocalStack is left running afterwards; a container restart wipes the deployed stack, so the suite redeploys automatically when no API is found.

## Project structure

```
template.yaml          # SAM: one AWS::Serverless::Function per Lambda + ProductsTable
samconfig.toml         # cloud stack/region (dev)
docker-compose.yml     # LocalStack
src/shared/            # logger.ts (Powertools) · response.ts (ok/badRequest/serverError) · dynamo.ts (endpoint resolution)
src/functions/         # health/ · hello/ (zod validation example) · products/ (CRUD: app, validation, repository, tests)
scripts/               # localstack-*.sh (boot/deploy/url/wait) · e2e-stack.sh · perf-suite.sh · k6-docker.sh
tests/e2e/ · tests/performance/
```

Stack: Lambda + SAM · TypeScript · Biome · Vitest · Playwright · k6 · `@middy/core` + `zod` + Powertools logger · Husky + commitlint · GitHub Actions CI (`biome` → `typecheck` → `test:unit` → `sam build` → `sam validate`).

### Adding a new Lambda

1. Copy `src/functions/hello/` → `src/functions/<name>/`, keep handler thin.
2. Add `AWS::Serverless::Function` in `template.yaml` (`CodeUri: ./`, `Handler: app.handler`, `EntryPoints: [...]`, `Api` event).
3. Add a colocated `app.test.ts` and an E2E spec in `tests/e2e/`.
4. `npm run dev:stack` to verify (redeploys the template).

## Checks & commits

```bash
npm run check && npm run typecheck   # run before finishing any change (pre-commit auto-formats)
```

[Conventional Commits](https://www.conventionalcommits.org/) are mandatory (commitlint rejects the rest): `feat(hello): support greeting by title`. Never `--no-verify`.

## Deploy to AWS (only step needing the cloud)

```bash
npm run deploy:guided   # first time (answers → samconfig.toml)
npm run deploy          # subsequent
API_URL=$(aws cloudformation describe-stacks --stack-name aws-study-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
curl "$API_URL/health"
```

## Troubleshooting

- LocalStack "no REST API found" → container restarted and dropped the stack → `npm run stack:deploy` (the `test:e2e` / `tests:perf` entrypoints do this for you).
- API returns 404 on a new route → the stack wasn't redeployed: LocalStack only updates routes on `npm run stack:deploy`.
- Playwright complains `BASE_URL is not set` → run it via `npm run test:e2e`, not bare `npx playwright test`.
- Use `docker-compose` (hyphen, standalone v5); `docker compose` (plugin) isn't installed here.
- Docker not reachable → `scripts/localstack-boot.sh` auto-starts colima (or Docker Desktop on macOS).
- k6 threshold failures against LocalStack → expected; the emulator, not this code, is what is slow.