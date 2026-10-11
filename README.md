# aws-study — Multi-Lambda SAM Scaffold (TypeScript)

Multiple AWS Lambdas orchestrated with SAM, local-first: unit, E2E, and perf tests all run without AWS.

## Prerequisites

- Node.js 20 (`fnm use` / `nvm use`), npm 9+
- Docker running (SAM Local and LocalStack need it)
- AWS SAM CLI ≥ 1.130 (`sam --version`; ≤ 1.120 fails against modern Docker with `DockerIsNotReachableException`)
- k6 via Docker for perf tests (no install: `npm run test:perf:products:docker`) or global `k6` · Playwright Chromium only for E2E · AWS credentials only for deploy

> `arm64` throughout (`template.yaml` Globals): native on Apple Silicon, Graviton in AWS. Need `x86_64`? Change the one line, but enable Rosetta in colima or emulation turns flaky.

## Install

```bash
fnm use
npm install
npx playwright install --with-deps chromium   # E2E only
```

## Quickstart

```bash
npm run test:unit                              # no setup needed
npm run local:dynamo:up && npm run local:dynamo:init  # DynamoDB Local on :8000
npm run local:start                            # API at http://127.0.0.1:3000
curl http://127.0.0.1:3000/health
curl -X POST http://127.0.0.1:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":79.9,"stock":10}'
```

## Local dev environments

Two targets, same code. Pick per task:

| | **SAM Local** (default) | **LocalStack** |
|---|---|---|
| What | Lambda + API Gateway on `:3000` | Full AWS emulator on `:4566` |
| DynamoDB | Separate `dynamodb-local` container (`:8000`) | Inside LocalStack |
| Deploys `template.yaml`? | No — runs built code directly | Yes — real CloudFormation deploy |
| API URL | Fixed: `http://127.0.0.1:3000` | Changes per deploy: `npm run -s stack:url` |
| **Use when** | Fast inner loop, debugging a Lambda, E2E | Pre-deploy parity check (routes, IAM policies, table from template) |

### SAM Local — fast inner loop

One command (DynamoDB → init table → API at `:3000`):

```bash
npm run dev
```

Manual steps (same stages individually):

```bash
npm run local:dynamo:up     # DynamoDB Local (:8000, data persists; `down -v` wipes)
npm run local:dynamo:init   # create aws-study-local-products (idempotent, no AWS CLI needed)
npm run local:start         # API at :3000 (warm containers, env.json)
npm run local:invoke:health # invoke one function without the API (also :hello, :products)
```

### LocalStack — full emulator

One command (start → deploy → print URLs):

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

```bash
BASE_URL=$(npm run -s stack:url)
curl "$BASE_URL/health"
curl -X POST "$BASE_URL/products" -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":79.9,"stock":10}'
curl "$BASE_URL/products?limit=10"
```

Notes: dummy `test`/`test` creds, `us-east-1`, no account — the image is pinned to `localstack/localstack:4.14` because `latest` requires a `LOCALSTACK_AUTH_TOKEN` since March 2026. Lambda code needs no endpoint config (`src/shared/dynamo.ts` honors LocalStack's injected `AWS_ENDPOINT_URL_*` vars).

## Test

| Level | Command | Requires |
|---|---|---|
| Unit (Vitest) | `npm run test:unit` (watch: `test:unit:watch`, coverage: `test:unit:coverage`) | nothing |
| E2E (Playwright) | `npm run test:e2e` | Docker (auto-starts SAM + DynamoDB via `scripts/e2e-server.sh`, or reuses your `:3000`) |
| Perf suite (k6 via Docker) | `npm run tests:perf` (SAM) · `npm run tests:perf:stack` (LocalStack) | Docker (both self-boot: SAM path starts DynamoDB + API if `:3000` is down; stack path starts the emulator + deploys if needed, or reuses them) |
| Perf singles (k6 via Docker) | `npm run test:perf:products:docker` | API up + Docker (no `k6` install; image `grafana/k6:2.3.0`, override with `K6_IMAGE=...`) |
| Perf singles (k6 global) | `npm run test:perf:products` | API up + `k6` |
| Static | `npm run check` (Biome) · `npm run typecheck` · `npm run validate` (`sam validate --lint`) | nothing / SAM CLI |

```bash
npm run test:unit
npm run tests:perf                  # full k6 suite vs SAM, zero setup (starts API at :3000 if needed)
npm run test:e2e
npm run tests:perf:stack            # full k6 suite vs LocalStack, zero setup (starts emulator + deploys if needed)
```

## Performance testing (k6)

Load tests live in `tests/performance/*-load-test.ts` (TypeScript, runs natively on k6 ≥ v0.57 — no transpile step). Each file defines staged load (`scenarios`) plus `thresholds` (`http_req_failed`, `http_req_duration`); k6 is for load only, never E2E/smoke. Runner is Dockerized (`grafana/k6:2.3.0`, override with `K6_IMAGE=...`), so no global `k6` install is needed except for the `test:perf:*` (non-Docker) singles.

```bash
npm run tests:perf                                                # full suite vs SAM Local (:3000)
PERF_TESTS="tests/performance/products/create-products-load-test.ts" npm run tests:perf  # one file vs SAM
npm run test:perf:products:docker                                 # one file vs SAM, direct (API must be up)
npm run tests:perf:stack                                          # full suite vs LocalStack (self-booting: starts emulator + deploys if needed)
PERF_TESTS="tests/performance/products/create-products-load-test.ts" npm run tests:perf:stack  # one file vs LocalStack
BASE_URL=$(npm run -s stack:url) npm run tests:perf               # same as tests:perf:stack, explicit
```

Targets: SAM Local is fixed at `http://127.0.0.1:3000`; LocalStack URL changes per deploy (`npm run -s stack:url`, resolved automatically by `scripts/perf-stack.sh` → `scripts/perf-suite.sh` → `scripts/k6-docker.sh`). Both suite commands self-boot and leave their infra running (a LocalStack container restart wipes the deployed stack, so `tests:perf:stack` redeploys automatically when no API is found).

## Project structure

```
template.yaml          # SAM: one AWS::Serverless::Function per Lambda + ProductsTable
samconfig.toml         # cloud stack/region (dev)
env.json               # env vars for `sam local` only (never real secrets: sam injects host AWS creds)
events/                # sample payloads for `sam local invoke`
src/shared/            # logger.ts (Powertools) · response.ts (ok/badRequest/serverError) · dynamo.ts (local↔cloud endpoint)
src/functions/         # health/ · hello/ (zod validation example) · products/ (CRUD: app, validation, repository, tests)
tests/e2e/ · tests/performance/
```

Stack: Lambda + SAM · TypeScript · Biome · Vitest · Playwright · k6 · `@middy/core` + `zod` + Powertools logger · Husky + commitlint · GitHub Actions CI (`biome` → `typecheck` → `test:unit` → `sam build` → `sam validate`).

### Adding a new Lambda

1. Copy `src/functions/hello/` → `src/functions/<name>/` (thin handler, pure logic for Vitest).
2. Add `AWS::Serverless::Function` in `template.yaml` (`CodeUri: ./`, `Handler: app.handler`, `EntryPoints: [...]`, `Api` event).
3. Add `events/<name>-event.json`, colocated `app.test.ts`, E2E spec.
4. `npm run build && npm run local:start` to verify.

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

- `:3000` refused → `npm run local:start` isn't running. (LocalStack never serves `:3000`.)
- LocalStack "no REST API found" → container restarted and dropped the stack → `npm run stack:deploy`.
- `sam local` needs a runtime: with colima, export `DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"`.
- Use `docker-compose` (hyphen, standalone v5); `docker compose` (plugin) isn't installed here.
- Port 3000 busy → stop the other `sam local start-api` (Playwright reuses it via `reuseExistingServer: true`).
- Playwright `webServer` timeout on first run → it's pulling `emulation-nodejs*.x`; re-run.
