import { test, expect, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import { scenarioRoute, type ScenarioState } from '../fixtures/scenarios'
import { STRESS_ROWS, STRESS_TOKENS } from '../fixtures/stress-data'
import { DT01_PRODUCTS } from '../targets/dt01-products'
import { RESPONSIVE_VIEWPORTS, type ViewportCase } from '../targets/types'
import { assertBoxesWithinOwner, assertDocumentNoHorizontalOverflow, assertEssentialReachabilityAtExtremes, assertExactViewport, assertLongDataContract, assertOverflowContract, assertStickyAndPinnedAlignment } from '../assertions/geometry'
import { assertMinimumTargets, assertNamedControls } from '../assertions/accessibility'
import type { ResponsiveEvidenceRecord } from '../evidence/schema'

const PRODUCT_STATES: readonly ScenarioState[] = ['success', 'loading', 'fetching', 'empty', 'no-match', 'error-5xx', 'paginated']
const rows = STRESS_ROWS.map((row) => ({ ...row, type: 'PRODUCT', categoryName: 'E2E', brandName: 'Hound', quantity: 12, minQuantity: 2, useStock: true, hasVariants: false, useLotsAndExpirations: false, sellInPos: true, includeInOnlineCatalog: true, requiresPrescription: false, chargeProductTaxes: true, createdAt: row.updatedAt }))
const routes = (state: ScenarioState) => [scenarioRoute('/products', state, { query: undefined, json: state.startsWith('error') ? { message: 'Servicio no disponible (e2e)' } : rows }), { method: 'GET' as const, path: '/categories', json: [] }, { method: 'GET' as const, path: '/brands', json: [] }]

function record(viewport: ViewportCase, stateId: string, result: { assertionId: ResponsiveEvidenceRecord['assertionId']; status: ResponsiveEvidenceRecord['status']; measurements: Record<string, unknown>; failure?: ResponsiveEvidenceRecord['failure']; exclusion?: ResponsiveEvidenceRecord['exclusion'] }): ResponsiveEvidenceRecord {
  return { schemaVersion: 1, runId: process.env.RESPONSIVE_RUN_ID?.trim() || 'local-run', authority: result.assertionId === 'minimum-targets' || result.assertionId === 'semantics' ? 'browser-interaction' : 'browser-geometry', surfaceId: 'DT-01', archetype: 'DT', route: DT01_PRODUCTS.route, fixtureId: DT01_PRODUCTS.fixtureId, stateId, viewport, strategy: DT01_PRODUCTS.strategy, effectiveMode: 'table', containerOwner: DT01_PRODUCTS.containerOwner, assertionId: result.assertionId, riskIds: DT01_PRODUCTS.risks, status: result.status, measurements: result.measurements, ...(result.failure ? { failure: result.failure } : {}), ...(result.exclusion ? { exclusion: result.exclusion } : {}) }
}

async function openProducts(page: Parameters<typeof DT01_PRODUCTS.resolve>[0], viewport: ViewportCase) {
  await page.setViewportSize(viewport); await seedAuthSession(page)
  await page.addInitScript(() => window.localStorage.setItem('products-view-mode', 'table'))
  await page.goto(`${RESPONSIVE_ORIGIN}${DT01_PRODUCTS.route}`)
}


test.describe('DT-01 strict responsive conformance', () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) for (const state of PRODUCT_STATES) test.describe(`${viewport.key} ${state}`, () => {
    test.use({ declaredRoutes: { routes: routes(state) } })
    test('preserves the explicit table preference and emits browser evidence', async ({ page, strictNetwork, evidenceSession }) => {
      const owner = page.locator('#hound-dashboard-panel-main-panel')
      await openProducts(page, viewport)
        const resolved = state === 'error-5xx' ? undefined : await DT01_PRODUCTS.resolve(page)
      if (!resolved) { await owner.getByRole('heading', { name: 'Productos' }).waitFor(); await owner.getByTestId('table-error-state').waitFor() }
      const results = [await assertExactViewport(page, viewport), await assertDocumentNoHorizontalOverflow(page), await assertBoxesWithinOwner(owner, { surface: resolved?.anchor ?? owner }), ...(resolved ? [] : [{ assertionId: 'surface-state' as const, status: await owner.getByTestId('table-error-state').isVisible() ? 'pass' as const : 'fail' as const, measurements: { error: await owner.getByTestId('table-error-state').count() }, failure: undefined }])]
      for (const result of results) evidenceSession.attach(record(viewport, state, result))
      if (state === 'success') for (const exclusion of DT01_PRODUCTS.exclusions) evidenceSession.attach(record(viewport, exclusion.stateId ?? 'excluded', { assertionId: exclusion.assertionId, status: 'excluded', measurements: {}, exclusion: { reason: exclusion.reason, followUp: exclusion.followUp } }))
      expect(strictNetwork.violations()).toEqual([])
      expect(await page.evaluate(() => window.localStorage.getItem('products-view-mode'))).toBe('table')
      expect(results.map((result) => result.status)).toEqual(results.map(() => 'pass'))
    })
  })
  for (const viewport of RESPONSIVE_VIEWPORTS) test.describe(`${viewport.key} long dense`, () => {
    test.use({ declaredRoutes: { routes: routes('success') } })
    test('checks local scroll extremes, pinned action, long data, and action affordance', async ({ page, strictNetwork, evidenceSession }) => {
      await openProducts(page, viewport)
        const resolved = await DT01_PRODUCTS.resolve(page), region = resolved.anchor.getByTestId('table-view'), actions = await resolved.actions.rowMenu.count()
      const local = await region.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: getComputedStyle(element).overflowX }))
      const results: Array<{ assertionId: ResponsiveEvidenceRecord['assertionId']; status: 'pass' | 'fail'; measurements: Record<string, unknown>; failure?: ResponsiveEvidenceRecord['failure'] }> = [{ assertionId: 'overflow-contract', status: ['auto', 'scroll'].includes(local.overflowX) ? 'pass' : 'fail', measurements: local, ...(['auto', 'scroll'].includes(local.overflowX) ? {} : { failure: { taxonomy: 'uncontained-local-overflow', message: 'DT-01 table does not expose a local scroll owner' } }) }, await assertLongDataContract([{ label: 'stress SKU', locator: region.getByText(STRESS_TOKENS.sku, { exact: false }), critical: true }])]
      if (actions === 0) results.push({ assertionId: 'semantics', status: 'fail', measurements: { actions }, failure: { taxonomy: 'semantic-or-name', message: 'DT-01 product action has no accessible name' } })
      else results.push(await assertEssentialReachabilityAtExtremes(region, { identity: { locator: region.getByText(STRESS_TOKENS.longName), expectedExtreme: 'left' }, actions: { locator: resolved.actions.rowMenu.first(), expectedExtreme: 'right' } }), await assertStickyAndPinnedAlignment(region, { pinned: [{ side: 'right', header: region.locator('[data-pinned="right"] th').first(), body: resolved.actions.pinnedActions.first() }] }), await assertMinimumTargets([{ id: 'product-row-action', locator: resolved.actions.rowMenu.first() }]), await assertNamedControls([{ id: 'product-row-action', locator: resolved.actions.rowMenu.first(), role: 'button', name: 'Acciones del producto' }]))
      for (const result of results) evidenceSession.attach(record(viewport, 'success-long-dense', result))
      expect(strictNetwork.violations()).toEqual([])
      expect(results.map((result) => result.status)).toEqual(results.map(() => 'pass'))
    })
  })
})
