/**
 * editorial-live env contract (pure, fail-closed). Modeled on `e2e/cash-live/support/env.ts`.
 *
 * The admin/global editorial journey (odd/tasks/backlog-closeout.md T3/S1, T12 of
 * odd/tasks/editorial-single-contract.md) may only run when a human-authorized, fully declared
 * LOCAL contract is present:
 *
 * - `EDITORIAL_LIVE_ENABLED` must be exactly `1`.
 * - `EDITORIAL_LIVE_BACKEND_URL` must be an `http://` loopback URL with an explicit port, never
 *   3000 (the ambient `VITE_API_BASE_URL` fallback) nor the owned frontend port; no credentials,
 *   query or hash. Any backend base path is part of the declared URL.
 * - `EDITORIAL_LIVE_FIXTURE_PATH` must resolve inside `artifacts/editorial-live/` (gitignored by
 *   the `/artifacts/` rule). The load-time realpath check is in `fixture.ts`.
 * - `EDITORIAL_LIVE_RUN_ID` is optional (default `editorial-live`), one safe filename segment.
 *
 * Pure string/URL logic: no filesystem, no `process.env` reads, no network.
 */
import path from 'node:path'

export const EDITORIAL_LIVE_ENABLED_ENV = 'EDITORIAL_LIVE_ENABLED'
export const EDITORIAL_LIVE_BACKEND_URL_ENV = 'EDITORIAL_LIVE_BACKEND_URL'
export const EDITORIAL_LIVE_FIXTURE_PATH_ENV = 'EDITORIAL_LIVE_FIXTURE_PATH'
export const EDITORIAL_LIVE_RUN_ID_ENV = 'EDITORIAL_LIVE_RUN_ID'
export const EDITORIAL_LIVE_DEFAULT_RUN_ID = 'editorial-live'
export const EDITORIAL_LIVE_OPT_IN_VALUE = '1'

/** Owned frontend dev port (cash-live owns 4189, responsive 4173; 3000 is the ambient API fallback). */
export const EDITORIAL_LIVE_FRONTEND_PORT = 4191
export const EDITORIAL_LIVE_FRONTEND_HOST = '127.0.0.1'
export const EDITORIAL_LIVE_FRONTEND_ORIGIN = `http://${EDITORIAL_LIVE_FRONTEND_HOST}:${EDITORIAL_LIVE_FRONTEND_PORT}`

/** Reserved scratch root (relative to the project root) for the fixture and run artifacts. */
export const EDITORIAL_LIVE_SCRATCH_ROOT = 'artifacts/editorial-live'

/** Same safe-segment rule as cash-live: it is interpolated into the run artifact directory. */
export const EDITORIAL_LIVE_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export const AMBIENT_DEFAULT_API_PORT = 3000

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

export class EditorialLiveConfigError extends Error {}

export type ResolvedEditorialLiveEnv = {
  readonly runId: string
  readonly backendUrl: URL
  readonly backendOrigin: string
  readonly backendBaseUrl: string
  readonly frontendPort: number
  readonly frontendOrigin: string
  readonly fixturePath: string
  /** Absolute run artifact directory under the scratch root. */
  readonly runArtifactDir: string
}

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname)
}

/** Canonical base-URL form used for ownership-binding comparisons. */
export function normalizeBaseUrl(candidate: string): string {
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new EditorialLiveConfigError(`base URL is not a valid URL: ${redactCandidate(candidate)}`)
  }
  return parsed.toString().replace(/\/$/, '')
}

/** True when `candidate` is strictly inside `root` (never `root` itself). Lexical only. */
export function isStrictlyInside(root: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(candidate))
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * Lexical confinement: the fixture must resolve inside the project root AND the scratch root.
 * The load-time realpath check (`loadEditorialLiveFixture`) guards symlink escapes.
 */
export function resolveFixturePath(input: string, projectRoot: string): string {
  const root = path.resolve(projectRoot)
  const resolved = path.resolve(root, input)
  if (!isStrictlyInside(root, resolved)) {
    throw new EditorialLiveConfigError(
      `${EDITORIAL_LIVE_FIXTURE_PATH_ENV} must resolve inside the project root; got a path that escapes it`,
    )
  }
  if (!isStrictlyInside(path.resolve(root, EDITORIAL_LIVE_SCRATCH_ROOT), resolved)) {
    throw new EditorialLiveConfigError(
      `${EDITORIAL_LIVE_FIXTURE_PATH_ENV} must resolve inside ${EDITORIAL_LIVE_SCRATCH_ROOT}/ so no real fixture can be committed`,
    )
  }
  return resolved
}

function redactCandidate(raw: string): string {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : '/<basepath>'}`
  } catch {
    return '<invalid-url>'
  }
}

function parseBackendUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new EditorialLiveConfigError(`${EDITORIAL_LIVE_BACKEND_URL_ENV} is not a valid URL: ${redactCandidate(raw)}`)
  }
  const name = EDITORIAL_LIVE_BACKEND_URL_ENV
  if (url.protocol !== 'http:') throw new EditorialLiveConfigError(`${name} must use http: for the local backend`)
  if (!isLoopbackHostname(url.hostname)) {
    throw new EditorialLiveConfigError(`${name} host must be loopback (127.0.0.1, localhost or ::1); got ${url.hostname}`)
  }
  if (url.port === '') throw new EditorialLiveConfigError(`${name} must declare an explicit port`)
  if (url.port === String(AMBIENT_DEFAULT_API_PORT)) {
    throw new EditorialLiveConfigError(`${name} must not use port ${AMBIENT_DEFAULT_API_PORT}: it is the ambient API fallback`)
  }
  if (url.port === String(EDITORIAL_LIVE_FRONTEND_PORT)) {
    throw new EditorialLiveConfigError(`${name} must not use the owned frontend port ${EDITORIAL_LIVE_FRONTEND_PORT}`)
  }
  if (url.username !== '' || url.password !== '') throw new EditorialLiveConfigError(`${name} must not embed credentials`)
  if (url.search !== '' || url.hash !== '') {
    throw new EditorialLiveConfigError(`${name} must not carry a query string or hash fragment`)
  }
  return url
}

function resolveRunId(raw: string | undefined): string {
  const candidate = raw?.trim()
  if (!candidate) return EDITORIAL_LIVE_DEFAULT_RUN_ID
  if (!EDITORIAL_LIVE_RUN_ID_PATTERN.test(candidate)) {
    // The rejected value is never echoed: it could carry a secret.
    throw new EditorialLiveConfigError(
      `${EDITORIAL_LIVE_RUN_ID_ENV} must be a single safe ASCII filename segment matching ${EDITORIAL_LIVE_RUN_ID_PATTERN.source}`,
    )
  }
  return candidate
}

/** Resolves and validates the full env contract; throws `EditorialLiveConfigError` on any rejection. */
export function resolveEditorialLiveEnv(
  env: Record<string, string | undefined>,
  projectRoot: string = process.cwd(),
): ResolvedEditorialLiveEnv {
  if (env[EDITORIAL_LIVE_ENABLED_ENV] !== EDITORIAL_LIVE_OPT_IN_VALUE) {
    throw new EditorialLiveConfigError(
      `${EDITORIAL_LIVE_ENABLED_ENV} must be set to exactly "${EDITORIAL_LIVE_OPT_IN_VALUE}" to authorize the editorial-live journey; refusing to start`,
    )
  }
  const backendRaw = env[EDITORIAL_LIVE_BACKEND_URL_ENV]?.trim()
  if (!backendRaw) {
    throw new EditorialLiveConfigError(`${EDITORIAL_LIVE_BACKEND_URL_ENV} is required: declare the local loopback backend URL`)
  }
  const backendUrl = parseBackendUrl(backendRaw)
  const fixtureRaw = env[EDITORIAL_LIVE_FIXTURE_PATH_ENV]?.trim()
  if (!fixtureRaw) {
    throw new EditorialLiveConfigError(
      `${EDITORIAL_LIVE_FIXTURE_PATH_ENV} is required: declare the backend-issued fixture inside ${EDITORIAL_LIVE_SCRATCH_ROOT}/`,
    )
  }
  const fixturePath = resolveFixturePath(fixtureRaw, projectRoot)
  const runId = resolveRunId(env[EDITORIAL_LIVE_RUN_ID_ENV])
  return Object.freeze({
    runId,
    backendUrl,
    backendOrigin: backendUrl.origin,
    backendBaseUrl: normalizeBaseUrl(backendUrl.toString()),
    frontendPort: EDITORIAL_LIVE_FRONTEND_PORT,
    frontendOrigin: EDITORIAL_LIVE_FRONTEND_ORIGIN,
    fixturePath,
    runArtifactDir: path.resolve(projectRoot, EDITORIAL_LIVE_SCRATCH_ROOT, runId),
  })
}
