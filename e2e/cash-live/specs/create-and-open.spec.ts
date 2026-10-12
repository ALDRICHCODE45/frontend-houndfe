/**
 * First ACTUAL cash-live journey: create one register and open its first cash
 * session against the human-authorized, isolated local backend.
 *
 * Scope (`odd/tasks/cash-register-live-validation.md` S1–S2, WU "first flow"):
 *   navigate `/pos/caja` → assert the register list is EMPTY (fail BEFORE any
 *   mutation if it is not) → create one uniquely named fictitious register →
 *   assert the UI item → reload and re-assert persistence → select "Abrir caja"
 *   → fund 50_000 cents behind the explicit confirmation → open the session →
 *   capture the POST structurally → verify the persisted OPEN session through
 *   the public API and the UI detail → prove cross-tenant isolation with a
 *   read-only foreign GET of the created session.
 *
 * Explicitly OUT of scope: sales binding, refund settlement, closing/PDF, any
 * second journey, and any mock/route/fulfil. The ONLY network policy is the
 * hardened per-actor context from `openLiveActorContext` (frontend + declared
 * backend origin allowed, everything else aborted). This spec installs NO route
 * handler of its own.
 *
 * Safety:
 *   - the backend-issued fixture is loaded at RUN time inside the test (never at
 *     module import), so `playwright test --list` cannot read it;
 *   - every browser context is closed in `finally`;
 *   - evidence is collected through the redacted collector with only selected
 *     method/status summaries; no header or body dump is ever persisted and no
 *     exception value is stored;
 *   - a failing step throws a generic, credential-free error; the raw
 *     Playwright error is never rethrown.
 *
 * Cross-tenant negative contract (authoritative
 * `houndfe-backend/.tmp/cash-register-closing/docs/cash-register-closing.md`
 * §Errors; exact body shape confirmed against the backend source seq14, not an
 * HTTP observation): a cash id outside the caller's tenant scope fails closed
 * with the flat body `{ statusCode: 422, error: 'CASH_SESSION_NOT_FOUND',
 * message: 'Cash session not found', timestamp, sessionId }` — **422**, not
 * `404`, and no `code`/`error.code`. A missing ability is instead a guard
 * failure (`401`/`403`), so the preflight requires the foreign actor to hold
 * `read:CashSession` to make the tenant-scoping `422` reachable.
 */
import { expect, test, type Page } from '@playwright/test'

import { resolveCashLiveEnv, type ResolvedCashLiveEnv } from '../support/env'
import {
  loadCashLiveFixture,
  type ValidatedCashLiveFixture,
  type ValidatedFixtureActor,
} from '../support/fixture'
import { openLiveActorContext, type LiveActorContext } from '../support/live-context'
import { createEvidenceCollector, type EvidenceKind } from '../support/evidence'

/**
 * Validated owned-environment identity (backend handoff L13). These constants
 * bind this one authorized validation run to the exact disposable resource; a
 * fixture from any other environment fails the preflight before a mutation.
 */
const EXPECTED_BACKEND_ORIGIN = 'http://127.0.0.1:36383'
const EXPECTED_FRONTEND_ORIGIN = 'http://127.0.0.1:4189'
const EXPECTED_RESOURCE_ID = '7e3be777-25ef-4562-9383-68510f59b1da'

/**
 * Authoritative cross-tenant negative contract for a cash id outside the
 * caller's tenant scope, confirmed against the backend source (seq14) rather
 * than an HTTP observation. Guard failures are `403`, so the preflight also
 * requires the foreign actor to hold `read:CashSession`.
 */
const FOREIGN_TENANT_NEGATIVE_STATUS = 422
const FOREIGN_TENANT_NEGATIVE_ERROR = 'CASH_SESSION_NOT_FOUND'
const FOREIGN_TENANT_NEGATIVE_MESSAGE = 'Cash session not found'

/** Permissive ISO-8601 timestamp shape: the value is variable, the form is pinned. */
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

/** The single opening fund exercised by this first flow (integer cents). */
const OPENING_FUND_CENTS = 50_000

/** The permissions the first flow needs BEFORE the first mutation. */
const CASHIER_REQUIRED_PERMISSIONS = [
  'read:CashRegister',
  'create:CashRegister',
  'create:CashSession',
  'read:CashSession',
] as const
const FOREIGN_REQUIRED_PERMISSIONS = ['read:CashSession'] as const

const UI_TIMEOUT = 30_000
const NAV_TIMEOUT = 60_000

/** Generic, credential-free journey failure. Never wraps the raw Playwright error. */
class CashLiveJourneyError extends Error {}

interface JourneyStep {
  readonly name: string
  readonly kind: EvidenceKind
}

interface PageApiResponse {
  readonly status: number
  readonly body: unknown
}

type ActorRole = 'cashier' | 'verifier' | 'foreign'

function actorOfRole(fixture: ValidatedCashLiveFixture, role: ActorRole): ValidatedFixtureActor {
  const actor = fixture.actors.find((candidate) => candidate.role === role)
  if (!actor) {
    throw new CashLiveJourneyError(`fixture is missing the required ${role} actor`)
  }
  return actor
}

/**
 * Fail-closed preflight: prove this run is bound to the validated owned
 * environment, is access-only, has not expired, keeps cashier + verifier in one
 * tenant with the foreign actor in a DIFFERENT one, and carries the permissions
 * the first flow needs — all BEFORE the first mutation.
 */
function preflight(env: ResolvedCashLiveEnv, fixture: ValidatedCashLiveFixture): void {
  expect(env.backendOrigin).toBe(EXPECTED_BACKEND_ORIGIN)
  expect(env.frontendOrigin).toBe(EXPECTED_FRONTEND_ORIGIN)
  expect(fixture.backend.resourceId).toBe(EXPECTED_RESOURCE_ID)
  expect(fixture.frontendOrigin).toBe(EXPECTED_FRONTEND_ORIGIN)
  expect(fixture.backend.url).toBe(env.backendBaseUrl)

  // Access-only contract: the owned backend issues no refresh token and no OTP.
  expect(fixture.metadata.accessOnly).toBe(true)
  expect(fixture.metadata.refreshTokenIssued).toBe(false)
  expect(fixture.metadata.otpIssued).toBe(false)

  const cashier = actorOfRole(fixture, 'cashier')
  const verifier = actorOfRole(fixture, 'verifier')
  const foreign = actorOfRole(fixture, 'foreign')

  const now = Date.now()
  for (const actor of [cashier, verifier, foreign]) {
    expect(Date.parse(actor.expiresAt)).toBeGreaterThan(now)
  }

  // Cashier and verifier share the operating tenant; the foreign actor is the
  // distinct-tenant denial/isolation actor.
  expect(cashier.tenantId).toBe(verifier.tenantId)
  expect(foreign.tenantId).not.toBe(cashier.tenantId)
  expect(foreign.userId).not.toBe(cashier.userId)

  for (const code of CASHIER_REQUIRED_PERMISSIONS) {
    expect(cashier.permissionCodes).toContain(code)
  }
  // The foreign actor must hold the ROUTE ability for the created resource so
  // the negative read reaches the tenant-scoping check (documented `422`) and is
  // not short-circuited into a guard `403`. A fixture that cannot exercise the
  // tenant-scoping contract fails HERE, before any mutation, so the run reports
  // `pending` instead of producing a misleading negative.
  for (const code of FOREIGN_REQUIRED_PERMISSIONS) {
    expect(foreign.permissionCodes).toContain(code)
  }
}

/**
 * Performs a read-only backend GET from INSIDE a guarded page. The request
 * travels through the context's outbound guard (the declared backend origin is
 * allowed) and the backend-issued token rides only in the `Authorization`
 * header. The token is never logged, echoed or persisted, redirects are not
 * followed, and a raw (possibly token-bearing) Playwright error is replaced by
 * a generic journey error.
 */
async function pageApiGet(page: Page, url: string, accessToken: string): Promise<PageApiResponse> {
  try {
    return await page.evaluate(
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
  } catch {
    throw new CashLiveJourneyError(
      'backend GET through the guarded page failed; the underlying error was suppressed so no credential can leak',
    )
  }
}

/**
 * Pins the EXACT flat error body of `GET /cash-sessions/:id` for a cash id
 * outside the caller's tenant scope (backend source seq14):
 * `{ statusCode: 422, error: 'CASH_SESSION_NOT_FOUND',
 * message: 'Cash session not found', timestamp, sessionId }` — a flat document
 * with no `code` and no `error.code`. Only structural fields are inspected; the
 * raw response is never logged and no exception value is persisted.
 */
function assertForeignSessionNotFound(body: unknown, sessionId: string): void {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new CashLiveJourneyError(
      'foreign tenant read did not return a flat JSON error document; the raw response is never logged',
    )
  }
  const record = body as Record<string, unknown>
  expect(record.statusCode).toBe(FOREIGN_TENANT_NEGATIVE_STATUS)
  expect(record.error).toBe(FOREIGN_TENANT_NEGATIVE_ERROR)
  expect(record.message).toBe(FOREIGN_TENANT_NEGATIVE_MESSAGE)
  expect(record.sessionId).toBe(sessionId)
  expect(record).not.toHaveProperty('code')
  const timestamp = record.timestamp
  expect(typeof timestamp).toBe('string')
  if (typeof timestamp === 'string') {
    expect(Number.isNaN(Date.parse(timestamp))).toBe(false)
    expect(ISO_TIMESTAMP_PATTERN.test(timestamp)).toBe(true)
  }
}

/** Best-effort context teardown; a close failure must never mask the journey outcome. */
async function closeQuietly(context: LiveActorContext | undefined): Promise<void> {
  if (!context) return
  try {
    await context.close()
  } catch {
    // Deliberately swallowed (see doc comment above).
  }
}

test('creates a register and opens its first cash session (isolated live backend)', async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000)

  const env = resolveCashLiveEnv(process.env)
  const fixture = loadCashLiveFixture(
    env.fixturePath,
    { backendUrl: env.backendBaseUrl, frontendOrigin: env.frontendOrigin },
    process.cwd(),
  )

  const cashier = actorOfRole(fixture, 'cashier')
  const foreign = actorOfRole(fixture, 'foreign')
  const collector = createEvidenceCollector(
    env.runId,
    fixture.actors.map((actor) => actor.tokens.access),
  )

  let live: LiveActorContext | undefined
  let foreignLive: LiveActorContext | undefined
  let step: JourneyStep = { name: 'preflight', kind: 'ui' }

  try {
    // 0. Fail-closed preflight — no mutation before this passes.
    preflight(env, fixture)
    collector.collect(
      'preflight',
      'ui',
      'pass',
      'owned isolated environment, access-only fixture, tenants and permissions verified',
    )

    live = await openLiveActorContext(browser, env, cashier)
    const page = live.page

    // 1. Navigate to the Caja route (the route guard reads the seeded ability).
    step = { name: 'navigate-caja', kind: 'ui' }
    await page.goto('/pos/caja', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    await expect(page.getByTestId('cash-registers-panel')).toBeVisible({ timeout: UI_TIMEOUT })

    // 2. The register list MUST be empty before any mutation.
    step = { name: 'registers-empty', kind: 'ui' }
    await expect(page.getByTestId('cash-registers-empty')).toBeVisible({ timeout: UI_TIMEOUT })
    collector.collect('registers-empty', 'ui', 'pass', 'register list empty before any mutation')

    // 3. Create one uniquely named fictitious register; capture status/id only.
    step = { name: 'create-register', kind: 'http' }
    const registerName = `Caja live ${Date.now()}`
    await page.getByTestId('cash-register-name-input').fill(registerName)
    const [registerResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url() === `${env.backendBaseUrl}/cash-registers`,
        { timeout: UI_TIMEOUT },
      ),
      page.getByTestId('cash-register-create-submit').click(),
    ])
    expect(registerResponse.status()).toBe(201)
    const registerBody = (await registerResponse.json()) as { id?: unknown; name?: unknown }
    const registerId = registerBody.id
    if (typeof registerId !== 'string' || registerId.length === 0) {
      throw new Error('register create response did not carry a string id')
    }
    expect(registerBody.name).toBe(registerName)
    collector.collect('create-register', 'http', 'pass', 'POST /cash-registers -> 201')

    // 4. The UI reflects the created register.
    step = { name: 'register-visible', kind: 'ui' }
    const registerItem = page.getByTestId(`cash-register-item-${registerId}`)
    await expect(registerItem).toBeVisible({ timeout: UI_TIMEOUT })
    await expect(registerItem.getByTestId('cash-register-name')).toHaveText(registerName)
    collector.collect('register-visible', 'ui', 'pass', 'created register rendered in the list')

    // 5. Persistence: a reload must show the register again.
    step = { name: 'register-persisted', kind: 'ui' }
    await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    await expect(page.getByTestId(`cash-register-item-${registerId}`)).toBeVisible({
      timeout: UI_TIMEOUT,
    })
    collector.collect('register-persisted', 'ui', 'pass', 'created register visible after reload')

    // 6. Select the register to open its session.
    step = { name: 'select-register', kind: 'ui' }
    await page.getByTestId(`cash-register-open-${registerId}`).click()
    await expect(page.getByTestId('cash-open-session')).toBeVisible({ timeout: UI_TIMEOUT })
    await expect(page.getByTestId('cash-open-register')).toContainText(registerName)

    // 7. Fund 50_000 cents behind the EXPLICIT confirmation checkbox.
    step = { name: 'confirm-opening-fund', kind: 'ui' }
    await page.getByTestId('cash-opening-cents').fill(String(OPENING_FUND_CENTS))
    const confirm = page.getByTestId('cash-opening-confirmed')
    await confirm.click()
    await expect(confirm).toHaveAttribute('data-state', 'checked')

    // 8. Open the session; capture the POST structurally (status + id + OPEN).
    step = { name: 'open-session', kind: 'http' }
    const [sessionResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url() === `${env.backendBaseUrl}/cash-registers/${registerId}/sessions`,
        { timeout: UI_TIMEOUT },
      ),
      page.getByTestId('cash-open-submit').click(),
    ])
    expect(sessionResponse.status()).toBe(201)
    const sessionBody = (await sessionResponse.json()) as {
      session?: { id?: unknown; status?: unknown; openingCents?: unknown }
      register?: { id?: unknown }
    }
    const sessionId = sessionBody.session?.id
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new Error('session open response did not carry a string id')
    }
    expect(sessionBody.session?.status).toBe('OPEN')
    expect(sessionBody.session?.openingCents).toBe(OPENING_FUND_CENTS)
    expect(sessionBody.register?.id).toBe(registerId)
    collector.collect(
      'open-session',
      'http',
      'pass',
      'POST /cash-registers/:id/sessions -> 201 OPEN',
    )

    // 9. Persistence through the public API: the created session is readable.
    step = { name: 'session-persisted', kind: 'http' }
    const persisted = await pageApiGet(
      page,
      `${env.backendBaseUrl}/cash-sessions/${sessionId}`,
      cashier.tokens.access,
    )
    expect(persisted.status).toBe(200)
    const persistedSession = (
      persisted.body as { session?: { id?: unknown; status?: unknown } } | null
    )?.session
    expect(persistedSession?.id).toBe(sessionId)
    expect(persistedSession?.status).toBe('OPEN')
    collector.collect('session-persisted', 'http', 'pass', 'GET /cash-sessions/:id -> 200 OPEN')

    // 10. The UI detail shows the persisted OPEN session.
    step = { name: 'session-detail-ui', kind: 'ui' }
    await expect(page.getByTestId('cash-session-summary')).toBeVisible({ timeout: UI_TIMEOUT })
    await expect(page.getByTestId('cash-session-status')).toHaveText('Abierta')
    await expect(page.getByTestId('cash-session-opening')).toContainText(/500[.,]00/)
    await expect(page.getByTestId('cash-session-register')).toHaveText(registerName)
    collector.collect(
      'session-detail-ui',
      'ui',
      'pass',
      'session summary shows OPEN with the opening fund',
    )

    // 11. Cross-tenant isolation: a read-only foreign GET of the created session
    //     fails closed with the documented tenant-scoping status.
    step = { name: 'foreign-tenant-read', kind: 'http' }
    foreignLive = await openLiveActorContext(browser, env, foreign)
    await foreignLive.page.goto('/login', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    const foreignRead = await pageApiGet(
      foreignLive.page,
      `${env.backendBaseUrl}/cash-sessions/${sessionId}`,
      foreign.tokens.access,
    )
    expect(foreignRead.status).toBe(FOREIGN_TENANT_NEGATIVE_STATUS)
    assertForeignSessionNotFound(foreignRead.body, sessionId)
    collector.collect(
      'foreign-tenant-read',
      'http',
      'pass',
      `GET /cash-sessions/:id as foreign tenant -> ${FOREIGN_TENANT_NEGATIVE_STATUS}`,
    )

    // 12. Neither hardened context may have reached an unlisted origin.
    expect(live.guard.violations()).toEqual([])
    expect(foreignLive.guard.violations()).toEqual([])
  } catch (error) {
    const message =
      error instanceof CashLiveJourneyError
        ? error.message
        : `step "${step.name}" failed; the underlying error was suppressed so no credential can leak`
    try {
      collector.collect(step.name, step.kind, 'fail', message)
    } catch {
      // Evidence collection must never mask the journey failure.
    }
    throw new CashLiveJourneyError(message)
  } finally {
    await closeQuietly(live)
    await closeQuietly(foreignLive)
    // Attach the redacted evidence; a failed attach must not change the outcome.
    await testInfo
      .attach('cash-live-evidence', {
        body: JSON.stringify(collector.records(), null, 2),
        contentType: 'application/json',
      })
      .catch(() => undefined)
  }
})
