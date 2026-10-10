# aws-study — Multi-Lambda SAM Scaffold (TypeScript)

Empty, ready-to-code scaffold for **multiple AWS Lambdas** orchestrated with **SAM**, with a **local-first** testing story: unit, E2E, performance, and smoke — all runnable without deploying to AWS.

## Stack

| Concern | Tool |
|---|---|
| Compute / orchestration | AWS Lambda + SAM (`template.yaml`) |
| Language | TypeScript + Node.js 20 |
| Format / lint | Biome (`biome.json`) |
| Unit tests | Vitest (`vitest.config.ts`, colocated `src/**/*.test.ts`) |
| E2E tests | Playwright (`playwright.config.ts`, `tests/e2e/`) |
| Performance tests | k6 (`tests/performance/`) |
| Smoke tests | `scripts/smoke.sh` (curl, works local + cloud) |

### Extra (recommended, already wired in)

| Package | Why |
|---|---|
| `@middy/core` | Lambda middleware (logging, JSON parsing, error handling) |
| `zod` | Input validation at the edge (see `hello` function) |
| `@aws-lambda-powertools/logger` | Structured JSON logging, consistent `serviceName`/`LOG_LEVEL` |
| `lint-staged` + `husky` | Format/lint on commit so the scaffold stays clean |
| GitHub Actions (`ci.yml`) | typecheck + Biome + Vitest + `sam build` + `sam validate` on every push |

> If you outgrow this: add `@aws-lambda-powertools/metrics` + `tracer` (X-Ray), `esbuild` analyze for bundle size, and `cfn-lint` in CI.

## Project structure

```
template.yaml                  # SAM: one AWS::Serverless::Function per Lambda
samconfig.toml                 # default stack/region (dev)
env.json                       # env vars for `sam local`
events/                        # sample invoke payloads (sam local invoke)
src/
  shared/
    logger.ts                  # Powertools logger singleton
    response.ts                # ok()/badRequest()/serverError() helpers
  functions/
    health/app.ts + app.test.ts   # GET /health (liveness probe)
    hello/app.ts + app.test.ts    # GET /hello?name= (validation example)
tests/
  e2e/*.e2e.spec.ts            # Playwright, hits local SAM API
  performance/
    smoke-test.js              # k6: 10 iterations, both endpoints
    hello-load-test.js         # k6: ramp to 10 VUs
    health-load-test.js        # k6: ramp to 50 VUs
scripts/smoke.sh               # curl smoke test, BASE_URL-aware
```

### Adding a new Lambda

1. Copy `src/functions/hello/` → `src/functions/<name>/`, rename handler logic (keep the handler thin, put logic in pure exported functions so Vitest can cover them).
2. Add a `AWS::Serverless::Function` resource in `template.yaml` with `CodeUri: ./` (project root, so esbuild resolves deps), `Handler: app.handler`, `EntryPoints: [src/functions/<name>/app.ts]`, and its `Api` event.
3. Add `events/<name>-event.json`, a colocated `app.test.ts`, an E2E spec, and a line in `scripts/smoke.sh`.
4. Run `npm run build && npm run local:start` to verify locally.

## Prerequisites

- Node.js 20 (`nvm use` / `.nvmrc`), npm 9+
- Docker Desktop / Engine **running** (SAM Local needs it)
- AWS SAM CLI ≥ 1.130 (`sam --version`) — **important:** versions ≤ 1.120 bundle a Docker
  client (API 1.35) that modern Docker servers (≥ v28, min API 1.40) reject with
  `DockerIsNotReachableException`. Upgrade via `brew install aws-sam-cli` or the
  [official installer](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
- k6 **only for performance tests**: `brew install k6` (macOS) — [k6 install docs](https://grafana.com/docs/k6/set-up/install-k6/)
- Playwright browsers **only for E2E**: `npx playwright install --with-deps chromium`
- AWS credentials **only for deploy** (not needed for any local test)

## Install

```bash
fnm use   # or `nvm use` — both read .nvmrc (fnm auto-switches on cd via --use-on-cd)
npm install
npx playwright install --with-deps chromium   # E2E only
```

## Run locally (no AWS needed)

```bash
npm run build              # sam build (esbuild bundles each function)
npm run local:start        # API at http://127.0.0.1:3000 (warm containers, env.json)
# then:
curl http://127.0.0.1:3000/health
curl "http://127.0.0.1:3000/hello?name=Ada"
```

Invoke a single function without the API:

```bash
npm run local:invoke:health
npm run local:invoke:hello
```

## Test locally

| Level | Command | Requires |
|---|---|---|
| Unit (Vitest) | `npm run test:unit` · watch: `npm run test:unit:watch` · coverage: `npm run test:unit:coverage` | nothing |
| E2E (Playwright) | `npm run test:e2e` | Docker running (Playwright auto-starts SAM via `webServer`; or run `npm run local:start` first — it reuses the existing server) |
| Performance (k6) | `npm run test:perf:smoke` · `npm run test:perf:load` · or `k6 run tests/performance/health-load-test.js` · override target with `BASE_URL=http://127.0.0.1:3000 k6 run tests/performance/smoke-test.js` | API running (`npm run local:start`) + `k6` installed |
| Smoke (curl) | `npm run test:smoke` · cloud: `BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/Prod npm run test:smoke` | API running (local or deployed) |
| All static checks | `npm run check` (Biome) · `npm run typecheck` · `npm run validate` (`sam validate --lint`) | nothing / SAM CLI |

Typical local loop:

```bash
npm run test:unit                 # fast feedback
npm run local:start               # terminal 1
npm run test:e2e                  # terminal 2 (reuses :3000)
npm run test:smoke                # terminal 2
BASE_URL=http://127.0.0.1:3000 k6 run tests/performance/smoke-test.js
```

## Format / lint

```bash
npm run format        # biome format --write .
npm run lint:fix      # biome check --write .
npm run check         # biome check . (CI runs this)
```

A `pre-commit` hook (`lint-staged`) auto-formats staged files.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/) are **mandatory** —
enforced at commit time by commitlint (Husky `commit-msg` hook). Example:
`feat(hello): support greeting by title`. See `AGENTS.md` for the full rule set.
Never commit with `--no-verify`.

## Deploy to AWS (only step needing the cloud)
```bash
npm run deploy:guided   # first time: answers saved to samconfig.toml
npm run deploy           # subsequent deploys
# then smoke-test the cloud:
BASE_URL=$(aws cloudformation describe-stacks --stack-name aws-study-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text) \
  npm run test:smoke
```

## Troubleshooting

- `sam local ...` → `...requires a container runtime` (Docker/Finch not detected):
  SAM only looks at the default socket/`DOCKER_HOST`, it ignores the `docker`
  context. If you use **colima**, export
  `DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"` (already in
  `.zshrc` if scaffolded on this machine) and open a new terminal.
- Playwright `webServer` timeout: Docker may be slow on first pull of the
  `public.ecr.aws/sam/emulation-nodejs20.x` image — re-run; subsequent starts reuse it.
- Port 3000 in use: stop the other `sam local start-api` (Playwright reuses an
  existing server automatically thanks to `reuseExistingServer: true`).
