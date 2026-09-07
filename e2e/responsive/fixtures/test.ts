import { expect, test as base } from '@playwright/test'
import { resolveRunId } from '../../../playwright.responsive.config'
import { EVIDENCE_ATTACHMENT_NAME } from '../evidence/schema'
import { EvidenceSession } from '../evidence/session'
import { EXPECTED_BLOCKED_STARTUP_EXTERNALS, installStrictNetwork, type DeclaredRoute, type StrictNetworkController } from './network'
import { RESPONSIVE_WEB_SERVER_PORT } from '../../../playwright.responsive.config'

/** Fixed same-origin base for strict `/__e2e-api/**` interception. */
export const RESPONSIVE_ORIGIN = `http://127.0.0.1:${RESPONSIVE_WEB_SERVER_PORT}`

export interface ResponsiveFixtures {
  /** Declared `/__e2e-api` routes consumed by the `strictNetwork` fixture. */
  declaredRoutes: readonly DeclaredRoute[]
  /** Per-test evidence session; finalizes and attaches records after the test, then rejects invalid aggregates. */
  evidenceSession: EvidenceSession
  strictNetwork: StrictNetworkController
}

export const test = base.extend<ResponsiveFixtures>({
  declaredRoutes: [[], { option: true }],
  evidenceSession: async ({ }, use, testInfo) => {
    const session = new EvidenceSession(resolveRunId(process.env))
    await use(session)
    const { records, errors } = session.finalize()
    // Attach valid per-test evidence BEFORE throwing the aggregate error so failures stay auditable.
    await testInfo.attach(EVIDENCE_ATTACHMENT_NAME, { body: JSON.stringify(records), contentType: 'application/json' })
    if (errors.length > 0) throw new Error(`responsive evidence session rejected records:\n${errors.join('\n')}`)
  },
  strictNetwork: async ({ page, declaredRoutes }, use) => {
    const controller = await installStrictNetwork(page, RESPONSIVE_ORIGIN, declaredRoutes, EXPECTED_BLOCKED_STARTUP_EXTERNALS)
    await use(controller)
    await controller.releaseDeferred() // teardown release: deferred gates never leak past a test
  },
})
export { expect }
