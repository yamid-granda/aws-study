# AGENTS.md — aws-study

Instructions for AI coding agents (and humans) working in this repo.

## What this is

Multi-Lambda TypeScript scaffold orchestrated with AWS SAM. Empty of business
logic on purpose. Everything must run locally first (no AWS needed except deploy).

## Stack

- AWS Lambda + SAM (`template.yaml`), Node.js 20, TypeScript strict
- Biome = formatter + linter (`biome.json`), no ESLint/Prettier
- Vitest for unit tests (colocated `src/**/*.test.ts`)
- Playwright for E2E (`tests/e2e/`, hits local SAM on `:3000`)
- k6 for performance/load only (`tests/performance/`)

## Test boundaries — MANDATORY

- The k6 suite is for performance/load tests ONLY. Never use it for E2E
  or smoke tests.
- E2E and smoke coverage belongs in Playwright (`tests/e2e/`).
  Unit coverage belongs in Vitest (colocated `src/**/*.test.ts`).
- Do not create `*smoke*` files, single-iteration checks, or
  status-only assertions under `tests/performance/`. Every k6 script
  must define staged load (`stages`/`scenarios`) plus performance
  `thresholds` (`http_req_duration`, `http_req_failed`).

## Language — MANDATORY

- Everything is TypeScript. Plain JavaScript (`.js`/`.mjs`/`.cjs`)
  source files are NOT allowed — k6 scripts included (k6 ≥ v0.57 runs
  `.ts` natively via type-stripping; this repo pins `grafana/k6:2.3.0`).
- The Node-runtime helper (`scripts/dynamo-local-init.ts`) is bundled
  on the fly with the repo's esbuild because Node 20 cannot run TS
  directly — see `scripts/dynamo-local.sh`. Do not reintroduce a `.mjs`.
- `commitlint.config.ts` loads via cosmiconfig's TypeScript loader.
- Keep `tsconfig.json` `include` in sync when adding new TS locations
  so `npm run typecheck` keeps covering every file.

## Commands

```bash
fnm use                  # pick Node 20 from .nvmrc (auto-switches on cd)
npm install
npm run build            # sam build (esbuild). Use this, NOT bare `sam build`
npm run local:start      # API at http://127.0.0.1:3000 (needs Docker + SAM CLI)
npm run local:dynamo:up   # DynamoDB Local on :8000 (persistent named volume)
npm run local:dynamo:init # create aws-study-local-products (idempotent, keeps data)
npm run typecheck        # tsc --noEmit
npm run check            # biome check . (lint+format, same as CI)
npm run format           # biome format --write .
npm run lint:fix         # biome check --write .
npm run test:unit        # vitest run
npm run test:e2e         # playwright (auto-starts SAM if :3000 is free)
npm run tests:perf       # full k6 suite via Docker (auto-starts DynamoDB + SAM if :3000 is down)
npm run validate         # sam validate --lint
```

## Code conventions

- Handlers stay thin (`src/functions/<name>/app.ts`); put logic in exported
  pure functions so Vitest can cover them without mocks.
- Validate all external input at the edge with `zod` (see `hello` function).
- Use `src/shared/response.ts` helpers (`ok`/`badRequest`/`serverError`) and
  `src/shared/logger.ts` (Powertools). Never `console.log` in handlers.
- DynamoDB access goes through `src/shared/dynamo.ts` (`getDocClient`,
  `getTableName`, `resolveEndpoint`): `DYNAMODB_ENDPOINT` set → local,
  unset + `AWS_SAM_LOCAL` → host's DynamoDB Local, otherwise real DynamoDB.
  Keep `template.yaml` table spec and `scripts/dynamo-local-init.mjs` in sync
  (same keys, same billing mode) so local stays close to cloud.
- Run `npm run check` and `npm run typecheck` before finishing any change.
  Pre-commit already runs `lint-staged` (Biome) via Husky.

## Commits — Conventional Commits are MANDATORY

Every commit message MUST follow [Conventional Commits](https://www.conventionalcommits.org/).
This is enforced by **commitlint** (`commitlint.config.js`) in the Husky
`commit-msg` hook — non-conforming messages are rejected at commit time.

Format: `<type>(<scope>): <subject>` — e.g. `feat(hello): support greeting by title`

- Allowed types: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`
- Subject: imperative mood, lowercase, no trailing period, ≤ 72 chars.
- Scopes are the Lambda/function or area name (`health`, `hello`, `ci`, `deps`…).
- Breaking changes: `feat(api)!: ...` plus a `BREAKING CHANGE:` footer.
- If a commit-msg hook rejects your message, rewrite it — do NOT bypass with
  `--no-verify` (CI also runs commitlint on push).

## Adding a new Lambda

1. Copy `src/functions/hello/` → `src/functions/<name>/`, keep handler thin.
2. Add `AWS::Serverless::Function` in `template.yaml`: `CodeUri: ./`,
   `Handler: app.handler`, `EntryPoints: [src/functions/<name>/app.ts]`, Api event.
3. Add `events/<name>-event.json`, colocated `app.test.ts`, E2E spec.
4. Verify: `npm run build`, `npm run test:unit`, `npm run local:start` + E2E.

## CI (must stay green)

Push/PR runs: `biome check` → `typecheck` → `test:unit` → `sam build` →
`sam validate`. Do not merge with red CI.
