/**
 * Focused unit tests for the foreign-session diagnostic harness
 * (`../support/foreign-diagnostic.ts`).
 *
 * The diagnostic is the ONLY artifact this spec exists to protect: it must
 * project an HTTP observation down to the allowlisted fields, preserve the
 * classified transport failure (including a value already classified by the
 * page GET), redact every supplied token BEFORE anything reaches disk, confine
 * the persisted path to the reserved scratch run directory plus the owned
 * project root, publish the file without overwriting a preexisting target, and
 * leave NOTHING behind when persistence fails.
 *
 * Everything here runs against synthetic in-memory stubs: no browser, no
 * network, no services and no fixture file. The receipt constants are asserted
 * directly so a drifted pinned value fails HERE rather than during a live run.
 */
import { describe, expect, it } from 'vitest'
import type { Page } from '@playwright/test'

import {
  FOREIGN_DIAGNOSTIC_BACKEND_ORIGIN,
  FOREIGN_DIAGNOSTIC_FILE_NAME,
  FOREIGN_DIAGNOSTIC_FRONTEND_ORIGIN,
  FOREIGN_DIAGNOSTIC_MAX_BYTES,
  FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS,
  FOREIGN_DIAGNOSTIC_RESOURCE_ID,
  ForeignDiagnosticError,
  assertForeignDiagnosticPreflight,
  buildForeignSessionUrl,
  classifyTransportFailure,
  evaluateForeignTtl,
  fetchForeignSessionOnce,
  persistForeignDiagnostic,
  projectForeignObservation,
  renderForeignDiagnosticSummary,
  resolveForeignDiagnosticPath,
  resolveForeignSessionId,
  type ForeignDiagnosticRecord,
} from '../support/foreign-diagnostic'

const ACCESS_TOKEN = 'synthetic-foreign-access-token-0001'
const TARGET_SESSION = '7e3be777-25ef-4562-9383-68510f59b1da'
const NOW = Date.parse('2026-10-09T00:00:00.000Z')

const PROJECT_ROOT = '/project'
const SCRATCH_ROOT = `${PROJECT_ROOT}/artifacts/cash-live`
const RUN_ID = 'cash-live-diagnostic'
const RUN_DIR = `${SCRATCH_ROOT}/${RUN_ID}`
const FINAL_PATH = `${RUN_DIR}/${FOREIGN_DIAGNOSTIC_FILE_NAME}`

const iso = (offsetSeconds: number): string => new Date(NOW + offsetSeconds * 1000).toISOString()

/** Only the exact, human-pinned receipt values are accepted. */
const preflightBase = {
  backendOrigin: FOREIGN_DIAGNOSTIC_BACKEND_ORIGIN,
  frontendOrigin: FOREIGN_DIAGNOSTIC_FRONTEND_ORIGIN,
  resourceId: FOREIGN_DIAGNOSTIC_RESOURCE_ID,
  foreignTenantId: 'tenant-b-id',
  operatingTenantId: 'tenant-a-id',
  foreignPermissionCodes: ['read:CashSession'],
}

function validRecord(overrides: Partial<ForeignDiagnosticRecord> = {}): ForeignDiagnosticRecord {
  return Object.freeze({
    status: 422,
    statusCode: 422,
    error: 'CASH_SESSION_NOT_FOUND',
    message: 'Cash session not found',
    timestamp: '2026-10-09T01:23:10.000Z',
    sessionId: TARGET_SESSION,
    ...overrides,
  })
}

// --- In-memory filesystem harness -------------------------------------------

type EntryKind = 'file' | 'dir' | 'symlink'

interface FsEntry {
  readonly dev: number
  readonly ino: number
  readonly kind: EntryKind
  readonly data: string
}

interface StatLike {
  readonly dev: number
  readonly ino: number
  isSymbolicLink(): boolean
}

interface FsHarnessOptions {
  readonly entries?: readonly (readonly [string, { kind?: EntryKind; data?: string }])[]
  readonly realpath?: (target: string) => string
  readonly openError?: Error
  readonly writeError?: Error
  readonly fsyncError?: Error
  readonly shortWrite?: boolean
  readonly linkError?: Error
  readonly lstatOverride?: (target: string) => StatLike
}

/**
 * A small virtual filesystem used to prove the persistence ownership rules:
 * the exclusive temp is created and removed by THIS call, a preexisting target
 * is never touched, and an identity mismatch blocks deletion.
 */
function createFsHarness(options: FsHarnessOptions = {}) {
  const entries = new Map<string, FsEntry>()
  const fds = new Map<number, { readonly path: string; readonly entry: FsEntry }>()
  const opens: { readonly path: string; readonly flag: string; readonly mode: number }[] = []
  const links: { readonly from: string; readonly to: string }[] = []
  const unlinks: string[] = []
  const writes: string[] = []
  const fsyncs: string[] = []
  const closes: number[] = []
  let nextFd = 200
  let nextIno = 1

  const seed = (p: string, partial: { kind?: EntryKind; data?: string } = {}): void => {
    entries.set(p, {
      dev: 7,
      ino: nextIno++,
      kind: partial.kind ?? 'file',
      data: partial.data ?? '',
    })
  }

  seed(PROJECT_ROOT, { kind: 'dir' })
  seed(`${PROJECT_ROOT}/artifacts`, { kind: 'dir' })
  seed(SCRATCH_ROOT, { kind: 'dir' })
  for (const [p, partial] of options.entries ?? []) seed(p, partial)

  const io = {
    mkdirSync(dir: string): void {
      const parts = dir.split('/').filter(Boolean)
      let current = ''
      for (const part of parts) {
        current += `/${part}`
        if (!entries.has(current)) seed(current, { kind: 'dir' })
      }
    },
    realpathSync(target: string): string {
      return options.realpath ? options.realpath(target) : target
    },
    lstatSync(target: string): StatLike {
      if (options.lstatOverride) return options.lstatOverride(target)
      const entry = entries.get(target)
      if (!entry) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return { dev: entry.dev, ino: entry.ino, isSymbolicLink: () => entry.kind === 'symlink' }
    },
    openSync(target: string, flag: string, mode: number): number {
      opens.push({ path: target, flag, mode })
      if (options.openError) throw options.openError
      if (entries.has(target)) throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' })
      seed(target, { kind: 'file', data: '' })
      const entry = entries.get(target) as FsEntry
      const fd = nextFd++
      fds.set(fd, { path: target, entry })
      return fd
    },
    fstatSync(fd: number): StatLike {
      const held = fds.get(fd)
      if (!held) throw new Error('EBADF')
      return { dev: held.entry.dev, ino: held.entry.ino, isSymbolicLink: () => false }
    },
    writeSync(fd: number, data: string): number {
      const held = fds.get(fd)
      if (!held) throw new Error('EBADF')
      if (options.writeError) throw options.writeError
      if (options.shortWrite) return Buffer.byteLength(data, 'utf8') - 1
      const entry = entries.get(held.path)
      if (!entry) throw new Error('ENOENT')
      entries.set(held.path, { ...entry, data: entry.data + data })
      writes.push(data)
      return Buffer.byteLength(data, 'utf8')
    },
    fsyncSync(fd: number): void {
      if (options.fsyncError) throw options.fsyncError
      const held = fds.get(fd)
      if (held) fsyncs.push(held.path)
    },
    closeSync(fd: number): void {
      closes.push(fd)
      fds.delete(fd)
    },
    linkSync(from: string, to: string): void {
      links.push({ from, to })
      if (options.linkError) throw options.linkError
      if (entries.has(to)) throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' })
      const src = entries.get(from)
      if (!src) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      entries.set(to, { ...src, data: src.data })
    },
    unlinkSync(target: string): void {
      unlinks.push(target)
      entries.delete(target)
    },
  }

  return { io, entries, opens, links, unlinks, writes, fsyncs, closes }
}

function persistWith(io: unknown, record = validRecord()) {
  return persistForeignDiagnostic({
    projectRoot: PROJECT_ROOT,
    runId: RUN_ID,
    record,
    secrets: [ACCESS_TOKEN],
    io: io as never,
  })
}

function captureError(run: () => unknown): Error {
  try {
    run()
  } catch (error) {
    return error as Error
  }
  throw new Error('expected the persistence call to reject')
}

// --- Receipt constants ------------------------------------------------------

describe('foreign diagnostic — pinned receipt constants', () => {
  it('pins the authorized backend origin, frontend origin, resource and minimum TTL', () => {
    expect(FOREIGN_DIAGNOSTIC_BACKEND_ORIGIN).toBe('http://127.0.0.1:36383')
    expect(FOREIGN_DIAGNOSTIC_FRONTEND_ORIGIN).toBe('http://127.0.0.1:4189')
    expect(FOREIGN_DIAGNOSTIC_RESOURCE_ID).toBe('7e3be777-25ef-4562-9383-68510f59b1da')
    expect(FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS).toBe(300)
    expect(FOREIGN_DIAGNOSTIC_FILE_NAME).toBe('foreign-session-diagnostic.json')
  })
})

// --- TTL preflight ----------------------------------------------------------

describe('foreign diagnostic — TTL preflight (stop/skip, never renew)', () => {
  it('accepts a token with the strict minimum remaining life', () => {
    expect(evaluateForeignTtl({ expiresAt: iso(300), ttlSeconds: 300 }, NOW)).toEqual({
      verdict: 'ok',
      remainingSeconds: 300,
    })
  })

  it('reports insufficient when less than the minimum remains', () => {
    expect(evaluateForeignTtl({ expiresAt: iso(299), ttlSeconds: 7200 }, NOW)).toEqual({
      verdict: 'insufficient',
      remainingSeconds: 299,
    })
  })

  it('reports insufficient when the declared lifetime is below the minimum', () => {
    expect(evaluateForeignTtl({ expiresAt: iso(7200), ttlSeconds: 120 }, NOW)).toEqual({
      verdict: 'insufficient',
      remainingSeconds: 7200,
    })
  })

  it('reports expired for a token that is already past its expiry', () => {
    expect(evaluateForeignTtl({ expiresAt: iso(-1), ttlSeconds: 7200 }, NOW)).toEqual({
      verdict: 'expired',
      remainingSeconds: -1,
    })
  })

  it('fails generically on a malformed TTL contract', () => {
    expect(() => evaluateForeignTtl({ expiresAt: 'not-a-date', ttlSeconds: 7200 }, NOW)).toThrow(
      ForeignDiagnosticError,
    )
  })
})

// --- Ownership / tenant / permission preflight ------------------------------

describe('foreign diagnostic — ownership/tenant/permission preflight', () => {
  it('accepts the exact pinned receipt with a distinct foreign tenant holding read:CashSession', () => {
    expect(() => assertForeignDiagnosticPreflight(preflightBase)).not.toThrow()
  })

  it('rejects a backend origin other than the authorized receipt', () => {
    expect(() =>
      assertForeignDiagnosticPreflight({
        ...preflightBase,
        backendOrigin: 'http://127.0.0.1:3000',
      }),
    ).toThrow(ForeignDiagnosticError)
  })

  it('rejects a frontend origin other than the owned origin', () => {
    expect(() =>
      assertForeignDiagnosticPreflight({
        ...preflightBase,
        frontendOrigin: 'http://localhost:4189',
      }),
    ).toThrow(ForeignDiagnosticError)
  })

  it('rejects a resource that does not match the owned resource', () => {
    expect(() =>
      assertForeignDiagnosticPreflight({
        ...preflightBase,
        resourceId: 'aaaaaaaa-0000-4000-8000-000000000001',
      }),
    ).toThrow(ForeignDiagnosticError)
  })

  it('rejects a foreign tenant that is not distinct from the operating tenant', () => {
    expect(() =>
      assertForeignDiagnosticPreflight({
        ...preflightBase,
        foreignTenantId: preflightBase.operatingTenantId,
      }),
    ).toThrow(/distinct/)
  })

  it('rejects a foreign actor without read:CashSession', () => {
    expect(() =>
      assertForeignDiagnosticPreflight({ ...preflightBase, foreignPermissionCodes: ['read:Sale'] }),
    ).toThrow(/read:CashSession/)
  })
})

// --- Target session id ------------------------------------------------------

describe('foreign diagnostic — target session id resolution', () => {
  it('returns null when the target is absent so the spec can skip without guessing', () => {
    expect(resolveForeignSessionId(undefined)).toBeNull()
    expect(resolveForeignSessionId('')).toBeNull()
    expect(resolveForeignSessionId('   ')).toBeNull()
  })

  it('accepts a UUID-shaped target session id', () => {
    expect(resolveForeignSessionId(TARGET_SESSION)).toBe(TARGET_SESSION)
  })

  it('rejects a malformed target with a generic error', () => {
    expect(() => resolveForeignSessionId('../../etc/passwd')).toThrow(ForeignDiagnosticError)
  })

  it('builds the single GET endpoint from the validated base URL', () => {
    expect(buildForeignSessionUrl('http://127.0.0.1:36383/', TARGET_SESSION)).toBe(
      `http://127.0.0.1:36383/cash-sessions/${TARGET_SESSION}`,
    )
  })
})

// --- Structural projection --------------------------------------------------

describe('foreign diagnostic — structural projection (allowlist only)', () => {
  it('keeps only the allowlisted fields and drops headers/tokens/nested payloads', () => {
    const record = projectForeignObservation(
      {
        status: 422,
        body: {
          statusCode: 422,
          error: 'CASH_SESSION_NOT_FOUND',
          message: 'Cash session not found',
          timestamp: '2026-10-09T01:23:10.000Z',
          sessionId: TARGET_SESSION,
          headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
          accessToken: ACCESS_TOKEN,
          refreshToken: 'never-issued',
          stack: `boom ${ACCESS_TOKEN}`,
          nested: { token: ACCESS_TOKEN },
        },
      },
      [ACCESS_TOKEN],
    )

    expect(Object.keys(record).sort()).toEqual([
      'error',
      'message',
      'sessionId',
      'status',
      'statusCode',
      'timestamp',
    ])
    expect(JSON.stringify(record)).not.toContain(ACCESS_TOKEN)
    expect(JSON.stringify(record)).not.toContain('headers')
    expect(JSON.stringify(record)).not.toContain('refreshToken')
  })

  it('keeps only the HTTP status when the body is not a JSON object', () => {
    const record = projectForeignObservation(
      { status: 502, body: `<html>${ACCESS_TOKEN}</html>` },
      [ACCESS_TOKEN],
    )
    expect(record).toEqual({ status: 502 })
  })

  it('drops wrongly typed allowlisted fields instead of coercing them', () => {
    const record = projectForeignObservation(
      {
        status: 422,
        body: { statusCode: '422', error: 7, message: null, sessionId: ['x'], timestamp: {} },
      },
      [],
    )
    expect(record).toEqual({ status: 422 })
  })
})

// --- Transport failure classification + projection survival -----------------

describe('foreign diagnostic — transport failure survives projection', () => {
  it('preserves an already-classified enum returned by the page GET', () => {
    expect(projectForeignObservation({ transportFailure: 'timeout' }, [])).toEqual({
      transportFailure: 'timeout',
    })
    expect(projectForeignObservation({ transportFailure: 'network-error' }, [])).toEqual({
      transportFailure: 'network-error',
    })
    expect(projectForeignObservation({ transportFailure: 'aborted' }, [])).toEqual({
      transportFailure: 'aborted',
    })
  })

  it('still classifies raw error objects and maps invalid input to unknown', () => {
    expect(projectForeignObservation({ transportFailure: { name: 'TimeoutError' } }, [])).toEqual({
      transportFailure: 'timeout',
    })
    expect(projectForeignObservation({ transportFailure: 'not-a-class' }, [])).toEqual({
      transportFailure: 'unknown',
    })
    expect(classifyTransportFailure({ name: 'AbortError' })).toBe('aborted')
    expect(classifyTransportFailure({ name: 'TimeoutError' })).toBe('timeout')
    expect(classifyTransportFailure({ code: 'ECONNREFUSED' })).toBe('network-error')
    expect(classifyTransportFailure(new TypeError('fetch failed'))).toBe('network-error')
    expect(classifyTransportFailure(new Error(`leak ${ACCESS_TOKEN}`))).toBe('unknown')
  })

  it('keeps the timeout classification through GET, projection and persistence', async () => {
    const page = {
      async evaluate() {
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
      },
    } as unknown as Page

    const observation = await fetchForeignSessionOnce(
      page,
      'http://127.0.0.1:36383/cash-sessions/x',
      ACCESS_TOKEN,
    )
    expect(observation.transportFailure).toBe('timeout')

    const record = projectForeignObservation(observation, [ACCESS_TOKEN])
    expect(record).toEqual({ transportFailure: 'timeout' })

    const harness = createFsHarness()
    persistWith(harness.io, record)
    expect(JSON.parse((harness.entries.get(FINAL_PATH) as FsEntry).data)).toEqual({
      transportFailure: 'timeout',
    })
    expect(JSON.stringify(record)).not.toContain(ACCESS_TOKEN)
  })
})

// --- Redaction --------------------------------------------------------------

describe('foreign diagnostic — redaction before persistence', () => {
  it('redacts a supplied token in every string field', () => {
    const record = projectForeignObservation(
      {
        status: 422,
        body: {
          error: `failed for ${ACCESS_TOKEN}`,
          message: `Bearer ${ACCESS_TOKEN} rejected`,
          sessionId: TARGET_SESSION,
          timestamp: '2026-10-09T01:23:10.000Z',
        },
      },
      [ACCESS_TOKEN],
    )
    expect(record.error).toContain('[REDACTED]')
    expect(record.message).toContain('[REDACTED]')
    expect(JSON.stringify(record)).not.toContain(ACCESS_TOKEN)
  })
})

// --- Path confinement -------------------------------------------------------

describe('foreign diagnostic — path confinement', () => {
  it('resolves the diagnostic inside the scratch run directory only', () => {
    expect(resolveForeignDiagnosticPath(PROJECT_ROOT, RUN_ID)).toBe(FINAL_PATH)
  })

  it('rejects a run id that is not a single safe filename segment', () => {
    expect(() => resolveForeignDiagnosticPath(PROJECT_ROOT, '../escape')).toThrow(
      ForeignDiagnosticError,
    )
    expect(() => resolveForeignDiagnosticPath(PROJECT_ROOT, 'a/b')).toThrow(ForeignDiagnosticError)
    expect(() => resolveForeignDiagnosticPath(PROJECT_ROOT, '..')).toThrow(ForeignDiagnosticError)
  })
})

// --- Owned-root + symlink confinement (blocker 3) ---------------------------

describe('foreign diagnostic — owned project root and symlink confinement', () => {
  it('rejects a scratch root that resolves outside the pinned project root', () => {
    const harness = createFsHarness({
      realpath: (target) =>
        target.startsWith(SCRATCH_ROOT)
          ? target.replace(SCRATCH_ROOT, '/outside/cash-live')
          : target,
    })

    const error = captureError(() => persistWith(harness.io))

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(error.message).not.toContain(ACCESS_TOKEN)
    expect(harness.opens).toEqual([])
    expect(harness.links).toEqual([])
    expect(harness.unlinks).toEqual([])
  })

  it('rejects a symlinked scratch-root ancestor BEFORE creating or opening anything', () => {
    const harness = createFsHarness({ entries: [[SCRATCH_ROOT, { kind: 'symlink' }]] })

    const error = captureError(() => persistWith(harness.io))

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(harness.opens).toEqual([])
    expect(harness.links).toEqual([])
  })

  it('rejects a run directory that resolves outside the valid scratch root', () => {
    const harness = createFsHarness({
      realpath: (target) => (target === RUN_DIR ? '/outside/run' : target),
    })

    const error = captureError(() => persistWith(harness.io))

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(harness.opens).toEqual([])
    expect(harness.links).toEqual([])
  })
})

// --- Exclusive temp + atomic no-overwrite publish (blocker 1) ---------------

describe('foreign diagnostic — exclusive temp + atomic no-overwrite publish', () => {
  it('writes a 0600 exclusive temp then publishes it without overwriting', () => {
    const harness = createFsHarness()
    const record = validRecord()

    const result = persistWith(harness.io, record)

    expect(harness.opens).toHaveLength(1)
    const tempPath = harness.opens[0]?.path ?? ''
    expect(harness.opens[0]?.flag).toBe('wx')
    expect(harness.opens[0]?.mode).toBe(0o600)
    expect(tempPath).not.toBe(FINAL_PATH)
    expect(harness.writes).toHaveLength(1)
    expect(harness.fsyncs).toEqual([tempPath])
    expect(harness.links).toEqual([{ from: tempPath, to: FINAL_PATH }])
    expect(harness.unlinks).toEqual([tempPath])
    expect(harness.entries.has(tempPath)).toBe(false)
    expect(JSON.parse((harness.entries.get(FINAL_PATH) as FsEntry).data)).toEqual(record)
    expect(result.filePath).toBe(FINAL_PATH)
    expect(result.summary).toContain('status=422')
  })

  it('removes the exclusive temp and leaves no file after a SHORT write', () => {
    const harness = createFsHarness({ shortWrite: true })

    const error = captureError(() => persistWith(harness.io))
    const tempPath = harness.opens[0]?.path ?? ''

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(harness.links).toEqual([])
    expect(harness.unlinks).toEqual([tempPath])
    expect(harness.entries.has(tempPath)).toBe(false)
    expect(harness.entries.has(FINAL_PATH)).toBe(false)
  })

  it('removes the exclusive temp and leaves no file after a WRITE failure', () => {
    const harness = createFsHarness({ writeError: new Error(`write boom ${ACCESS_TOKEN}`) })

    const error = captureError(() => persistWith(harness.io))
    const tempPath = harness.opens[0]?.path ?? ''

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(error.message).not.toContain(ACCESS_TOKEN)
    expect(harness.links).toEqual([])
    expect(harness.entries.has(tempPath)).toBe(false)
    expect(harness.entries.has(FINAL_PATH)).toBe(false)
  })

  it('removes the exclusive temp and leaves no file after an FSYNC failure', () => {
    const harness = createFsHarness({ fsyncError: new Error('fsync boom') })

    const error = captureError(() => persistWith(harness.io))
    const tempPath = harness.opens[0]?.path ?? ''

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(harness.links).toEqual([])
    expect(harness.entries.has(tempPath)).toBe(false)
    expect(harness.entries.has(FINAL_PATH)).toBe(false)
  })

  it('refuses to overwrite a preexisting target and leaves it unchanged', () => {
    const harness = createFsHarness({
      entries: [[FINAL_PATH, { kind: 'file', data: 'preexisting' }]],
    })

    const error = captureError(() => persistWith(harness.io))
    const tempPath = harness.opens[0]?.path ?? ''

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect((harness.entries.get(FINAL_PATH) as FsEntry).data).toBe('preexisting')
    expect(harness.links).toEqual([{ from: tempPath, to: FINAL_PATH }])
    expect(harness.entries.has(tempPath)).toBe(false)
  })

  it('never deletes a temp whose identity no longer matches what this call created', () => {
    const harness = createFsHarness({
      writeError: new Error('write boom'),
      lstatOverride: (target) =>
        target.endsWith('.tmp')
          ? { dev: 7, ino: 999999, isSymbolicLink: () => false }
          : { dev: 7, ino: 1, isSymbolicLink: () => false },
    })

    const error = captureError(() => persistWith(harness.io))
    const tempPath = harness.opens[0]?.path ?? ''

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(harness.unlinks).toEqual([])
    expect(harness.entries.has(tempPath)).toBe(true)
  })

  it('refuses an oversized payload before opening anything', () => {
    const harness = createFsHarness()
    const huge = validRecord({ message: 'x'.repeat(FOREIGN_DIAGNOSTIC_MAX_BYTES + 1) })

    const error = captureError(() => persistWith(harness.io, huge))

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(harness.opens).toEqual([])
  })

  it('refuses to persist when a supplied token survived into the record', () => {
    const harness = createFsHarness()
    const leaky = validRecord({ message: `Bearer ${ACCESS_TOKEN}` })

    const error = captureError(() => persistWith(harness.io, leaky))

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(harness.opens).toEqual([])
  })

  it('fails generically when the exclusive temp cannot be created', () => {
    const harness = createFsHarness({ openError: new Error(`EEXIST ${ACCESS_TOKEN}`) })

    const error = captureError(() => persistWith(harness.io))

    expect(error).toBeInstanceOf(ForeignDiagnosticError)
    expect(error.message).not.toContain(ACCESS_TOKEN)
    expect(error.message).not.toContain('EEXIST')
    expect(harness.entries.has(FINAL_PATH)).toBe(false)
  })
})

// --- Safe summary -----------------------------------------------------------

describe('foreign diagnostic — safe summary', () => {
  it('renders only safe, already-redacted fields', () => {
    const summary = renderForeignDiagnosticSummary(validRecord({ error: 'CASH_SESSION_NOT_FOUND' }))
    expect(summary).toContain('status=422')
    expect(summary).toContain('error=CASH_SESSION_NOT_FOUND')
    expect(summary).toContain(`sessionId=${TARGET_SESSION}`)
    expect(summary).not.toContain(ACCESS_TOKEN)
  })
})

// --- Single page GET --------------------------------------------------------

describe('foreign diagnostic — single page GET', () => {
  it('performs one page-context GET and returns the observed status/body', async () => {
    let evaluateCalls = 0
    const page = {
      async evaluate() {
        evaluateCalls += 1
        return { status: 422, body: { statusCode: 422, error: 'CASH_SESSION_NOT_FOUND' } }
      },
    } as unknown as Page

    const observation = await fetchForeignSessionOnce(
      page,
      buildForeignSessionUrl(FOREIGN_DIAGNOSTIC_BACKEND_ORIGIN, TARGET_SESSION),
      ACCESS_TOKEN,
    )

    expect(evaluateCalls).toBe(1)
    expect(observation.status).toBe(422)
    expect(observation.body).toEqual({ statusCode: 422, error: 'CASH_SESSION_NOT_FOUND' })
  })

  it('converts a token-bearing page error into a classified transport failure', async () => {
    const page = {
      async evaluate() {
        throw new Error(`Bearer ${ACCESS_TOKEN} exploded`)
      },
    } as unknown as Page

    const observation = await fetchForeignSessionOnce(
      page,
      'http://127.0.0.1:36383/x',
      ACCESS_TOKEN,
    )

    expect(observation.status).toBeUndefined()
    expect(observation.transportFailure).toBe('unknown')
    expect(JSON.stringify(observation)).not.toContain(ACCESS_TOKEN)
  })
})
