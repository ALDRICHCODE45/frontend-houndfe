import { test, expect, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { Locator, Page } from '@playwright/test'
import { seedAuthSession } from '../fixtures/auth'
import { scenarioRoute, type ScenarioState } from '../fixtures/scenarios'
import type { DeclaredRoute, StrictNetworkController } from '../fixtures/network'
import { STRESS_ROWS, STRESS_TOKENS } from '../fixtures/stress-data'
import { DT01_PRODUCTS } from '../targets/dt01-products'
import { ASSERTION_EVIDENCE_RULES, RESPONSIVE_VIEWPORTS, uniqueAnchor, type ViewportCase } from '../targets/types'
import { assertBoxesWithinOwner, assertDocumentNoHorizontalOverflow, assertEssentialReachabilityAtExtremes, assertExactViewport, assertLongDataContract, assertOverflowContract, assertStickyAndPinnedAlignment } from '../assertions/geometry'
import { assertCollectionSemantics, assertFocusNotObscured, assertKeyboardAction, assertKeyboardActivation, assertKeyboardSequence, assertMinimumTargets, assertNamedControls } from '../assertions/accessibility'
import { assertFetchKeepsContentUsable, assertSurfaceState, type StateContract } from '../assertions/states'
import type { ResponsiveEvidenceRecord } from '../evidence/schema'

const PRODUCT_STATES: readonly ScenarioState[] = ['success', 'loading', 'fetching', 'empty', 'no-match', 'error-5xx', 'paginated']
const rows = STRESS_ROWS.map((row) => ({ ...row, type: 'PRODUCT', categoryName: 'E2E', brandName: 'Hound', quantity: 12, minQuantity: 2, useStock: true, hasVariants: false, useLotsAndExpirations: false, sellInPos: true, includeInOnlineCatalog: true, requiresPrescription: false, chargeProductTaxes: true, createdAt: row.updatedAt }))
const baseRoutes = (state: ScenarioState): DeclaredRoute[] => [scenarioRoute('/products', state, { query: undefined, json: state.startsWith('error') ? { message: 'Servicio no disponible (e2e)' } : state === 'empty' ? [] : state === 'paginated' ? { data: rows, meta: { page: 1, limit: 10, total: rows.length, totalPages: 2 } } : rows }), { method: 'GET' as const, path: '/categories', json: [] }, { method: 'GET' as const, path: '/brands', json: [] }]
const noMatchRoutes: DeclaredRoute[] = [{ method: 'GET' as const, path: '/products', query: {}, status: 200, json: [] }, { method: 'GET' as const, path: '/products', query: { search: 'Producto', q: 'Producto' }, status: 200, json: rows }, { method: 'GET' as const, path: '/categories', json: [] }, { method: 'GET' as const, path: '/brands', json: [] }]
const routes = (state: ScenarioState): DeclaredRoute[] => (state === 'no-match' ? noMatchRoutes : baseRoutes(state))
const EXPECTED_REQUESTS: Record<ScenarioState, number> = { success: 3, loading: 3, fetching: 3, empty: 3, 'no-match': 4, 'error-4xx': 3, 'error-5xx': 4, paginated: 3 }

type EvidenceResult = Pick<ResponsiveEvidenceRecord, 'assertionId' | 'status' | 'measurements' | 'failure' | 'exclusion'>
type Mode = 'table' | 'card'
type EffectiveMode = 'table' | 'cards'

function record(viewport: ViewportCase, stateId: string, result: EvidenceResult, mode: EffectiveMode = 'table', scrollExtreme?: ResponsiveEvidenceRecord['scrollExtreme']): ResponsiveEvidenceRecord {
  const rule = ASSERTION_EVIDENCE_RULES[result.assertionId]
  const surface = mode === 'table' ? '[data-testid="table-view"]' : '[data-testid="product-cards-grid"]'
  return { schemaVersion: 1, runId: process.env.RESPONSIVE_RUN_ID?.trim() || 'local-run', authority: rule.authority, surfaceId: 'DT-01', archetype: 'DT', route: DT01_PRODUCTS.route, fixtureId: DT01_PRODUCTS.fixtureId, stateId, viewport, strategy: DT01_PRODUCTS.strategy, effectiveMode: mode, containerOwner: DT01_PRODUCTS.containerOwner, assertionId: result.assertionId, riskIds: rule.riskIds, regions: { owner: { locator: '#hound-dashboard-panel-main-panel' }, surface: { locator: surface }, related: [{ label: 'view toggle', locator: '[role="tablist"][aria-label="Seleccionar vista de productos"]' }] }, status: result.status, measurements: result.measurements, ...(scrollExtreme ? { scrollExtreme } : {}), ...(result.failure ? { failure: result.failure } : {}), ...(result.exclusion ? { exclusion: result.exclusion } : {}) }
}

async function openProducts(page: Parameters<typeof DT01_PRODUCTS.resolve>[0], viewport: ViewportCase, mode: Mode = 'table') {
  await page.setViewportSize(viewport); await seedAuthSession(page)
  await page.addInitScript((value) => {
    window.localStorage.setItem('products-view-mode', value)
    window.localStorage.setItem('table-preferences-pos-products', '{"columnVisibility":{}}')
  }, mode)
  await page.goto(`${RESPONSIVE_ORIGIN}${DT01_PRODUCTS.route}`)
}

const PREFERENCE_KEYS = ['products-view-mode', 'table-preferences-pos-products'] as const

const preferenceResult = async (page: Parameters<typeof openProducts>[0], mode: Mode): Promise<EvidenceResult> => {
  const stored = await page.evaluate(() => ({
    'products-view-mode': window.localStorage.getItem('products-view-mode'),
    'table-preferences-pos-products': window.localStorage.getItem('table-preferences-pos-products'),
  }))
  const expected = { 'products-view-mode': mode, 'table-preferences-pos-products': '{"columnVisibility":{}}' }
  const preserved = PREFERENCE_KEYS.every((key) => stored[key] === expected[key])
  return { assertionId: 'preference-compatibility', status: preserved ? 'pass' : 'fail', measurements: { keys: [...PREFERENCE_KEYS], expected, stored }, ...(preserved ? {} : { failure: { taxonomy: 'preference-compatibility', message: 'DT-01 does not preserve both declared table preferences' } }) }
}

/** Substantive per-state contract: real feedback, prohibited content, usable controls, in-flight request evidence, and recovery/reset paths per surface state. */
const stateContract = (owner: Locator, state: ScenarioState, strictNetwork: StrictNetworkController): StateContract => {
  const successRow = owner.getByText(STRESS_TOKENS.longName)
  const emptyFeedback = owner.getByText('No se encontraron productos')
  const errorState = owner.getByTestId('table-error-state')
  switch (state) {
    case 'success':
      return { state: 'success', feedback: owner.getByTestId('table-view'), prohibited: [errorState], content: { locator: successRow, text: STRESS_TOKENS.longName } }
    case 'loading': case 'fetching':
      return { state, feedback: owner.getByTestId('table-view'), prohibited: [errorState, successRow], usableControls: [{ id: 'products-type-filter', locator: owner.getByRole('combobox', { name: 'Filtrar por tipo' }) }], inFlightRequests: { observed: () => strictNetwork.requests().filter((request) => request.path === '/products').length, minimum: 1 } }
    case 'empty':
      return { state: 'empty', feedback: emptyFeedback, feedbackText: 'No se encontraron productos', prohibited: [successRow], usableControls: [{ id: 'products-type-filter', locator: owner.getByRole('combobox', { name: 'Filtrar por tipo' }) }] }
    case 'no-match': {
      const search = owner.getByPlaceholder('Buscar productos...')
      return { state: 'no-match', feedback: emptyFeedback, feedbackText: 'No se encontraron productos', prohibited: [successRow], recovery: { locator: search, apply: async () => { await search.fill('Producto'); await successRow.waitFor({ timeout: 5_000 }) }, verify: async () => successRow.isVisible() }, reset: { locator: search, apply: async () => { await search.fill(''); await emptyFeedback.waitFor({ timeout: 5_000 }) }, verify: async () => emptyFeedback.isVisible() } }
    }
    case 'error-4xx': case 'error-5xx':
      return { state: 'error', feedback: errorState, feedbackContains: 'Servicio no disponible (e2e)', prohibited: [successRow], recovery: { locator: owner.getByTestId('table-error-retry'), name: 'Reintentar', verify: async () => { try { await errorState.waitFor({ state: 'visible', timeout: 5_000 }); return true } catch { return false } } } }
    case 'paginated':
      return { state: 'paginated', feedback: owner.getByText('Mostrando 1-10 de 12'), feedbackText: 'Mostrando 1-10 de 12', prohibited: [errorState], usableControls: [{ id: 'products-page-size', locator: owner.getByRole('button', { name: '10 por página' }) }], content: { locator: successRow, text: STRESS_TOKENS.longName } }
  }
}

async function cellForHeader(region: Parameters<typeof assertEssentialReachabilityAtExtremes>[0], header: string) {
  const headers = await region.locator('thead th').allTextContents()
  const index = headers.findIndex((text) => text.trim() === header)
  if (index < 0) throw new Error(`DT-01 table is missing its ${header} header`)
  return region.locator('tbody tr').first().locator('td').nth(index)
}

/** Resolves a toolbar control only when it renders exactly once and becomes visible; otherwise the caller records an honest fail. */
const renderedControl = async (control: Locator): Promise<Locator | null> => {
  try { await control.waitFor({ state: 'visible', timeout: 5_000 }) } catch { return null }
  return (await control.count()) === 1 ? control : null
}
const unrenderedControl = (id: string): EvidenceResult => ({ assertionId: 'semantics', status: 'fail', measurements: { rendered: false }, failure: { taxonomy: 'semantic-or-name', message: `DT-01 ${id} is not rendered exactly once and visible` } })

async function exerciseControl(control: Locator | null, id: string, stickyRegions: readonly Locator[], verify: (page: Page) => Promise<boolean>): Promise<EvidenceResult[]> {
  if (!control) return [unrenderedControl(id)]
  await control.focus()
  const focus = await assertFocusNotObscured(control, stickyRegions)
  const target = await assertMinimumTargets([{ id, locator: control }])
  const activated = await assertKeyboardActivation(control, { key: 'Enter', verify })
  await control.page().keyboard.press('Escape')
  return [target, focus, activated]
}

test.describe('DT-01 strict responsive conformance', () => {
  // Blocker 5: every success/error/timeout/early path audits strict-network violations once at describe level.
  test.afterEach(async ({ strictNetwork }) => {
    expect(strictNetwork.violations(), 'strict network must end every DT-01 path without violations').toEqual([])
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) for (const state of PRODUCT_STATES) test.describe(`${viewport.key} ${state}`, () => {
    test.use({ declaredRoutes: { routes: routes(state) } })
    test('C2b state: records substantive state feedback, ownership, and preference compatibility', async ({ page, strictNetwork, evidenceSession }) => {
      const owner = page.locator('#hound-dashboard-panel-main-panel')
      await openProducts(page, viewport)
      const resolved = state === 'error-5xx' ? undefined : await DT01_PRODUCTS.resolve(page)
      if (!resolved) { await owner.getByRole('heading', { name: 'Productos' }).waitFor(); await owner.getByTestId('table-error-state').waitFor() }
      const surface = resolved ? owner.getByTestId('table-view') : owner.getByTestId('table-error-state')
      const results = [await assertExactViewport(page, viewport), await assertDocumentNoHorizontalOverflow(page), await assertBoxesWithinOwner(owner, { surface }), await assertSurfaceState(stateContract(owner, state, strictNetwork)), await preferenceResult(page, 'table')]
      if (state === 'error-5xx') results.push(await assertMinimumTargets([{ id: 'table-error-retry', locator: owner.getByTestId('table-error-retry') }]))
      for (const result of results) evidenceSession.attach(record(viewport, state, result))
      if (state === 'success') for (const exclusion of DT01_PRODUCTS.exclusions.filter((entry) => entry.stateId !== 'cards')) evidenceSession.attach(record(viewport, exclusion.stateId ?? 'excluded', { assertionId: exclusion.assertionId, status: 'excluded', measurements: {}, exclusion: { reason: exclusion.reason, followUp: exclusion.followUp } }))
      expect(strictNetwork.violations()).toEqual([])
      expect(strictNetwork.requests().length).toBe(EXPECTED_REQUESTS[state])
      expect(results.map((result) => result.status)).toEqual(results.map(() => 'pass'))
    })
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) test.describe(`${viewport.key} table and cards`, () => {
    test.use({ declaredRoutes: { routes: baseRoutes('success') } })
    test('C2b card: exercises no-scroll ownership, collection equivalence, and preference compatibility', async ({ page, strictNetwork, evidenceSession }) => {
      await openProducts(page, viewport, 'card')
      const resolved = await DT01_PRODUCTS.resolve(page)
      const cards = resolved.anchor.getByTestId('product-cards-grid')
      const article = cards.locator('article').first()
      const action = await uniqueAnchor(resolved.actions.rowMenu, 'DT-01 card product action')
      const focus = await assertFocusNotObscured(action, [])
      const keyboard = await assertKeyboardAction(action, { key: 'Enter', verify: async (current) => current.getByRole('menu').isVisible() })
      await page.keyboard.press('Escape')
      const activation = await assertKeyboardActivation(action, { key: 'Enter', verify: async (current) => current.getByRole('menu').isVisible() })
      const interactions = activation.assertionId === 'focus' ? [keyboard, activation] : [activation]
      const collection = await assertCollectionSemantics({ list: cards, items: [{ identity: STRESS_TOKENS.longName, item: article, action: { locator: action, name: 'Acciones del producto' }, fields: [{ value: STRESS_TOKENS.sku }, { label: 'Precio', value: '$1,234,567.89' }, { label: 'Stock', value: '12 unidades' }, { value: 'Activo' }] }] })
      const results = [await assertOverflowContract({ policy: 'no-horizontal-scroll', owner: resolved.anchor, recordRegions: [cards] }), await assertBoxesWithinOwner(resolved.anchor, { cards }), await assertLongDataContract([{ label: 'card stress name', locator: article.getByText(STRESS_TOKENS.longName), critical: true }, { label: 'card stress SKU', locator: article.getByText(STRESS_TOKENS.sku, { exact: false }), critical: true }]), collection, await assertMinimumTargets([{ id: 'card-product-action', locator: action }]), await assertNamedControls([{ id: 'card-product-action', locator: action, role: 'button', name: 'Acciones del producto' }]), focus, ...interactions, await assertSurfaceState({ state: 'success', feedback: cards, content: { locator: article.getByText(STRESS_TOKENS.longName), text: STRESS_TOKENS.longName }, prohibited: [resolved.anchor.getByTestId('cards-error-state'), resolved.anchor.getByTestId('table-error-state')] }), await preferenceResult(page, 'card')]
      for (const [index, result] of results.entries()) evidenceSession.attach(record(viewport, `success-cards-result-${index}`, result, 'cards'))
      for (const exclusion of DT01_PRODUCTS.exclusions.filter((entry) => entry.stateId === 'cards')) evidenceSession.attach(record(viewport, 'success-cards-excluded', { assertionId: exclusion.assertionId, status: 'excluded', measurements: {}, exclusion: { reason: exclusion.reason, followUp: exclusion.followUp } }, 'cards'))
      expect(resolved.mode).toBe('cards')
      expect(strictNetwork.violations()).toEqual([])
      expect(results.map((result) => result.status)).toEqual(results.map(() => 'pass'))
    })
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) test.describe(`${viewport.key} fetching cards`, () => {
    test.use({ declaredRoutes: { routes: [{ method: 'GET' as const, path: '/products', query: {}, status: 200, json: rows }, { method: 'GET' as const, path: '/products', query: { search: 'Producto', q: 'Producto' }, status: 200, json: rows, deferred: true }, { method: 'GET' as const, path: '/categories', json: [] }, { method: 'GET' as const, path: '/brands', json: [] }] } })
    test('C2b state: keeps card content usable while the refetch response is held in flight', async ({ page, strictNetwork, evidenceSession }) => {
      await openProducts(page, viewport, 'card')
      const resolved = await DT01_PRODUCTS.resolve(page)
      const cards = resolved.anchor.getByTestId('product-cards-grid')
      await cards.waitFor()
      const search = resolved.anchor.getByPlaceholder('Buscar productos...')
      await search.fill('Producto')
      await expect.poll(() => strictNetwork.requests().filter((request) => request.query.search === 'Producto').length, { timeout: 5_000 }).toBe(1)
      const fetching = await assertFetchKeepsContentUsable({ content: cards, contentProbe: STRESS_TOKENS.longName, inFlightControls: [{ id: 'products-type-filter', locator: resolved.actions.typeFilter }], fetchRequests: () => strictNetwork.requests().filter((request) => request.query.search === 'Producto').length })
      evidenceSession.attach(record(viewport, 'fetching-cards', fetching, 'cards'))
      expect(resolved.mode).toBe('cards')
      expect(strictNetwork.violations()).toEqual([])
      expect(fetching.status).toBe('pass')
    })
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) test.describe(`${viewport.key} long dense`, () => {
    test.use({ declaredRoutes: { routes: baseRoutes('success') } })
    test('checks one local scroll owner, both extremes, pinned action, and actual action affordance', async ({ page, strictNetwork, evidenceSession }) => {
      await openProducts(page, viewport)
      const resolved = await DT01_PRODUCTS.resolve(page)
      const region = resolved.anchor.getByTestId('table-view')
      const action = await uniqueAnchor(resolved.actions.rowMenu, 'DT-01 table product action')
      const overflow = await assertOverflowContract({ policy: 'local-scroll', owner: resolved.anchor, scrollRegion: region, cue: resolved.anchor.getByText(/desplaz|scroll/i) })
          const name = await cellForHeader(region, 'Nombre')
          const sku = await cellForHeader(region, 'SKU')
          const price = await cellForHeader(region, 'Precio')
          const stock = await cellForHeader(region, 'Stock')
          const status = await cellForHeader(region, 'Estado')
          const actionCell = action.locator('xpath=ancestor::td')
          const extremes = await assertEssentialReachabilityAtExtremes(region, { identity: { locator: name, expectedExtreme: 'left' }, price: { locator: price, expectedExtreme: 'right' }, stock: { locator: stock, expectedExtreme: 'right' }, status: { locator: status, expectedExtreme: 'right' }, actions: { locator: action, expectedExtreme: 'both' } })
          const stickyHeader = region.locator('thead')
          const sticky = await assertStickyAndPinnedAlignment(region, { pinned: [{ side: 'left', header: region.locator('thead tr th').last(), body: actionCell }, { side: 'right', header: region.locator('thead tr th').last(), body: actionCell }], stickyHeader })
          const focus = await assertFocusNotObscured(action, [stickyHeader])
          const keyboard = await assertKeyboardAction(action, { key: 'Enter', verify: async (current) => current.getByRole('menu').isVisible() })
          await page.keyboard.press('Escape')
          const activation = await assertKeyboardActivation(action, { key: 'Enter', verify: async (current) => current.getByRole('menu').isVisible() })
          const interactions = activation.assertionId === 'focus' ? [keyboard, activation] : [activation]
          const tableTab = resolved.actions.viewToggle.getByRole('tab', { name: 'Tabla' })
          const cardsTab = resolved.actions.viewToggle.getByRole('tab', { name: 'Tarjetas' })
          const viewToggleControl = await exerciseControl(await renderedControl(cardsTab), 'products-view-toggle', [stickyHeader], async (current) => current.getByTestId('product-cards-grid').isVisible())
          await tableTab.press('Enter')
          await region.waitFor()
          const controls = [
            ...viewToggleControl,
            ...await exerciseControl(await renderedControl(resolved.actions.search), 'products-search', [stickyHeader], async (current) => current.getByPlaceholder('Buscar productos...').inputValue().then((value) => value === '')),
            ...await exerciseControl(await renderedControl(resolved.actions.typeFilter), 'products-type-filter', [stickyHeader], async (current) => current.getByRole('listbox').isVisible()),
            ...await exerciseControl(await renderedControl(resolved.actions.pageSize), 'products-page-size', [stickyHeader], async (current) => current.getByRole('menu').isVisible()),
          ]
          await page.keyboard.press('Escape')
          const focusOrder = await assertKeyboardSequence(page, tableTab, [{ id: 'cards-tab', role: 'tab', name: 'Tarjetas' }])
          const results = [overflow, await assertLongDataContract([{ label: 'stress name', locator: name, critical: true }, { label: 'stress SKU', locator: sku, critical: true }, { label: 'price cell', locator: price, critical: true }, { label: 'stock cell', locator: stock, critical: true }, { label: 'status cell', locator: status, critical: true }]), await assertMinimumTargets([{ id: 'product-row-action', locator: action }]), await assertNamedControls([{ id: 'product-row-action', locator: action, role: 'button', name: 'Acciones del producto' }]), focus, ...interactions, focusOrder]
          for (const [index, result] of results.entries()) evidenceSession.attach(record(viewport, `success-long-dense-result-${index}`, result))
          for (const [index, result] of controls.entries()) evidenceSession.attach(record(viewport, `success-long-dense-control-${index}`, result))
          evidenceSession.attach(record(viewport, 'success-long-dense', extremes, 'table', 'left'))
          evidenceSession.attach(record(viewport, 'success-long-dense', extremes, 'table', 'right'))
          evidenceSession.attach(record(viewport, 'success-long-dense', sticky, 'table', 'left'))
          evidenceSession.attach(record(viewport, 'success-long-dense', sticky, 'table', 'right'))
      expect(resolved.mode).toBe('table')
      expect(strictNetwork.violations()).toEqual([])
      expect([...results, ...controls, extremes, sticky].map((result) => result.status)).toEqual([...results, ...controls, extremes, sticky].map(() => 'pass'))
    })
  })
})
