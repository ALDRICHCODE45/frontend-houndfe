/**
 * Per-actor live browser context for the editorial-live journey (modeled on
 * `e2e/cash-live/support/live-context.ts`). Fixed, fail-closed order:
 *
 * 1. `browser.newContext` with `serviceWorkers: 'block'`, `baseURL` = owned frontend origin,
 *    `acceptDownloads: false`, `recordHar: undefined` (no HAR can persist an Authorization header).
 * 2. The outbound guard (reused from cash-live) is installed on the CONTEXT with exactly the
 *    frontend and backend origins; everything else is aborted and recorded as `METHOD origin`.
 * 3. The page is created, the network audit attached, and the actor seeded via `addInitScript`.
 *
 * No navigation happens here. A failed setup tears everything down; a seed failure is replaced by
 * a generic error so a token-bearing message never surfaces.
 */
import type { Browser, BrowserContext, BrowserContextOptions, Page } from '@playwright/test'

import { installOutboundGuard, type OutboundGuard } from '../../cash-live/support/outbound-guard'
import { seedEditorialActor } from './auth-seed'
import type { ResolvedEditorialLiveEnv } from './env'
import type { ValidatedEditorialActor } from './fixture'
import { installNetworkAudit, type NetworkAudit } from './network-audit'

export class EditorialLiveContextError extends Error {}

export function buildLiveContextOptions(env: ResolvedEditorialLiveEnv): BrowserContextOptions {
  return { serviceWorkers: 'block', baseURL: env.frontendOrigin, acceptDownloads: false, recordHar: undefined }
}

/** The only origins the journey may reach. */
export function liveAllowedOrigins(env: ResolvedEditorialLiveEnv): readonly string[] {
  return [env.frontendOrigin, env.backendOrigin]
}

export interface LiveEditorialContext {
  readonly context: BrowserContext
  readonly page: Page
  readonly guard: OutboundGuard
  readonly audit: NetworkAudit
  /** Disposes the audit and guard, then closes the context; every step is attempted. */
  close(): Promise<void>
}

export async function openLiveEditorialContext(
  browser: Browser,
  env: ResolvedEditorialLiveEnv,
  actor: ValidatedEditorialActor,
): Promise<LiveEditorialContext> {
  const context = await browser.newContext(buildLiveContextOptions(env))
  let guard: OutboundGuard | undefined
  let audit: NetworkAudit | undefined

  const close = async (): Promise<void> => {
    const failures: unknown[] = []
    for (const step of [() => audit?.dispose(), () => guard?.dispose(), () => context.close()]) {
      try {
        await step()
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'editorial-live context cleanup failed')
  }

  try {
    guard = await installOutboundGuard(context, liveAllowedOrigins(env))
    const page = await context.newPage()
    audit = installNetworkAudit(page, env.backendBaseUrl)
    try {
      await seedEditorialActor(page, actor)
    } catch {
      throw new EditorialLiveContextError('failed to seed the actor auth contract; the underlying error is suppressed so no credential can leak')
    }
    return { context, page, guard, audit, close }
  } catch (error) {
    await close().catch(() => {})
    throw error
  }
}
