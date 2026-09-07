import { expect, test as base } from '@playwright/test'
import { installStrictNetwork, type DeclaredRoute, type StrictNetworkController } from './network'
import { RESPONSIVE_WEB_SERVER_PORT } from '../../../playwright.responsive.config'

/** Fixed same-origin base for strict `/__e2e-api/**` interception. */
export const RESPONSIVE_ORIGIN = `http://127.0.0.1:${RESPONSIVE_WEB_SERVER_PORT}`

export interface ResponsiveFixtures {
  /** Declared `/__e2e-api` routes consumed by the `strictNetwork` fixture. */
  declaredRoutes: readonly DeclaredRoute[]
  strictNetwork: StrictNetworkController
}

export const test = base.extend<ResponsiveFixtures>({
  declaredRoutes: [[], { option: true }],
  strictNetwork: async ({ page, declaredRoutes }, use) => {
    const controller = await installStrictNetwork(page, RESPONSIVE_ORIGIN, declaredRoutes)
    await use(controller)
    await controller.releaseDeferred() // teardown release: deferred gates never leak past a test
  },
})
export { expect }
