/**
 * T4 isolated offline browser acceptance — delivery route assignment safety.
 *
 * Two real routed flows at `/pos/rutas-de-entrega` (+ `/:id`) against the
 * existing Vite-served app with `VITE_API_BASE_URL=/__e2e-api`:
 *
 *   1. Create selector (S3/S2): rich, distinguishable rows; authoritative
 *      OCCUPIED/INELIGIBLE rows disabled with a human reason; selection + its
 *      resolved label retained across server search and server pagination; and
 *      the flat 409 create conflict preserved, marked, refreshed and recovered
 *      WITHOUT losing the user's selection.
 *   2. Draft-to-draft transfer (S2/S4): per-stop "Mover" opens a radiogroup,
 *      the mutation only fires after an EXPLICIT confirmation step, and both
 *      the origin and destination detail slots refresh after the move.
 *
 * Every `/__e2e-api` request is mocked by the shared `strictNetwork` fixture and
 * unmatched same-origin API + external requests are aborted as violations. No
 * real auth, backend, production or `.env` value is ever touched — the session
 * is seeded into localStorage with the synthetic auth-storage contract.
 */
import { assertKeyboardAction } from '../assertions/accessibility'
import { assertDocumentNoHorizontalOverflow } from '../assertions/geometry'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute, StrictNetworkController } from '../fixtures/network'
import { expect, RESPONSIVE_ORIGIN, test } from '../fixtures/test'
import {
  ASSIGNABLE_DRIVERS,
  CREATE_CONFLICT_409,
  CREATED_ROUTE,
  DELIVERY_ROUTE_BROWSER_VIEWPORTS,
  DELIVERY_ROUTE_MANAGER_PERMISSIONS,
  ELIGIBLE_ANA_ROW,
  ELIGIBLE_LOOK_ALIKE_ROW,
  ELIGIBLE_MISSING_ADDRESS_ROW,
  ELIGIBLE_OCCUPIED_ROW,
  ELIGIBLE_PAGE_TWO_ROW,
  ELIGIBLE_SALES_PAGE_ONE,
  ELIGIBLE_SALES_PAGE_TWO,
  ELIGIBLE_SALES_SEARCH,
  ELIGIBLE_SEARCH_ROW,
  ROUTE_DESTINATION,
  ROUTE_DESTINATION_AFTER_MOVE,
  ROUTE_LIST_EMPTY,
  ROUTE_ORIGIN_WITH_STOP,
  ROUTE_ORIGIN_WITHOUT_STOP,
  ROUTE_SPARE,
  SYNTHETIC_ROUTE_IDS,
  SYNTHETIC_SALE_IDS,
  SYNTHETIC_STOP_IDS,
  TRANSFER_RESPONSE,
} from '../fixtures/delivery-route-assignment-safety'

const LIST_ROUTE = '/pos/rutas-de-entrega'
const ORIGIN_DETAIL_ROUTE = `${LIST_ROUTE}/${SYNTHETIC_ROUTE_IDS.origin}`
const DESTINATION_DETAIL_ROUTE = `${LIST_ROUTE}/${SYNTHETIC_ROUTE_IDS.destination}`
const ELIGIBLE_SALES_PATH = '/delivery-routes/eligible-sales'
const TRANSFER_PATH = `/delivery-routes/${SYNTHETIC_ROUTE_IDS.origin}/stops/${SYNTHETIC_STOP_IDS.originStop}/transfer`

const rowCheckbox = (page: import('@playwright/test').Page, saleId: string) =>
  page.getByTestId(`eligible-sales-picker-row-checkbox-${saleId}`)

const postsTo = (network: StrictNetworkController, path: string) =>
  network.requests().filter((request) => request.method === 'POST' && request.path === path)

const getCount = (network: StrictNetworkController, path: string) =>
  network.requests().filter((request) => request.method === 'GET' && request.path === path).length

// ─── Shared create-selector routes ────────────────────────────────────────────
const SELECTOR_ROUTES: readonly DeclaredRoute[] = [
  { method: 'GET', path: '/delivery-routes', json: ROUTE_LIST_EMPTY, count: 5 },
  { method: 'GET', path: '/users/assignable-drivers', json: ASSIGNABLE_DRIVERS, count: 3 },
  {
    method: 'GET',
    path: ELIGIBLE_SALES_PATH,
    query: { page: '1', limit: '20' },
    json: ELIGIBLE_SALES_PAGE_ONE,
    count: 5,
  },
  {
    method: 'GET',
    path: ELIGIBLE_SALES_PATH,
    query: { page: '2', limit: '20' },
    json: ELIGIBLE_SALES_PAGE_TWO,
    count: 3,
  },
  {
    method: 'GET',
    path: ELIGIBLE_SALES_PATH,
    query: { page: '1', limit: '20', q: 'zzz' },
    json: ELIGIBLE_SALES_SEARCH,
    count: 3,
  },
]

async function openCreateSelector(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${RESPONSIVE_ORIGIN}${LIST_ROUTE}`)
  await page.getByRole('button', { name: 'Nueva ruta' }).click()
  await expect(page.getByTestId('eligible-sales-picker')).toBeVisible()
  await expect(page.getByTestId(`eligible-sales-picker-row-${SYNTHETIC_SALE_IDS.ana}`)).toBeVisible()
}

test.describe('delivery-route create selector (S3/S2)', () => {
  test.use({ declaredRoutes: { routes: SELECTOR_ROUTES } })

  test.afterEach(async ({ strictNetwork }) => {
    expect(strictNetwork.violations(), 'strict network must stay clean').toEqual([])
  })

  for (const [label, viewport] of Object.entries(DELIVERY_ROUTE_BROWSER_VIEWPORTS)) {
    test(`rich rows, authoritative occupancy and selection retention [${label}]`, async ({
      page,
      strictNetwork,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await seedAuthSession(page, { permissions: DELIVERY_ROUTE_MANAGER_PERMISSIONS })
      await openCreateSelector(page)

      // The create picker uses the authoritative eligible-sales endpoint (never
      // the legacy confirmed-sales append path) — pin the request contract.
      expect(
        strictNetwork.requests().some((request) => request.path === ELIGIBLE_SALES_PATH),
      ).toBe(true)
      expect(strictNetwork.requests().some((request) => request.path === '/sales')).toBe(false)

      // ── Rich, distinguishable rows (two look-alike sales) ──────────────────
      const anaRow = page.getByTestId(`eligible-sales-picker-row-${SYNTHETIC_SALE_IDS.ana}`)
      const lookAlikeRow = page.getByTestId(
        `eligible-sales-picker-row-${SYNTHETIC_SALE_IDS.lookAlike}`,
      )
      await expect(anaRow).toContainText(ELIGIBLE_ANA_ROW.customer.name)
      await expect(lookAlikeRow).toContainText(ELIGIBLE_LOOK_ALIKE_ROW.customer.name)
      await expect(page.getByTestId(`eligible-sales-picker-row-address-${SYNTHETIC_SALE_IDS.ana}`)).toContainText(
        'Av. Reforma #100',
      )
      await expect(
        page.getByTestId(`eligible-sales-picker-row-address-${SYNTHETIC_SALE_IDS.lookAlike}`),
      ).toContainText('Calle 5 #200')
      await expect(
        page.getByTestId(`eligible-sales-picker-row-secondary-${SYNTHETIC_SALE_IDS.ana}`),
      ).toContainText('Croqueta 15 kg')
      await expect(
        page.getByTestId(`eligible-sales-picker-row-secondary-${SYNTHETIC_SALE_IDS.lookAlike}`),
      ).toContainText('Alimento seco 15 kg')

      const anaCheckbox = rowCheckbox(page, SYNTHETIC_SALE_IDS.ana)
      await expect(anaCheckbox).toHaveAccessibleName(/A-202610-000003/)
      await expect(anaCheckbox).toBeEnabled()

      // ── Authoritative occupancy: disabled rows with a humano reason ────────
      const occupiedRow = page.getByTestId(
        `eligible-sales-picker-row-${SYNTHETIC_SALE_IDS.occupied}`,
      )
      await expect(rowCheckbox(page, SYNTHETIC_SALE_IDS.occupied)).toBeDisabled()
      await expect(occupiedRow).toContainText('Reservada en un borrador de ruta')
      const missingAddressRow = page.getByTestId(
        `eligible-sales-picker-row-${SYNTHETIC_SALE_IDS.missingAddress}`,
      )
      await expect(rowCheckbox(page, SYNTHETIC_SALE_IDS.missingAddress)).toBeDisabled()
      await expect(missingAddressRow).toContainText('Sin dirección de envío')

      // ── Select from page 1 ─────────────────────────────────────────────────
      await anaCheckbox.click()
      const chip = page.getByTestId(`eligible-sales-picker-chip-label-${SYNTHETIC_SALE_IDS.ana}`)
      await expect(chip).toBeVisible()
      await expect(chip).toContainText('A-202610-000003')
      await expect(
        page.getByRole('button', { name: 'Quitar A-202610-000003' }),
      ).toBeVisible()

      // ── Selection + label retained across SERVER SEARCH ────────────────────
      const search = page.getByRole('textbox', { name: 'Buscar ventas' })
      await search.focus()
      await page.keyboard.type('zzz')
      const searchRow = page.getByTestId(
        `eligible-sales-picker-row-${SYNTHETIC_SALE_IDS.searchOnly}`,
      )
      await expect(searchRow).toContainText(ELIGIBLE_SEARCH_ROW.customer.name)
      await expect(anaRow).toHaveCount(0)
      await expect(chip).toContainText('A-202610-000003')

      // ── Retained after clearing the search AND after paginating ────────────
      await search.fill('')
      await expect(anaRow).toBeVisible()
      await expect(chip).toContainText('A-202610-000003')

      const nextPage = page.getByRole('button', { name: 'Página siguiente' })
      await expect(nextPage).toBeEnabled()
      await nextPage.click()
      await expect(
        page.getByTestId(`eligible-sales-picker-row-${SYNTHETIC_SALE_IDS.pageTwo}`),
      ).toContainText(ELIGIBLE_PAGE_TWO_ROW.customer.name)
      await expect(chip).toContainText('A-202610-000003')

      // ── No horizontal overflow at this width ───────────────────────────────
      const overflow = await assertDocumentNoHorizontalOverflow(page)
      expect(overflow.status, JSON.stringify(overflow)).toBe('pass')

      await testInfo.attach(`create-selector-${label}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    })
  }
})

// ─── Create 409 recovery ──────────────────────────────────────────────────────
const CREATE_CONFLICT_ROUTES: readonly DeclaredRoute[] = [
  { method: 'GET', path: '/delivery-routes', json: ROUTE_LIST_EMPTY, count: 6 },
  { method: 'GET', path: '/users/assignable-drivers', json: ASSIGNABLE_DRIVERS, count: 3 },
  {
    method: 'GET',
    path: ELIGIBLE_SALES_PATH,
    query: { page: '1', limit: '20' },
    json: ELIGIBLE_SALES_PAGE_ONE,
    count: 8,
  },
  {
    method: 'POST',
    path: '/delivery-routes',
    responses: [{ status: 409, json: CREATE_CONFLICT_409 }, { json: CREATED_ROUTE }],
  },
]

test.describe('delivery-route create 409 recovery (S1/S2)', () => {
  test.use({ declaredRoutes: { routes: CREATE_CONFLICT_ROUTES } })

  test.afterEach(async ({ strictNetwork }) => {
    expect(strictNetwork.violations(), 'strict network must stay clean').toEqual([])
  })

  test('a flat 409 conflict preserves the selection and recovers after refreshing availability', async ({
    page,
    strictNetwork,
  }, testInfo) => {
    await page.setViewportSize(DELIVERY_ROUTE_BROWSER_VIEWPORTS.desktop)
    await seedAuthSession(page, { permissions: DELIVERY_ROUTE_MANAGER_PERMISSIONS })
    await openCreateSelector(page)

    // Select the conflicting sale + a driver so the create payload is valid.
    await rowCheckbox(page, SYNTHETIC_SALE_IDS.ana).click()
    const chip = page.getByTestId(`eligible-sales-picker-chip-label-${SYNTHETIC_SALE_IDS.ana}`)
    await expect(chip).toContainText('A-202610-000003')

    await page.getByTestId('driver-picker-trigger').click()
    await page.getByRole('option', { name: 'Repartidor Uno' }).click()
    await expect(page.getByTestId('driver-picker-chip-label')).toHaveText('Repartidor Uno')

    // First submit → flat 409.
    await page.getByRole('button', { name: 'Crear ruta', exact: true }).click()
    const conflict = page.getByTestId('eligible-sales-picker-conflict')
    await expect(conflict).toBeVisible()
    await expect(conflict).toContainText('Una o más ventas ya están en otra ruta')
    await expect(
      page.getByTestId(`eligible-sales-picker-conflict-item-${SYNTHETIC_SALE_IDS.ana}`),
    ).toContainText('A-202610-000003')

    // The selection is NEVER silently removed.
    await expect(chip).toContainText('A-202610-000003')
    expect(postsTo(strictNetwork, '/delivery-routes')).toHaveLength(1)
    expect(postsTo(strictNetwork, '/delivery-routes')[0]?.body).toEqual({
      saleIds: [SYNTHETIC_SALE_IDS.ana],
      driverUserId: ASSIGNABLE_DRIVERS[0]?.id,
    })

    await testInfo.attach('create-conflict-409', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    // Actionable inline refresh clears the conflict once availability is proven.
    const refresh = page.getByTestId('eligible-sales-picker-conflict-refresh')
    const refreshed = await assertKeyboardAction(refresh, {
      key: 'Enter',
      verify: async () => !(await conflict.isVisible()),
    })
    expect(refreshed.status, JSON.stringify(refreshed)).toBe('pass')
    await expect(conflict).toHaveCount(0)

    // Recovery: the preserved selection can be submitted again.
    await page.getByRole('button', { name: 'Crear ruta', exact: true }).click()
    await expect(page.getByTestId('eligible-sales-picker')).toHaveCount(0)
    await expect(page.getByText('Ruta creada', { exact: true })).toBeVisible()

    const posts = postsTo(strictNetwork, '/delivery-routes')
    expect(posts).toHaveLength(2)
    expect(posts[1]?.body).toEqual({
      saleIds: [SYNTHETIC_SALE_IDS.ana],
      driverUserId: ASSIGNABLE_DRIVERS[0]?.id,
    })

    const overflow = await assertDocumentNoHorizontalOverflow(page)
    expect(overflow.status, JSON.stringify(overflow)).toBe('pass')
  })
})

// ─── Draft-to-draft transfer ──────────────────────────────────────────────────
/** The DRAFT detail view also mounts the legacy append picker (`GET /sales`). */
const CONFIRMED_SALES_QUERY = {
  page: '1',
  limit: '20',
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
  deliveryStatus: 'PENDING,SHIPPED',
} as const
const EMPTY_CONFIRMED_SALES = {
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
} as const

const TRANSFER_ROUTES: readonly DeclaredRoute[] = [
  {
    method: 'GET',
    path: '/sales',
    query: CONFIRMED_SALES_QUERY,
    json: EMPTY_CONFIRMED_SALES,
    count: 6,
  },
  {
    method: 'GET',
    path: `/delivery-routes/${SYNTHETIC_ROUTE_IDS.origin}`,
    json: ROUTE_ORIGIN_WITH_STOP,
  },
  {
    method: 'GET',
    path: '/delivery-routes',
    query: { status: 'DRAFT' },
    json: [ROUTE_ORIGIN_WITH_STOP, ROUTE_DESTINATION, ROUTE_SPARE],
    count: 3,
  },
  { method: 'POST', path: TRANSFER_PATH, json: TRANSFER_RESPONSE, count: 1 },
  {
    method: 'GET',
    path: `/delivery-routes/${SYNTHETIC_ROUTE_IDS.destination}`,
    json: ROUTE_DESTINATION_AFTER_MOVE,
  },
]

test.describe('delivery-route draft transfer (S2/S4)', () => {
  test.use({
    declaredRoutes: async ({ page }, use) => {
      // Model server state per test, not by how often the client refetches.
      let transferred = false
      const routes = TRANSFER_ROUTES.map((route): DeclaredRoute => {
        if (route.method === 'POST' && route.path === TRANSFER_PATH) {
          return {
            ...route,
            body: { destinationRouteId: SYNTHETIC_ROUTE_IDS.destination },
            get json() {
              transferred = true
              return TRANSFER_RESPONSE
            },
          }
        }
        if (route.method === 'GET' && route.path === `/delivery-routes/${SYNTHETIC_ROUTE_IDS.origin}`) {
          return {
            ...route,
            get json() {
              return transferred ? ROUTE_ORIGIN_WITHOUT_STOP : ROUTE_ORIGIN_WITH_STOP
            },
          }
        }
        return route
      })
      // Keep the fixture tied to the same page as strictNetwork.
      void page
      await use({ routes })
    },
  })

  test.afterEach(async ({ strictNetwork }) => {
    expect(strictNetwork.violations(), 'strict network must stay clean').toEqual([])
  })

  for (const [label, viewport] of Object.entries(DELIVERY_ROUTE_BROWSER_VIEWPORTS)) {
    test(`explicit confirmation with keyboard radiogroup, then origin/destination refresh [${label}]`, async ({
      page,
      strictNetwork,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await seedAuthSession(page, { permissions: DELIVERY_ROUTE_MANAGER_PERMISSIONS })
      await page.goto(`${RESPONSIVE_ORIGIN}${ORIGIN_DETAIL_ROUTE}`)

      const originStop = page.getByTestId(`detail-stop-${SYNTHETIC_STOP_IDS.originStop}`)
      await expect(originStop).toBeVisible()
      await expect(originStop).toContainText('A-202610-000003')

      // Open the dialog by keyboard.
      const moveButton = page.getByRole('button', {
        name: 'Mover A-202610-000003 a otra ruta',
      })
      const opened = await assertKeyboardAction(moveButton, {
        key: 'Enter',
        verify: async () => page.getByTestId('transfer-step-select').isVisible(),
      })
      expect(opened.status, JSON.stringify(opened)).toBe('pass')

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(page.getByTestId('transfer-step-select')).toBeVisible()

      // Origin route is excluded; the two other DRAFTs are the only options.
      await expect(dialog.getByRole('radio')).toHaveCount(2)
      const radioDestination = dialog.getByRole('radio', { name: /Repartidor Dos/ })
      const radioSpare = dialog.getByRole('radio', { name: /Repartidor Tres/ })
      await expect(radioDestination).toBeVisible()
      await expect(radioSpare).toBeVisible()

      // Roving radiogroup keyboard navigation.
      await radioDestination.focus()
      await page.keyboard.press('ArrowDown')
      await expect(radioSpare).toBeFocused()
      await expect(radioSpare).toHaveAttribute('aria-checked', 'true')
      await page.keyboard.press('ArrowUp')
      await expect(radioDestination).toBeFocused()
      await expect(radioDestination).toHaveAttribute('aria-checked', 'true')

      // Explicit confirmation step — no mutation fired on selection alone.
      const continueButton = dialog.getByRole('button', { name: 'Continuar' })
      const advanced = await assertKeyboardAction(continueButton, {
        key: 'Enter',
        verify: async () => page.getByTestId('transfer-step-confirm').isVisible(),
      })
      expect(advanced.status, JSON.stringify(advanced)).toBe('pass')
      const summary = page.getByTestId('transfer-summary')
      await expect(summary).toContainText('A-202610-000003')
      await expect(summary).toContainText('Repartidor Dos')
      expect(postsTo(strictNetwork, TRANSFER_PATH)).toHaveLength(0)

      await testInfo.attach(`transfer-confirm-${label}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      // Confirm by keyboard → the mutation fires exactly once.
      const originReadsBeforeTransfer = getCount(strictNetwork, `/delivery-routes/${SYNTHETIC_ROUTE_IDS.origin}`)
      const confirmButton = dialog.getByRole('button', { name: 'Sí, mover' })
      const moved = await assertKeyboardAction(confirmButton, {
        key: 'Enter',
        verify: async () => !(await dialog.isVisible()),
      })
      expect(moved.status, JSON.stringify(moved)).toBe('pass')

      const posts = postsTo(strictNetwork, TRANSFER_PATH)
      expect(posts).toHaveLength(1)
      expect(posts[0]?.body).toEqual({
        destinationRouteId: SYNTHETIC_ROUTE_IDS.destination,
      })

      // Origin slots refresh: the moved stop disappears from route A.
      await expect(originStop).toHaveCount(0)
      await expect.poll(() => getCount(strictNetwork, `/delivery-routes/${SYNTHETIC_ROUTE_IDS.origin}`)).toBeGreaterThan(originReadsBeforeTransfer)

      // Destination slots refresh: the stop is present on route B.
      await page.goto(`${RESPONSIVE_ORIGIN}${DESTINATION_DETAIL_ROUTE}`)
      const destinationStop = page.getByTestId(`detail-stop-${SYNTHETIC_STOP_IDS.originStop}`)
      await expect(destinationStop).toBeVisible()
      await expect(destinationStop).toContainText('A-202610-000003')
      expect(getCount(strictNetwork, `/delivery-routes/${SYNTHETIC_ROUTE_IDS.destination}`)).toBe(1)

      const overflow = await assertDocumentNoHorizontalOverflow(page)
      expect(overflow.status, JSON.stringify(overflow)).toBe('pass')

      await testInfo.attach(`transfer-destination-${label}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    })
  }
})
