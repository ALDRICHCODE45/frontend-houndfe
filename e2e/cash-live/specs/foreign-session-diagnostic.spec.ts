/**
 * Narrow foreign-session diagnostic: ONE read-only GET of the EXISTING fixed
 * cash session as the foreign-tenant actor, with a STABLE same-origin
 * navigation and a persisted, allowlisted observation.
 *
 * This replaces the broad `create-and-open` journey for the diagnosis only. It
 * does NOT create a register, open a session, exercise roles or exercise the
 * verifier. It must never trigger a login redirect (the failed attempt navigated
 * to `/login`; that hypothesis is NOT confirmed), so it navigates directly to
 * the stable SPA route `/pos/caja` on the owned origin and waits for the
 * registers panel before issuing the single GET.
 *
 * Network policy: this spec installs NO route handler of its own. It uses ONLY
 * the hardened per-actor context from `openLiveActorContext` (frontend +
 * declared backend allowed, everything else aborted). The SPA may issue its own
 * read-only auto-fetches (registers/sessions) on `/pos/caja`; the diagnostic
 * itself performs exactly ONE GET and issues no mutating call.
 *
 * Preflight (BEFORE any browser context exists): the pinned receipt
 * (backend 36383 / resource 7e3be777… / frontend 4189), a foreign tenant
 * distinct from the operating tenant, the `read:CashSession` ability, and a
 * strict minimum token TTL of 300 seconds. An expired/insufficient token is
 * SKIPPED — never renewed.
 *
 * Persistence: the observation is projected to the allowlisted fields, redacted
 * against the supplied token, and written atomically (O_EXCL, 0600) inside
 * `artifacts/cash-live/<runId>/`. There is no attach-only path: the diagnostic
 * MUST reach disk. Only a safe summary reaches stdout.
 *
 * The existing target session id is supplied by the caller through
 * `CASH_LIVE_FOREIGN_SESSION_ID`; when it is absent the diagnostic SKIPS rather
 * than guessing or creating a session.
 */
import { expect, test } from '@playwright/test'

import { resolveCashLiveEnv } from '../support/env'
import {
  loadCashLiveFixture,
  type ValidatedCashLiveFixture,
  type ValidatedFixtureActor,
} from '../support/fixture'
import { openLiveActorContext, type LiveActorContext } from '../support/live-context'
import {
  FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS,
  FOREIGN_DIAGNOSTIC_PANEL_TESTID,
  FOREIGN_DIAGNOSTIC_ROUTE,
  FOREIGN_DIAGNOSTIC_SESSION_ID_ENV,
  ForeignDiagnosticError,
  assertForeignDiagnosticPreflight,
  buildForeignSessionUrl,
  evaluateForeignTtl,
  fetchForeignSessionOnce,
  persistForeignDiagnostic,
  projectForeignObservation,
  resolveForeignSessionId,
} from '../support/foreign-diagnostic'

const NAV_TIMEOUT = 60_000
const UI_TIMEOUT = 30_000

/** A generic, credential-free failure. The raw Playwright error is never rethrown. */
class CashLiveDiagnosticError extends ForeignDiagnosticError {}

function actorOfRole(
  fixture: ValidatedCashLiveFixture,
  role: 'cashier' | 'foreign',
): ValidatedFixtureActor {
  const actor = fixture.actors.find((candidate) => candidate.role === role)
  if (!actor) {
    throw new CashLiveDiagnosticError(`fixture is missing the required ${role} actor`)
  }
  return actor
}

test('diagnoses the foreign-tenant cash-session read with one read-only GET (isolated live backend)', async ({
  browser,
}) => {
  test.setTimeout(120_000)

  const env = resolveCashLiveEnv(process.env)
  const fixture = loadCashLiveFixture(
    env.fixturePath,
    { backendUrl: env.backendBaseUrl, frontendOrigin: env.frontendOrigin },
    process.cwd(),
  )

  const cashier = actorOfRole(fixture, 'cashier')
  const foreign = actorOfRole(fixture, 'foreign')

  // Fail-closed receipt + tenant + permission preflight. A wrong receipt is a
  // real failure; only an expired/short token or an absent target skips.
  assertForeignDiagnosticPreflight({
    backendOrigin: env.backendOrigin,
    frontendOrigin: env.frontendOrigin,
    resourceId: fixture.backend.resourceId,
    foreignTenantId: foreign.tenantId,
    operatingTenantId: cashier.tenantId,
    foreignPermissionCodes: foreign.permissionCodes,
  })

  // Strict TTL gate BEFORE any context action. No renewal path exists.
  const ttl = evaluateForeignTtl(foreign, Date.now())
  if (ttl.verdict !== 'ok') {
    test.skip(
      true,
      `foreign diagnostic skipped: token is ${ttl.verdict} (${ttl.remainingSeconds}s remaining, minimum ${FOREIGN_DIAGNOSTIC_MIN_TTL_SECONDS}s); refusing to renew`,
    )
    return
  }

  const sessionId = resolveForeignSessionId(process.env[FOREIGN_DIAGNOSTIC_SESSION_ID_ENV])
  if (!sessionId) {
    test.skip(
      true,
      `foreign diagnostic skipped: ${FOREIGN_DIAGNOSTIC_SESSION_ID_ENV} is not set; refusing to guess or create a target`,
    )
    return
  }

  let live: LiveActorContext | undefined
  let failure: CashLiveDiagnosticError | undefined
  let cleanupFailed = false

  try {
    live = await openLiveActorContext(browser, env, foreign)
    const page = live.page

    // Stable same-origin navigation (never `/login`). The route guard reads the
    // seeded ability; the registers panel proves the route resolved.
    await page.goto(FOREIGN_DIAGNOSTIC_ROUTE, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT,
    })
    await expect(page.getByTestId(FOREIGN_DIAGNOSTIC_PANEL_TESTID)).toBeVisible({
      timeout: UI_TIMEOUT,
    })

    // The navigation must land EXACTLY on the stable same-origin route; any
    // redirect (including `/login`) fails here.
    const arrived = new URL(page.url())
    expect(arrived.origin).toBe(env.frontendOrigin)
    expect(arrived.pathname).toBe(FOREIGN_DIAGNOSTIC_ROUTE)

    // The diagnostic's ONLY request: one read-only GET of the existing session.
    const observation = await fetchForeignSessionOnce(
      page,
      buildForeignSessionUrl(env.backendBaseUrl, sessionId),
      foreign.tokens.access,
    )
    const record = projectForeignObservation(observation, [foreign.tokens.access])
    const persisted = persistForeignDiagnostic({
      projectRoot: process.cwd(),
      runId: env.runId,
      record,
      secrets: [foreign.tokens.access],
    })

    // Neither the diagnostic nor the app auto-fetch may reach an unlisted origin.
    expect(live.guard.violations()).toEqual([])

    // Only a safe, redacted summary reaches stdout; the full record is on disk.
    console.log(persisted.summary)
  } catch (error) {
    failure =
      error instanceof CashLiveDiagnosticError
        ? error
        : new CashLiveDiagnosticError(
            'foreign session diagnostic failed; the underlying error was suppressed so no credential can leak',
          )
  } finally {
    if (live) {
      try {
        await live.close()
      } catch {
        cleanupFailed = true
      }
    }
  }

  if (failure) throw failure
  if (cleanupFailed) {
    throw new CashLiveDiagnosticError(
      'foreign diagnostic context cleanup failed and was reported generically; the diagnostic did not pass',
    )
  }
})
