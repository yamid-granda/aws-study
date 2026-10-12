/**
 * Absolute API URL for a request path.
 *
 * LocalStack serves API Gateway under a path prefix
 * (`http://localhost:4566/restapis/<apiId>/Prod/_user_request_`), and
 * Playwright resolves a leading-slash request path against the base URL's
 * *origin* — which would drop that prefix and 404 every route. So the specs
 * build absolute URLs here instead of relying on `use.baseURL`.
 *
 * BASE_URL is exported by `scripts/e2e-stack.sh` (`npm run test:e2e`).
 */
export function apiUrl(path: string): string {
  const base = process.env.BASE_URL ?? "";
  if (!base) {
    throw new Error(
      "BASE_URL is not set — run `npm run test:e2e` (boots LocalStack and sets it) " +
        "or export BASE_URL=$(npm run -s stack:url).",
    );
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/+$/, "")}${normalized}`;
}
