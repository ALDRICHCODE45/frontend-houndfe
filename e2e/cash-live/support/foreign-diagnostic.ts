/**
 * Narrow, fail-closed diagnostic harness for the foreign-tenant cash-session
 * read (`GET /cash-sessions/:id` as the foreign actor).
 *
 * This module is the bounded alternative to the broad live journey: it does NOT
 * create a register, open a session, exercise roles or renew any token. It only
 * observes ONE read-only GET and persists what was genuinely observed.
 *
 * Security contract (everything here is deliberate):
 *
 * - The pinned receipt constants (backend origin, frontend origin, resource id,
 *   minimum TTL) are declared HERE, not in `fixture.ts`, so the diagnostic
 *   contract cannot drift with the fixture loader.
 * - `evaluateForeignTtl` stops before any context/server action: a token with
 *   less than `FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS` remaining (or a declared
 *   lifetime below it) is `insufficient`; a past expiry is `expired`. The
 *   caller SKIPS on either verdict — it never renews.
 * - `projectForeignObservation` rebuilds a NEW object containing ONLY the
 *   allowlisted fields (`status`, `error`, `statusCode`, `message`,
 *   `timestamp`, `sessionId`) plus the classified transport-failure enum. A
 *   value the page GET already classified (`timeout`/`network-error`/…) is
 *   PRESERVED; a raw error object is classified; invalid input becomes
 *   `unknown`. Headers, raw errors, storage dumps, HAR/trace data and every
 *   unknown key are dropped structurally, not filtered.
 * - Every string field is redacted against the explicitly supplied tokens and
 *   the whole record is asserted secret-free before persistence.
 * - `persistForeignDiagnostic` pins the owned project root independently,
 *   confines the scratch root to it (so a symlinked/outside scratch root is
 *   rejected), rejects symlinked ancestors BEFORE creating anything, writes the
 *   complete payload to an exclusive `0600` temp file, and publishes it with a
 *   hard link that never overwrites a preexisting target. On any failure it
 *   removes ONLY the temp it created (identity-checked), so no partial file is
 *   left behind and a preexisting diagnostic is untouched. `O_EXCL` alone is
 *   NOT an atomic full-file publish; the temp+link publish is. There is no
 *   attach-only path: the diagnostic must reach disk.
 *
 * No browser, network or fixture is touched here; only the caller supplies an
 * already-observed HTTP result.
 */
import fs from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { CASH_LIVE_RUN_ID_PATTERN, CASH_LIVE_SCRATCH_ROOT } from './env'
import { assertNoSecrets, redactSecrets } from './evidence'

/** Generic, credential-free diagnostic failure. Never wraps a raw error. */
export class ForeignDiagnosticError extends Error {}

// --- Pinned authorization receipt (no fixture import) -----------------------

/** The single authorized backend origin for this diagnostic run. */
export const FOREIGN_DIAGNOSTIC_BACKEND_ORIGIN = 'http://127.0.0.1:36383'
/** The owned frontend origin (same-origin navigation target). */
export const FOREIGN_DIAGNOSTIC_FRONTEND_ORIGIN = 'http://127.0.0.1:4189'
/** The owned disposable resource id this run is bound to. */
export const FOREIGN_DIAGNOSTIC_RESOURCE_ID = '7e3be777-25ef-4562-9383-68510f59b1da'
/** Strict minimum remaining token lifetime; below this the diagnostic skips. */
export const FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS = 300
/** The route the app auto-fetches: a stable, same-origin SPA route (never `/login`). */
export const FOREIGN_DIAGNOSTIC_ROUTE = '/pos/caja'
/** The panel that must render before the single GET is issued. */
export const FOREIGN_DIAGNOSTIC_PANEL_TESTID = 'cash-registers-panel'
/** Environment variable that supplies the EXISTING fixed session id at run time. */
export const FOREIGN_DIAGNOSTIC_SESSION_ID_ENV = 'CASH_LIVE_FOREIGN_SESSION_ID'
/** The single persisted diagnostic file name. */
export const FOREIGN_DIAGNOSTIC_FILE_NAME = 'foreign-session-diagnostic.json'
/** Hard payload bound: the projected record is tiny; anything larger is refused. */
export const FOREIGN_DIAGNOSTIC_MAX_BYTES = 16 * 1024
/** The route ability the foreign actor must hold for the tenant scoping to be reached. */
export const FOREIGN_DIAGNOSTIC_REQUIRED_PERMISSION = 'read:CashSession'

const FOREIGN_SESSION_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// --- TTL preflight ----------------------------------------------------------

/** Structural slice of a validated fixture actor; deliberately not `fixture.ts`. */
export interface ForeignDiagnosticActor {
  readonly tenantId: string
  readonly permissionCodes: readonly string[]
  readonly expiresAt: string
  readonly ttlSeconds: number
}

export type ForeignTtlVerdict = 'ok' | 'expired' | 'insufficient'

export interface ForeignTtlEvaluation {
  readonly verdict: ForeignTtlVerdict
  readonly remainingSeconds: number
}

/**
 * Evaluates whether the token may be used for the diagnostic. A malformed
 * expiry/lifetime is a contract violation and fails generically; an expired or
 * short-lived token yields a skip verdict so the caller never renews.
 */
export function evaluateForeignTtl(
  actor: Pick<ForeignDiagnosticActor, 'expiresAt' | 'ttlSeconds'>,
  nowMs: number,
): ForeignTtlEvaluation {
  const expiresAtMs = Date.parse(actor.expiresAt)
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(actor.ttlSeconds)) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic TTL contract is malformed (unparseable expiry or non-finite lifetime)',
    )
  }
  const remainingSeconds = Math.floor((expiresAtMs - nowMs) / 1000)
  if (remainingSeconds <= 0) {
    return { verdict: 'expired', remainingSeconds }
  }
  if (
    remainingSeconds < FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS ||
    actor.ttlSeconds < FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS
  ) {
    return { verdict: 'insufficient', remainingSeconds }
  }
  return { verdict: 'ok', remainingSeconds }
}

// --- Ownership / tenant / permission preflight ------------------------------

export interface ForeignDiagnosticPreflightInput {
  readonly backendOrigin: string
  readonly frontendOrigin: string
  readonly resourceId: string
  readonly foreignTenantId: string
  readonly operatingTenantId: string
  readonly foreignPermissionCodes: readonly string[]
}

/**
 * Fail-closed receipt check: exact pinned backend/frontend origins and resource
 * id, a foreign tenant DISTINCT from the operating tenant, and the route
 * ability (`read:CashSession`) that makes the tenant-scoping check reachable
 * (a missing ability would short-circuit into a guard 4xx). Runs before any
 * browser context exists.
 */
export function assertForeignDiagnosticPreflight(input: ForeignDiagnosticPreflightInput): void {
  if (input.backendOrigin !== FOREIGN_DIAGNOSTIC_BACKEND_ORIGIN) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic backend origin does not match the authorized receipt',
    )
  }
  if (input.frontendOrigin !== FOREIGN_DIAGNOSTIC_FRONTEND_ORIGIN) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic frontend origin does not match the owned frontend origin',
    )
  }
  if (input.resourceId !== FOREIGN_DIAGNOSTIC_RESOURCE_ID) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic resource id does not match the authorized receipt',
    )
  }
  if (input.foreignTenantId === input.operatingTenantId) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic requires a foreign tenant distinct from the operating tenant',
    )
  }
  if (!input.foreignPermissionCodes.includes(FOREIGN_DIAGNOSTIC_REQUIRED_PERMISSION)) {
    throw new ForeignDiagnosticError(
      `foreign diagnostic requires the foreign actor to hold ${FOREIGN_DIAGNOSTIC_REQUIRED_PERMISSION}`,
    )
  }
}

// --- Target session id ------------------------------------------------------

/**
 * Resolves the EXISTING fixed session id from the environment. Absent/blank
 * returns `null` so the caller can SKIP without guessing. A present-but-
 * malformed value fails generically (the raw value is never echoed).
 */
export function resolveForeignSessionId(raw: string | undefined): string | null {
  const candidate = raw?.trim()
  if (!candidate) return null
  if (!FOREIGN_SESSION_ID_PATTERN.test(candidate)) {
    throw new ForeignDiagnosticError(
      `${FOREIGN_DIAGNOSTIC_SESSION_ID_ENV} must be a UUID-shaped session id; refusing to guess a target`,
    )
  }
  return candidate
}

/** Builds the single read-only endpoint from the validated backend base URL. */
export function buildForeignSessionUrl(backendBaseUrl: string, sessionId: string): string {
  return `${backendBaseUrl.replace(/\/$/, '')}/cash-sessions/${sessionId}`
}

// --- Observation projection -------------------------------------------------

/** The controlled transport-failure classification. Adding one is a contract change. */
export const FOREIGN_TRANSPORT_FAILURES = [
  'aborted',
  'network-error',
  'timeout',
  'unknown',
] as const
export type ForeignTransportFailure = (typeof FOREIGN_TRANSPORT_FAILURES)[number]

/** Raw, possibly unsafe observation. Only these inputs are ever inspected. */
export interface ForeignRawObservation {
  readonly status?: unknown
  readonly body?: unknown
  /** A raw transport error; it is classified and then discarded. */
  readonly transportFailure?: unknown
}

/** The immutable, allowlisted diagnostic record. Nothing else is ever persisted. */
export interface ForeignDiagnosticRecord {
  readonly status?: number
  readonly error?: string
  readonly statusCode?: number
  readonly message?: string
  readonly timestamp?: string
  readonly sessionId?: string
  readonly transportFailure?: ForeignTransportFailure
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNABORTED',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
])

/**
 * Maps a raw error to the fixed enum WITHOUT reading or echoing its message.
 * Only `name` and `code` are consulted, so a token inside the message is never
 * copied anywhere.
 */
export function classifyTransportFailure(error: unknown): ForeignTransportFailure {
  if (typeof error !== 'object' || error === null) return 'unknown'
  const name = (error as { name?: unknown }).name
  if (name === 'AbortError') return 'aborted'
  if (name === 'TimeoutError') return 'timeout'
  if (name === 'TypeError') return 'network-error'
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) return 'network-error'
  return 'unknown'
}

/**
 * Coerces an observation's transport field into the fixed enum. A value the
 * page GET already classified (a known enum string) is PRESERVED rather than
 * re-classified as an error object; a raw error is classified; anything else
 * (including an unknown string) becomes `unknown`.
 */
export function coerceTransportFailure(value: unknown): ForeignTransportFailure {
  if (
    typeof value === 'string' &&
    (FOREIGN_TRANSPORT_FAILURES as readonly string[]).includes(value)
  ) {
    return value as ForeignTransportFailure
  }
  return classifyTransportFailure(value)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/**
 * Rebuilds the observation into a NEW allowlisted record. Only the enumerated
 * fields are read; every unknown key (headers, tokens, storage dumps, stacks)
 * is dropped by construction. Every retained string is redacted against the
 * supplied tokens and the serialized record is asserted secret-free.
 */
export function projectForeignObservation(
  raw: ForeignRawObservation,
  secrets: readonly string[],
): ForeignDiagnosticRecord {
  if (raw.transportFailure !== undefined) {
    return Object.freeze({ transportFailure: coerceTransportFailure(raw.transportFailure) })
  }

  if (!isFiniteInteger(raw.status)) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic observation is missing an integer HTTP status and carries no transport failure',
    )
  }

  const projected: {
    status?: number
    error?: string
    statusCode?: number
    message?: string
    timestamp?: string
    sessionId?: string
  } = { status: raw.status }

  if (isPlainObject(raw.body)) {
    if (isFiniteInteger(raw.body.statusCode)) projected.statusCode = raw.body.statusCode
    if (isNonEmptyString(raw.body.error)) projected.error = redactSecrets(raw.body.error, secrets)
    if (isNonEmptyString(raw.body.message)) {
      projected.message = redactSecrets(raw.body.message, secrets)
    }
    if (isNonEmptyString(raw.body.timestamp)) {
      projected.timestamp = redactSecrets(raw.body.timestamp, secrets)
    }
    if (isNonEmptyString(raw.body.sessionId)) {
      projected.sessionId = redactSecrets(raw.body.sessionId, secrets)
    }
  }

  assertNoSecrets(JSON.stringify(projected), secrets)
  return Object.freeze(projected)
}

// --- Safe summary -----------------------------------------------------------

/**
 * Renders a bounded, secret-free summary for stdout. Only non-sensitive,
 * already-redacted fields are included; `message` and `timestamp` stay out of
 * the console line to keep the output minimal.
 */
export function renderForeignDiagnosticSummary(record: ForeignDiagnosticRecord): string {
  const parts = ['foreign-session-diagnostic']
  if (record.status !== undefined) parts.push(`status=${record.status}`)
  if (record.statusCode !== undefined) parts.push(`statusCode=${record.statusCode}`)
  if (record.transportFailure !== undefined)
    parts.push(`transportFailure=${record.transportFailure}`)
  if (record.error !== undefined) parts.push(`error=${record.error}`)
  if (record.sessionId !== undefined) parts.push(`sessionId=${record.sessionId}`)
  return parts.join(' ')
}

// --- Path confinement + atomic persistence ----------------------------------

/** Injectable filesystem surface; the production adapter wraps `node:fs`. */
export interface ForeignDiagnosticFileStat {
  readonly dev: number
  readonly ino: number
  isSymbolicLink(): boolean
}

export interface ForeignDiagnosticIo {
  mkdirSync(dir: string): void
  realpathSync(target: string): string
  lstatSync(target: string): ForeignDiagnosticFileStat
  openSync(target: string, flag: string, mode: number): number
  fstatSync(fd: number): ForeignDiagnosticFileStat
  writeSync(fd: number, data: string): number
  fsyncSync(fd: number): void
  closeSync(fd: number): void
  /** Publishes `newPath` pointing at `existingPath`; fails if `newPath` exists. */
  linkSync(existingPath: string, newPath: string): void
  unlinkSync(target: string): void
}

export const defaultForeignDiagnosticIo: ForeignDiagnosticIo = {
  mkdirSync: (dir) => fs.mkdirSync(dir, { recursive: true }),
  realpathSync: (target) => fs.realpathSync(target),
  lstatSync: (target) => fs.lstatSync(target),
  openSync: (target, flag, mode) => fs.openSync(target, flag, mode),
  fstatSync: (fd) => fs.fstatSync(fd),
  writeSync: (fd, data) => fs.writeSync(fd, data),
  fsyncSync: (fd) => fs.fsyncSync(fd),
  closeSync: (fd) => fs.closeSync(fd),
  linkSync: (existingPath, newPath) => fs.linkSync(existingPath, newPath),
  unlinkSync: (target) => fs.unlinkSync(target),
}

/** True when `child` is strictly below (never equal to) `parent`. */
function isStrictlyInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * Rejects a symlinked scratch root or any symlinked ancestor BEFORE any
 * `mkdir`/`open`. The walk stops at the first non-existent component: a
 * component that does not exist yet cannot be a symlink.
 */
function assertNoSymlinkedAncestors(
  io: ForeignDiagnosticIo,
  baseDir: string,
  targetDir: string,
): void {
  const base = path.resolve(baseDir)
  const target = path.resolve(targetDir)
  if (!isStrictlyInside(base, target)) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic run directory must stay inside the owned project root',
    )
  }
  let current = base
  for (const segment of path.relative(base, target).split(path.sep)) {
    current = path.join(current, segment)
    let stat: ForeignDiagnosticFileStat
    try {
      stat = io.lstatSync(current)
    } catch {
      return
    }
    if (stat.isSymbolicLink()) {
      throw new ForeignDiagnosticError(
        'foreign diagnostic path must not traverse a symlinked ancestor; refusing to persist',
      )
    }
  }
}

let tempSequence = 0

/** A unique exclusive temp path next to the final file (same directory). */
function buildExclusiveTempPath(finalPath: string): string {
  tempSequence += 1
  return `${finalPath}.${process.pid}.${Date.now().toString(36)}.${tempSequence}.tmp`
}

/**
 * Removes ONLY a temp file this call created, verified by device+inode so a
 * swapped/replaced path is never deleted. Silently does nothing when the path
 * is gone or no longer matches.
 */
function removeOwnedTemp(
  io: ForeignDiagnosticIo,
  tempPath: string,
  created: ForeignDiagnosticFileStat,
): void {
  try {
    const stat = io.lstatSync(tempPath)
    if (stat.isSymbolicLink()) return
    if (stat.dev === created.dev && stat.ino === created.ino) io.unlinkSync(tempPath)
  } catch {
    // Nothing to remove, or the path is no longer our own file.
  }
}

/**
 * Pure lexical confinement: the run id must be a single safe filename segment
 * and the resulting file must stay strictly inside the reserved scratch root.
 */
export function resolveForeignDiagnosticPath(projectRoot: string, runId: string): string {
  if (typeof runId !== 'string' || !CASH_LIVE_RUN_ID_PATTERN.test(runId)) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic runId must match the cash-live run-id rule (one safe filename segment)',
    )
  }
  const scratchRoot = path.resolve(projectRoot, CASH_LIVE_SCRATCH_ROOT)
  const runDir = path.resolve(scratchRoot, runId)
  const rel = path.relative(scratchRoot, runDir)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic run directory must stay inside the reserved scratch root',
    )
  }
  return path.join(runDir, FOREIGN_DIAGNOSTIC_FILE_NAME)
}

export interface PersistForeignDiagnosticInput {
  readonly projectRoot: string
  readonly runId: string
  readonly record: ForeignDiagnosticRecord
  readonly secrets: readonly string[]
  readonly io?: ForeignDiagnosticIo
}

export interface PersistedForeignDiagnostic {
  readonly filePath: string
  readonly bytes: number
  readonly summary: string
}

/**
 * Persists the projected record through an exclusive `0600` temp file plus a
 * hard-link publish that never overwrites a preexisting target.
 *
 * Safety order:
 * 1. size-bound and re-assert the payload is secret-free;
 * 2. resolve + independently pin the owned project root and confine the scratch
 *    root to it (rejects a symlinked/outside scratch root);
 * 3. reject a symlinked scratch root/ancestor BEFORE creating anything;
 * 4. create the run directory, re-confine its real path to the scratch root;
 * 5. write+fsync the complete payload into an exclusive temp, then link it to
 *    the final name (link fails if the target already exists);
 * 6. on any failure, remove ONLY the temp this call created (identity-checked).
 *
 * Any failure becomes a generic `ForeignDiagnosticError`; the raw error and the
 * record contents are never echoed.
 */
export function persistForeignDiagnostic(
  input: PersistForeignDiagnosticInput,
): PersistedForeignDiagnostic {
  const io = input.io ?? defaultForeignDiagnosticIo
  const filePath = resolveForeignDiagnosticPath(input.projectRoot, input.runId)
  const payload = JSON.stringify(input.record)
  const payloadBytes = Buffer.byteLength(payload, 'utf8')

  if (payloadBytes > FOREIGN_DIAGNOSTIC_MAX_BYTES) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic payload exceeds the bounded size and was refused before writing',
    )
  }
  try {
    assertNoSecrets(payload, input.secrets)
  } catch {
    throw new ForeignDiagnosticError(
      'foreign diagnostic record still contains a secret; refusing to persist it',
    )
  }

  const projectRoot = path.resolve(input.projectRoot)
  const scratchRoot = path.resolve(projectRoot, CASH_LIVE_SCRATCH_ROOT)
  const runDir = path.dirname(filePath)

  let realProjectRoot: string
  let realScratchRoot: string
  try {
    realProjectRoot = io.realpathSync(projectRoot)
    realScratchRoot = io.realpathSync(scratchRoot)
  } catch {
    throw new ForeignDiagnosticError(
      'foreign diagnostic project/scratch roots could not be resolved safely',
    )
  }
  if (!isStrictlyInside(realProjectRoot, realScratchRoot)) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic scratch root resolves outside the owned project root',
    )
  }

  assertNoSymlinkedAncestors(io, projectRoot, runDir)

  try {
    io.mkdirSync(runDir)
  } catch {
    throw new ForeignDiagnosticError('foreign diagnostic run directory could not be created')
  }

  let realRunDir: string
  try {
    realRunDir = io.realpathSync(runDir)
  } catch {
    throw new ForeignDiagnosticError(
      'foreign diagnostic run directory could not be resolved safely',
    )
  }
  if (!isStrictlyInside(realScratchRoot, realRunDir)) {
    throw new ForeignDiagnosticError(
      'foreign diagnostic run directory resolves outside the reserved scratch root',
    )
  }

  const tempPath = buildExclusiveTempPath(filePath)
  let fd: number
  try {
    fd = io.openSync(tempPath, 'wx', 0o600)
  } catch {
    throw new ForeignDiagnosticError(
      'foreign diagnostic temp file could not be created exclusively',
    )
  }

  let created: ForeignDiagnosticFileStat
  try {
    created = io.fstatSync(fd)
  } catch {
    try {
      io.closeSync(fd)
    } catch {
      // A close failure must not mask the identity failure below.
    }
    throw new ForeignDiagnosticError('foreign diagnostic temp identity could not be captured')
  }

  let writeFailure = false
  try {
    const written = io.writeSync(fd, payload)
    if (written !== payloadBytes) writeFailure = true
    if (!writeFailure) io.fsyncSync(fd)
  } catch {
    writeFailure = true
  } finally {
    try {
      io.closeSync(fd)
    } catch {
      // A close failure must not mask the write outcome.
    }
  }
  if (writeFailure) {
    removeOwnedTemp(io, tempPath, created)
    throw new ForeignDiagnosticError(
      'foreign diagnostic temp file could not be written completely; the underlying error was suppressed',
    )
  }

  try {
    // Hard link publishes the fully-written inode; it fails if the target exists.
    io.linkSync(tempPath, filePath)
  } catch {
    removeOwnedTemp(io, tempPath, created)
    throw new ForeignDiagnosticError(
      'foreign diagnostic file could not be published exclusively; a target may already exist',
    )
  }

  // The published file is authoritative; drop our temp link best-effort.
  try {
    io.unlinkSync(tempPath)
  } catch {
    // The published file remains valid; a leftover temp is an owned scratch file.
  }

  return Object.freeze({
    filePath,
    bytes: payloadBytes,
    summary: renderForeignDiagnosticSummary(input.record),
  })
}

// --- Single page-context GET ------------------------------------------------

export interface ForeignPageObservation {
  readonly status?: number
  readonly body?: unknown
  readonly transportFailure?: ForeignTransportFailure
}

/**
 * Performs EXACTLY ONE read-only GET from inside the guarded page. The token
 * rides only in the `Authorization` header, redirects are not followed, and a
 * raw (possibly token-bearing) error becomes a classified enum instead of
 * being rethrown. The caller projects the result through the allowlist.
 */
export async function fetchForeignSessionOnce(
  page: Page,
  url: string,
  accessToken: string,
): Promise<ForeignPageObservation> {
  try {
    const result = await page.evaluate(
      async ({ endpoint, token }) => {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          redirect: 'manual',
        })
        let body: unknown = null
        try {
          body = await response.json()
        } catch {
          body = null
        }
        return { status: response.status, body }
      },
      { endpoint: url, token: accessToken },
    )
    return { status: result.status, body: result.body }
  } catch (error) {
    return { transportFailure: classifyTransportFailure(error) }
  }
}
