/**
 * Per-actor live browser context for the isolated cash-live journey.
 *
 * This is the ONLY place that opens a `BrowserContext` for the live journey,
 * and it does so in a fixed, fail-closed order:
 *
 * 1. `browser.newContext` with the hardened options: `serviceWorkers: 'block'`
 *    (so the outbound guard can intercept Service-Worker requests),
 *    `baseURL` pinned to the owned frontend origin, `acceptDownloads: false`
 *    and `recordHar: undefined` (no HAR can ever persist an Authorization
 *    header).
 * 2. The outbound guard is installed ON THE CONTEXT (before any page exists,
 *    so popups are covered too) with EXACTLY the declared frontend and backend
 *    origins. Everything else is aborted by the guard; this module never
 *    routes/fulfils/mocks a response itself.
 * 3. The page is created and the backend-issued actor is seeded through
 *    `addInitScript` (so it lands before any app script runs).
 * 4. The journey receives `{ context, page, guard, close }`.
 *
 * No navigation happens here. If ANY setup step throws, the guard and the
 * context are torn down before the error propagates. Token-adjacent seed
 * failures are replaced with a generic `CashLiveContextError` so a raw
 * token-bearing message can never reach a public message; cleanup failures
 * during setup are suppressed so they cannot mask the original setup failure.
 */
import type { Browser, BrowserContext, BrowserContextOptions, Page } from '@playwright/test'

import type { ResolvedCashLiveEnv } from './env'
import type { ValidatedFixtureActor } from './fixture'
import { installOutboundGuard, type OutboundGuard } from './outbound-guard'
import { seedActor } from './auth-seed'

export class CashLiveContextError extends Error {}

/**
 * The exact context options for the live journey. `baseURL` is the owned
 * frontend origin; `recordHar: undefined` is deliberately explicit so no HAR
 * recording channel is ever derived from the injected Playwright config.
 */
export function buildLiveContextOptions(env: ResolvedCashLiveEnv): BrowserContextOptions {
  return {
    serviceWorkers: 'block',
    baseURL: env.frontendOrigin,
    acceptDownloads: false,
    recordHar: undefined,
  }
}

/** The only origins the live journey may reach: the owned frontend and declared backend. */
export function liveAllowedOrigins(env: ResolvedCashLiveEnv): readonly string[] {
  return [env.frontendOrigin, env.backendOrigin]
}

export interface LiveActorContext {
  readonly context: BrowserContext
  readonly page: Page
  readonly guard: OutboundGuard
  /** Disposes the guard then closes the context; both are always attempted. */
  close(): Promise<void>
}

/**
 * Opens one isolated context for one validated backend-issued actor.
 *
 * The caller owns the returned `close()` (e.g. `try/finally`). Setup failures
 * tear down whatever was already created before rethrowing.
 */
export async function openLiveActorContext(
  browser: Browser,
  env: ResolvedCashLiveEnv,
  actor: ValidatedFixtureActor,
): Promise<LiveActorContext> {
  const context = await browser.newContext(buildLiveContextOptions(env))
  let guard: OutboundGuard | undefined

  const close = async (): Promise<void> => {
    const failures: unknown[] = []
    if (guard) {
      try {
        await guard.dispose()
      } catch (error) {
        failures.push(error)
      }
    }
    try {
      await context.close()
    } catch (error) {
      failures.push(error)
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(failures, 'cash-live actor context cleanup failed')
    }
  }

  try {
    // Context-level install BEFORE the page exists so popups are covered too.
    guard = await installOutboundGuard(context, liveAllowedOrigins(env))
    const page = await context.newPage()
    try {
      await seedActor(page, actor)
    } catch {
      // The seed plan carries the backend access token: never echo the raw
      // failure, which could serialize a credential into a public message.
      throw new CashLiveContextError(
        'failed to seed the actor auth contract; the underlying error message is suppressed so no credential can leak',
      )
    }
    return { context, page, guard, close }
  } catch (error) {
    // Best-effort teardown; a cleanup failure must never mask the setup failure.
    await close().catch(() => {})
    throw error
  }
}
