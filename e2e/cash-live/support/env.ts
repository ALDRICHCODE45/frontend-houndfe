/**
 * cash-live env contract (pure, fail-closed).
 *
 * The joint HTTP/browser cash-register journey may only run when a human-
 * authorized, fully declared LOCAL contract is present in the environment:
 *
 * - `CASH_LIVE_ENABLED` must be the exact value `1` (explicit opt-in; nothing
 *   ambient, no `true`/`yes` aliases).
 * - `CASH_LIVE_BACKEND_URL` must be an explicitly declared `http://` loopback
 *   URL (127.0.0.1 / localhost / ::1) WITH an explicit port. Port 3000 is the
 *   frontend's ambient `VITE_API_BASE_URL` fallback default and is always
 *   rejected, as is the owned frontend port. Credentials, query strings and
 *   hash fragments are rejected. The backend base path (if any) must be part
 *   of the declared URL.
 * - `CASH_LIVE_FIXTURE_PATH` must point at the backend-issued auth fixture
 *   JSON inside the reserved project scratch root `artifacts/cash-live/` (the
 *   future gitignored scratch directory). Paths escaping the project root or
 *   outside the scratch root are rejected. A symlink that resolves outside is
 *   rejected again at load time (`loadCashLiveFixture`).
 * - `CASH_LIVE_RUN_ID` is optional and defaults to `cash-live`. When declared
 *   it must be a single safe ASCII filename segment (see
 *   `CASH_LIVE_RUN_ID_PATTERN`): it is interpolated into the run artifact
 *   output directory, so traversal, separator, dot-segment and control
 *   characters are all rejected before any path is built.
 *
 * This module is pure string/URL logic: no filesystem access, no process env
 * reads, no network. `playwright.cash-live.config.ts` evaluates it at config
 * load time, so a rejected contract fails before any server or browser starts.
 */
import path from 'node:path'

export const CASH_LIVE_ENABLED_ENV = 'CASH_LIVE_ENABLED'
export const CASH_LIVE_BACKEND_URL_ENV = 'CASH_LIVE_BACKEND_URL'
export const CASH_LIVE_FIXTURE_PATH_ENV = 'CASH_LIVE_FIXTURE_PATH'
export const CASH_LIVE_RUN_ID_ENV = 'CASH_LIVE_RUN_ID'
export const CASH_LIVE_DEFAULT_RUN_ID = 'cash-live'

/** The exact opt-in value. Nothing else (no `true`, no `yes`) is accepted. */
export const CASH_LIVE_OPT_IN_VALUE = '1'

/** Owned frontend dev port for the cash-live journey (never 4173, never 3000). */
export const CASH_LIVE_FRONTEND_PORT = 4189
export const CASH_LIVE_FRONTEND_HOST = '127.0.0.1'
export const CASH_LIVE_FRONTEND_ORIGIN = `http://${CASH_LIVE_FRONTEND_HOST}:${CASH_LIVE_FRONTEND_PORT}`

/** Reserved scratch root (relative to the project root) for backend-issued fixtures and run artifacts. */
export const CASH_LIVE_SCRATCH_ROOT = 'artifacts/cash-live'

/**
 * The only accepted `CASH_LIVE_RUN_ID` shape: one safe ASCII filename segment
 * (1-64 chars, leading alphanumeric, then alphanumeric/`_`/`-`). It excludes
 * path separators, dot segments, control characters and whitespace because the
 * run id is interpolated into the run artifact directory under
 * `CASH_LIVE_SCRATCH_ROOT`.
 */
export const CASH_LIVE_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** The ambient frontend API fallback that must never be used by the live journey. */
export const AMBIENT_DEFAULT_API_PORT = 3000

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

export class CashLiveConfigError extends Error {}

export type ResolvedCashLiveEnv = {
  readonly runId: string
  readonly backendUrl: URL
  readonly backendOrigin: string
  readonly backendBaseUrl: string
  readonly frontendPort: number
  readonly frontendOrigin: string
  readonly fixturePath: string
}

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname)
}

/** Canonical base-URL form used for ownership-binding comparisons. Throws `CashLiveConfigError` on malformed input. */
export function normalizeBaseUrl(candidate: string): string {
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new CashLiveConfigError(`base URL is not a valid URL: ${redactCandidate(candidate)}`)
  }
  return parsed.toString().replace(/\/$/, '')
}

export function normalizeOrigin(candidate: string): string {
  return candidate.replace(/\/$/, '')
}

/**
 * Pure path confinement: the fixture must resolve inside the project root AND
 * inside the reserved scratch root. Lexical only; the load-time realpath check
 * guards symlink escapes.
 */
export function resolveFixturePath(input: string, projectRoot: string): string {
  const root = path.resolve(projectRoot)
  const resolved = path.resolve(root, input)
  const insideRoot = (candidate: string): boolean => {
    const rel = path.relative(root, candidate)
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  }
  const insideScratch = (candidate: string): boolean => {
    const scratch = path.resolve(root, CASH_LIVE_SCRATCH_ROOT)
    const rel = path.relative(scratch, candidate)
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  }
  if (!insideRoot(resolved)) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_FIXTURE_PATH_ENV} must resolve inside the project root (${root}); got a path that escapes it`,
    )
  }
  if (!insideScratch(resolved)) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_FIXTURE_PATH_ENV} must resolve inside the reserved scratch root ${CASH_LIVE_SCRATCH_ROOT}/ (relative to the project root) so no real fixture can be committed`,
    )
  }
  return resolved
}

function parseBackendUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new CashLiveConfigError(
      `${CASH_LIVE_BACKEND_URL_ENV} is not a valid URL: ${redactCandidate(raw)}`,
    )
  }
  if (url.protocol !== 'http:') {
    throw new CashLiveConfigError(
      `${CASH_LIVE_BACKEND_URL_ENV} must use http: for the local backend`,
    )
  }
  if (!isLoopbackHostname(url.hostname)) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_BACKEND_URL_ENV} host must be loopback (127.0.0.1, localhost or ::1); got ${url.hostname}`,
    )
  }
  if (url.port === '') {
    throw new CashLiveConfigError(`${CASH_LIVE_BACKEND_URL_ENV} must declare an explicit port`)
  }
  if (url.port === String(AMBIENT_DEFAULT_API_PORT)) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_BACKEND_URL_ENV} must not use port ${AMBIENT_DEFAULT_API_PORT}: that is the frontend's ambient API fallback default and must never be assumed`,
    )
  }
  if (url.port === String(CASH_LIVE_FRONTEND_PORT)) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_BACKEND_URL_ENV} must not use the owned frontend port ${CASH_LIVE_FRONTEND_PORT}`,
    )
  }
  if (url.username !== '' || url.password !== '') {
    throw new CashLiveConfigError(`${CASH_LIVE_BACKEND_URL_ENV} must not embed credentials`)
  }
  if (url.search !== '' || url.hash !== '') {
    throw new CashLiveConfigError(
      `${CASH_LIVE_BACKEND_URL_ENV} must not carry a query string or hash fragment`,
    )
  }
  return url
}

/** Never echo env values that could carry secrets; show only a short host:port shape. */
function redactCandidate(raw: string): string {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : '/<basepath>'}`
  } catch {
    return '<invalid-url>'
  }
}

/**
 * Resolves the optional run id: absent or blank keeps the documented default,
 * anything else must match `CASH_LIVE_RUN_ID_PATTERN`. The rejected raw value
 * is never echoed (it could carry a secret), matching the redaction policy of
 * the URL validator.
 */
function resolveRunId(raw: string | undefined): string {
  const candidate = raw?.trim()
  if (!candidate) {
    return CASH_LIVE_DEFAULT_RUN_ID
  }
  if (!CASH_LIVE_RUN_ID_PATTERN.test(candidate)) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_RUN_ID_ENV} must be a single safe ASCII filename segment matching ${CASH_LIVE_RUN_ID_PATTERN.source} (no path separators, no dot segments, no control characters); it is interpolated into the run artifact output directory`,
    )
  }
  return candidate
}

/**
 * Resolves and validates the full env contract. Throws `CashLiveConfigError`
 * for every rejected input. `projectRoot` defaults to `process.cwd()` (the
 * Playwright config evaluates it from the project root).
 */
export function resolveCashLiveEnv(
  env: Record<string, string | undefined>,
  projectRoot: string = process.cwd(),
): ResolvedCashLiveEnv {
  if (env[CASH_LIVE_ENABLED_ENV] !== CASH_LIVE_OPT_IN_VALUE) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_ENABLED_ENV} must be set to exactly "${CASH_LIVE_OPT_IN_VALUE}" to authorize the cash-live journey; refusing to start`,
    )
  }

  const backendRaw = env[CASH_LIVE_BACKEND_URL_ENV]?.trim()
  if (!backendRaw) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_BACKEND_URL_ENV} is required: declare the explicit local loopback backend URL (including any base path)`,
    )
  }
  const backendUrl = parseBackendUrl(backendRaw)

  const fixtureRaw = env[CASH_LIVE_FIXTURE_PATH_ENV]?.trim()
  if (!fixtureRaw) {
    throw new CashLiveConfigError(
      `${CASH_LIVE_FIXTURE_PATH_ENV} is required: declare the backend-issued fixture file inside ${CASH_LIVE_SCRATCH_ROOT}/`,
    )
  }
  const fixturePath = resolveFixturePath(fixtureRaw, projectRoot)

  const runId = resolveRunId(env[CASH_LIVE_RUN_ID_ENV])

  return Object.freeze({
    runId,
    backendUrl,
    backendOrigin: backendUrl.origin,
    backendBaseUrl: normalizeBaseUrl(backendUrl.toString()),
    frontendPort: CASH_LIVE_FRONTEND_PORT,
    frontendOrigin: CASH_LIVE_FRONTEND_ORIGIN,
    fixturePath,
  })
}
