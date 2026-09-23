/**
 * D4 responsive evidence for the public catalog product-detail slice.
 *
 * Strict `/__e2e-api/**` declarations prove exact anonymous branch, product-list and detail traffic,
 * the exact detail URL carrying the resolved list `priceListId`, credential-free wire headers on all
 * three request classes, the absence of any detail fetch before the product is activated, the real
 * UModal focus lifecycle, the two synchronous activations of the connected retry control while the
 * accepted manual retry response is held in flight, and the read-only price/stock semantics at desktop,
 * 375 px and 320 px. Every step drives the real browser surface through accessible locators: no
 * component internals, no `wrapper.vm` and no direct component handler calls.
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { API_PREFIX, type DeclaredRoute, type StrictNetworkController } from '../fixtures/network'

const OVERFLOW_TOLERANCE_PX = 1
/** Ordinary Playwright wait budget for the first application render. It is a wait, never a retry. */
const APP_SHELL_TIMEOUT_MS = 20_000
/**
 * Bounded window after that turn in which an accidental concurrent activation would have to produce a
 * request.
 */
const CONCURRENT_REQUEST_WINDOW_MS = 750
const branchSlug = 'centro'
const priceListId = '3f1a1f2e-6f4a-4c2b-9f6d-1b2c3d4e5f60'
const targetProductId = '8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a'
const decoyProductId = '2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d'
const hiddenProductId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const detailImageUrl =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/%3E'

const viewports = [
  { key: 'desktop', width: 1280, height: 800 },
  { key: 'mobile', width: 375, height: 667 },
  { key: 'compact', width: 320, height: 568 },
] as const

const branch = { id: 'b-1', name: 'Sucursal Centro', slug: branchSlug, address: null, phone: null }
const priceContext = { priceListId, name: 'Lista pública', isCatalogDefault: true }

const targetProduct = {
  id: targetProductId,
  name: 'Termo de acero inoxidable 1 L',
  slug: null,
  description: null,
  category: { id: 'termos', name: 'Termos' },
  brand: { name: 'Acero Norte' },
  image: { url: detailImageUrl },
  price: { fromPriceCents: 2599, priceCents: 2599, hidden: false },
  availability: 'available',
  stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null },
  hasVariants: true,
  rating: null,
  featuredLabel: null,
}
const decoyProduct = {
  ...targetProduct,
  id: decoyProductId,
  name: 'Café molido de Chiapas',
  category: { id: 'cafe', name: 'Café' },
  brand: { name: 'Tostadores' },
  image: null,
  hasVariants: false,
}
const hiddenProduct = {
  ...targetProduct,
  id: hiddenProductId,
  name: 'Producto sin precio público ni existencias',
  category: null,
  brand: null,
  image: null,
  price: { fromPriceCents: null, priceCents: null, hidden: true },
  availability: null,
  stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
  hasVariants: false,
}

const productPage = (items: readonly unknown[]) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: items.length === 0 ? 0 : 1 },
  facets: { categories: [] },
  excludedCount: 0,
  priceContext,
})

const targetDetail = {
  id: targetProductId,
  name: targetProduct.name,
  slug: null,
  description: 'Termo de doble pared con tapa hermética.\nConserva la temperatura por 12 horas.',
  category: { id: 'termos', name: 'Termos' },
  brand: { name: 'Acero Norte' },
  images: [{ id: 'img-1', url: detailImageUrl, isMain: true }],
  price: { priceCents: 2599, hidden: false },
  availability: 'available',
  stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null },
  hasVariants: true,
  variants: [
    {
      id: 'c1b2a3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      name: 'Termo 1 L rojo',
      option: 'Color',
      value: 'Rojo',
      image: { url: detailImageUrl },
      price: { priceCents: 2699, hidden: false },
      availabilityByBranch: [
        {
          branchId: 'b-1',
          branchName: branch.name,
          branchSlug,
          availability: 'available',
          isSelected: true,
        },
      ],
      stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null },
    },
  ],
  rating: null,
  featuredLabel: null,
  priceContext,
  excludedCount: 0,
}
/** HIDDEN stock keeps every presentation field null and the detail price nullable and hidden. */
const hiddenDetail = {
  ...targetDetail,
  id: hiddenProductId,
  name: hiddenProduct.name,
  description: null,
  category: null,
  brand: null,
  images: [],
  price: { priceCents: null, hidden: true },
  availability: null,
  stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
  hasVariants: false,
  variants: [],
}

const branchesPath = '/public/catalog/branches'
const priceContextsPath = `/public/catalog/${branchSlug}/price-contexts`
const productsPath = `/public/catalog/${branchSlug}/products`
const detailPath = (productId: string) => `${productsPath}/${productId}`

const branchesPathname = `${API_PREFIX}${branchesPath}`
const priceContextsPathname = `${API_PREFIX}${priceContextsPath}`
const productsPathname = `${API_PREFIX}${productsPath}`
const detailPathname = (productId: string) => `${API_PREFIX}${detailPath(productId)}`

const branchRoute: DeclaredRoute = {
  method: 'GET',
  path: branchesPath,
  json: [branch],
  count: 1,
}
/** Anonymous discovery is a direct array of the same tenant context the list response echoes. */
const priceContextsRoute: DeclaredRoute = {
  method: 'GET',
  path: priceContextsPath,
  json: [priceContext],
  count: 1,
}
const productsRoute = (items: readonly unknown[]): DeclaredRoute => ({
  method: 'GET',
  path: productsPath,
  json: productPage(items),
  count: 1,
})
const detailRoute = (productId: string, json: unknown, count: number): DeclaredRoute => ({
  method: 'GET',
  path: detailPath(productId),
  query: { priceListId },
  json,
  count,
})

/** One observed wire read: exact URL, method, query and body plus every credential-bearing header. */
interface AnonymousRequestSnapshot {
  readonly url: string
  readonly method: string
  readonly query: Readonly<Record<string, string>>
  readonly body: string | null
  /** A real wire header, so the credential assertions below can never pass on an empty observation. */
  readonly accept: string | undefined
  readonly authorization: string | undefined
  readonly cookie: string | undefined
  /** Every wire header that mentions a tenant, so no tenant identity can travel unnoticed. */
  readonly tenantHeaders: readonly string[]
}

interface AnonymousTraffic {
  readonly branches: AnonymousRequestSnapshot[]
  readonly products: AnonymousRequestSnapshot[]
  readonly detail: AnonymousRequestSnapshot[]
  /** Resolves once every observed request recorded its full wire headers. */
  flush(): Promise<void>
}

const queryString = (query: Readonly<Record<string, string>>): string => {
  const search = new URLSearchParams(query).toString()
  return search.length === 0 ? '' : `?${search}`
}

const anonymousRequest = (
  pathname: string,
  query: Readonly<Record<string, string>> = {},
): AnonymousRequestSnapshot => ({
  url: `${RESPONSIVE_ORIGIN}${pathname}${queryString(query)}`,
  method: 'GET',
  query,
  body: null,
  accept: '*/*',
  authorization: undefined,
  cookie: undefined,
  tenantHeaders: [],
})

/**
 * Observes branch discovery, the product list and product detail on the wire. `allHeaders()` is used
 * on purpose: `headers()` drops cookie-related headers, which would make the anonymity assertions
 * vacuous.
 */
function captureAnonymousTraffic(page: Page, productId: string): AnonymousTraffic {
  const branches: AnonymousRequestSnapshot[] = []
  const products: AnonymousRequestSnapshot[] = []
  const detail: AnonymousRequestSnapshot[] = []
  const pending: Promise<void>[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    const bucket =
      url.pathname === branchesPathname
        ? branches
        : url.pathname === productsPathname
          ? products
          : url.pathname === detailPathname(productId)
            ? detail
            : null
    if (bucket === null) return
    pending.push(
      request.allHeaders().then((headers) => {
        bucket.push({
          url: request.url(),
          method: request.method(),
          query: Object.fromEntries(url.searchParams),
          body: request.postData(),
          accept: headers.accept,
          authorization: headers.authorization,
          cookie: headers.cookie,
          tenantHeaders: Object.keys(headers).filter((name) => name.includes('tenant')),
        })
      }),
    )
  })
  return {
    branches,
    products,
    detail,
    flush: async () => {
      await Promise.all(pending)
    },
  }
}

/** The whole declared ledger: one anonymous branches read, one anonymous price-context discovery, one anonymous list read, N exact detail reads. */
function expectExactCatalogTraffic(
  strictNetwork: StrictNetworkController,
  productId: string,
  detailCount: number,
): void {
  expect(strictNetwork.requests()).toEqual([
    { method: 'GET', path: branchesPath, query: {}, body: undefined },
    { method: 'GET', path: priceContextsPath, query: {}, body: undefined },
    { method: 'GET', path: productsPath, query: {}, body: undefined },
    ...Array.from({ length: detailCount }, () => ({
      method: 'GET',
      path: detailPath(productId),
      query: { priceListId },
      body: undefined,
    })),
  ])
  expect(strictNetwork.violations()).toEqual([])
}

/**
 * Navigates once with ordinary Playwright waits. A first-navigation boot, module or pre-API failure
 * must fail this test visibly: there is no document reload, no boot retry and no other recovery path.
 * The thrown error carries the observed document, console and page-error evidence so the failure stays
 * attributable instead of masked.
 */
async function openCatalog(page: Page): Promise<void> {
  const signals = new Set<string>()
  page.on('pageerror', (error) => signals.add(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') signals.add(`console: ${message.text()}`)
  })
  const response = await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/${branchSlug}`, {
    waitUntil: 'load',
  })
  try {
    await expect(
      page.getByRole('button', { name: 'Explorar sucursales', exact: true }),
    ).toBeVisible({ timeout: APP_SHELL_TIMEOUT_MS })
  } catch (error) {
    const mountedChildren = await page.evaluate(
      () => document.getElementById('app')?.childElementCount ?? -1,
    )
    throw new Error(
      `the catalog shell never rendered (document status ${response?.status() ?? 'unknown'}, ` +
        `#app children ${mountedChildren}, observed signals: ${[...signals].join(' | ') || 'none'})`,
      { cause: error },
    )
  }
}

const productInvoker = (page: Page, name: string): Locator =>
  page.getByRole('button', { name: `Ver detalles de ${name}`, exact: true })

const detailDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Detalle del producto', exact: true })

const focusedControlName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.activeElement
    if (active === null) return ''
    return active.getAttribute('aria-label') ?? (active.textContent ?? '').trim()
  })

/** Walks Tab through the open dialog; every step must stay inside the real UModal focus trap. */
async function tabInsideDialog(page: Page, dialog: Locator, steps: number): Promise<string[]> {
  const names: string[] = []
  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press('Tab')
    expect(
      await dialog.evaluate((element) => element.contains(document.activeElement)),
      'Tab must not escape the open product detail dialog',
    ).toBe(true)
    names.push(await focusedControlName(page))
  }
  return names
}

async function measurableBox(locator: Locator, label: string) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`${label} rendered without a measurable box`)
  return box
}

function expectInsideViewport(
  box: { x: number; y: number; width: number; height: number },
  viewport: (typeof viewports)[number],
  label: string,
): void {
  expect(box.x, `${label} must not start left of the viewport`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${label} must fit the viewport width`).toBeLessThanOrEqual(
    viewport.width + OVERFLOW_TOLERANCE_PX,
  )
  expect(box.y, `${label} must not start above the viewport`).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height, `${label} must fit the viewport height`).toBeLessThanOrEqual(
    viewport.height + OVERFLOW_TOLERANCE_PX,
  )
}

const CONTROL_ROLES = [
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'spinbutton',
  'slider',
  'switch',
  'tab',
  'menuitem',
] as const

interface ControlSnapshot {
  readonly role: string
  readonly name: string
}

const controlKey = (control: ControlSnapshot): string => `${control.role} "${control.name}"`

/** The inert storefront shell plus one detail invoker per rendered product card. */
const SHELL_CONTROL_NAMES = [
  'Explorar sucursales',
  'Lista de precios',
  'Cambiar tema',
  branch.name,
] as const
const invokerControlName = (productName: string): string => `Ver detalles de ${productName}`

const shellControls = (productNames: readonly string[]): ControlSnapshot[] => [
  ...SHELL_CONTROL_NAMES.map((name) => ({ role: 'button', name })),
  ...productNames.map((name) => ({ role: 'button', name: invokerControlName(name) })),
]

/**
 * Every enabled control rendered anywhere on the complete page, keyed by accessible role and
 * accessible name. Disabled controls are excluded on purpose: the intentionally inert storefront
 * shell is asserted separately.
 */
async function enabledPageControls(page: Page): Promise<ControlSnapshot[]> {
  const controls: ControlSnapshot[] = []
  for (const role of CONTROL_ROLES) {
    const names = await page
      .getByRole(role)
      .evaluateAll((elements) =>
        elements
          .filter(
            (element) =>
              !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true',
          )
          .map(
            (element) => element.getAttribute('aria-label') ?? (element.textContent ?? '').trim(),
          ),
      )
    for (const name of names) controls.push({ role, name })
  }
  return controls
}

/**
 * Proves the read-only storefront across the complete page: the only enabled controls are the inert
 * shell controls and the product detail invokers, while search, category filter, sort and cart stay
 * the known intentionally disabled shell. Any auth, commerce, search, filter, sort or speculative
 * action would break this exact inventory.
 */
async function expectReadOnlyStorefront(
  page: Page,
  productNames: readonly string[],
): Promise<void> {
  const actual = (await enabledPageControls(page)).map(controlKey).sort()
  const expected = shellControls(productNames).map(controlKey).sort()
  expect(actual).toEqual(expected)

  for (const [role, name] of [
    ['textbox', 'Buscar en el catálogo'],
    ['button', 'Todas las categorías'],
    ['button', 'Ordenar catálogo'],
    ['button', 'Ver carrito'],
  ] as const) {
    await expect(page.getByRole(role, { name, exact: true })).toBeDisabled()
  }
  await expect(page.getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('searchbox')).toHaveCount(0)
}

/**
 * While the detail dialog is open the rest of the page must stay unchanged: every enabled control
 * that is not part of the inert shell inventory has to be a close control of that dialog. The guarded
 * retry control is only tolerated when the retry is actually offered.
 */
async function expectDialogAddsNoActionBesidesClose(
  page: Page,
  productNames: readonly string[],
  options: { readonly retryOffered?: boolean } = {},
): Promise<void> {
  const shell = shellControls(productNames).map(controlKey)
  const isAllowedExtra = (control: ControlSnapshot): boolean =>
    control.role === 'button' &&
    (/cerrar|close/i.test(control.name) ||
      (options.retryOffered === true && control.name === 'Reintentar'))
  const extras = (await enabledPageControls(page)).filter(
    (control) => !shell.includes(controlKey(control)),
  )

  expect(extras, 'the open detail must add at least its own close control').not.toEqual([])
  expect(extras.filter((control) => !isAllowedExtra(control))).toEqual([])
  expect(
    extras.some((control) => control.name === 'Cerrar detalle del producto'),
    'the detail must keep its own close control',
  ).toBe(true)
  await expect(page.getByRole('link')).toHaveCount(0)
}

/** Resolves true when a matching request is issued inside the bounded window; false means none was. */
async function detailRequestWithin(
  page: Page,
  pathname: string,
  windowMs: number,
): Promise<boolean> {
  return page
    .waitForRequest((request) => new URL(request.url()).pathname === pathname, {
      timeout: windowMs,
    })
    .then(() => true)
    .catch(() => false)
}

for (const viewport of viewports) {
  test.describe(`public catalog product detail interaction at ${viewport.key}`, () => {
    test.use({
      declaredRoutes: {
        routes: [
          branchRoute,
          priceContextsRoute,
          productsRoute([targetProduct, decoyProduct]),
          detailRoute(targetProductId, targetDetail, 2),
        ],
      },
    })

    test('opens the activated product, traps focus in the real modal, restores the exact invoker, and reopens by keyboard', async ({
      page,
      strictNetwork,
    }, testInfo) => {
      const traffic = captureAnonymousTraffic(page, targetProductId)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openCatalog(page)

      const invoker = productInvoker(page, targetProduct.name)
      await expect(invoker).toBeVisible()
      await expect(productInvoker(page, decoyProduct.name)).toBeVisible()

      // No detail request exists before the product is activated, and no other API traffic occurs.
      await traffic.flush()
      expect(traffic.branches).toEqual([anonymousRequest(branchesPathname)])
      expect(traffic.products).toEqual([anonymousRequest(productsPathname)])
      expect(traffic.detail).toEqual([])
      expectExactCatalogTraffic(strictNetwork, targetProductId, 0)

      // The inherited storefront shell stays inert: search, filter, sort, cart and authentication are unavailable.
      await expectReadOnlyStorefront(page, [targetProduct.name, decoyProduct.name])

      await invoker.click()

      const dialog = detailDialog(page)
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', { name: targetDetail.name, exact: true }),
      ).toBeVisible()

      // The pointer activation requested exactly the clicked product, anonymously, with the list price context.
      await traffic.flush()
      expect(traffic.detail).toEqual([
        anonymousRequest(detailPathname(targetProductId), { priceListId }),
      ])
      expect(traffic.branches).toEqual([anonymousRequest(branchesPathname)])
      expect(traffic.products).toEqual([anonymousRequest(productsPathname)])
      await expect(
        dialog.getByRole('heading', { name: decoyProduct.name, exact: true }),
      ).toHaveCount(0)
      await expect(dialog.getByText('$25.99', { exact: true })).toBeVisible()

      // The open detail adds no commerce, auth, search, filter, sort or speculative action anywhere on the page.
      await expectDialogAddsNoActionBesidesClose(page, [targetProduct.name, decoyProduct.name])

      // Real UModal lifecycle: focus enters the dialog, Tab cycles inside it, and the actions stay reachable.
      expect(
        await dialog.evaluate((element) => element.contains(document.activeElement)),
        'focus must enter the opened dialog',
      ).toBe(true)
      expectInsideViewport(
        await measurableBox(dialog, 'the product detail dialog'),
        viewport,
        'the product detail dialog',
      )
      const closeButton = dialog.getByRole('button', {
        name: 'Cerrar detalle del producto',
        exact: true,
      })
      await expect(closeButton).toBeVisible()
      await expect(closeButton).toBeEnabled()
      expectInsideViewport(
        await measurableBox(closeButton, 'the dialog close control'),
        viewport,
        'the dialog close control',
      )
      const tabbedNames = await tabInsideDialog(page, dialog, 6)
      expect(tabbedNames, 'the dialog close control must be keyboard reachable').toContain(
        'Cerrar detalle del producto',
      )

      // Read-only detail: the only dialog actions are close controls, and variants render no action.
      const actionNames = await dialog
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map(
            (button) => button.getAttribute('aria-label') ?? (button.textContent ?? '').trim(),
          ),
        )
      expect(actionNames.length).toBeGreaterThan(0)
      expect(actionNames.every((name) => /cerrar|close/i.test(name))).toBe(true)
      expect(await dialog.locator('a[href]').count()).toBe(0)
      for (const role of ['spinbutton', 'textbox', 'checkbox', 'radio', 'combobox'] as const) {
        expect(
          await dialog.getByRole(role).count(),
          `the detail must expose no ${role} action`,
        ).toBe(0)
      }
      expect(await dialog.getByText(/\d+\s*unidades/).count()).toBe(0)
      const variantRegion = dialog.getByRole('region', {
        name: 'Variantes disponibles',
        exact: true,
      })
      await expect(
        variantRegion.getByText(targetDetail.variants[0].name, { exact: true }),
      ).toBeVisible()
      expect(await variantRegion.getByRole('button').count()).toBe(0)

      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.key}-product-detail-populated`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      // Escape closes the dialog and focus returns to the exact product control that opened it.
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(invoker).toBeFocused()

      // Keyboard reopening still resolves the same anonymous detail identity.
      await invoker.press('Enter')
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', { name: targetDetail.name, exact: true }),
      ).toBeVisible()
      await traffic.flush()
      expect(traffic.detail).toEqual([
        anonymousRequest(detailPathname(targetProductId), { priceListId }),
        anonymousRequest(detailPathname(targetProductId), { priceListId }),
      ])
      expect(traffic.branches).toEqual([anonymousRequest(branchesPathname)])
      expect(traffic.products).toEqual([anonymousRequest(productsPathname)])
      expectExactCatalogTraffic(strictNetwork, targetProductId, 2)
    })
  })

  test.describe(`public catalog product detail hidden semantics at ${viewport.key}`, () => {
    test.use({
      declaredRoutes: {
        routes: [
          branchRoute,
          priceContextsRoute,
          productsRoute([hiddenProduct]),
          detailRoute(hiddenProductId, hiddenDetail, 1),
        ],
      },
    })

    test('renders null price and HIDDEN stock without a zero price, a quantity, or an out-of-stock claim', async ({
      page,
      strictNetwork,
    }, testInfo) => {
      const traffic = captureAnonymousTraffic(page, hiddenProductId)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openCatalog(page)

      const invoker = productInvoker(page, hiddenProduct.name)
      await expect(invoker).toBeVisible()
      await expectReadOnlyStorefront(page, [hiddenProduct.name])
      await invoker.click()

      const dialog = detailDialog(page)
      await expect(
        dialog.getByRole('heading', { name: hiddenDetail.name, exact: true }),
      ).toBeVisible()
      await expect(dialog.getByText('Consultar precio', { exact: true })).toBeVisible()
      await expect(dialog.getByText('Información no disponible', { exact: true })).toBeVisible()

      // No media was invented: the reserved detail slot falls back safely.
      await expect(dialog.getByTestId('catalog-detail-image-fallback')).toBeVisible()
      await expect(
        dialog.getByRole('img', {
          name: `Imagen no disponible para ${hiddenDetail.name}`,
          exact: true,
        }),
      ).toBeVisible()

      // Hidden price never becomes "$0" and hidden stock never becomes a quantity or a stock claim.
      expect(await dialog.getByText(/\$/).count()).toBe(0)
      for (const claim of ['Disponible', 'Pocas piezas', 'Agotado']) {
        expect(await dialog.getByText(claim, { exact: true }).count(), `no ${claim} claim`).toBe(0)
      }
      expect(await dialog.getByText(/\d+\s*unidades/).count()).toBe(0)
      expect(
        await dialog.getByText(/sin existencia|out of stock|no disponible para venta/i).count(),
      ).toBe(0)

      // The unavailable detail still adds no commerce, auth, search, filter or speculative action.
      await expectDialogAddsNoActionBesidesClose(page, [hiddenProduct.name])

      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.key}-product-detail-hidden`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await traffic.flush()
      expect(traffic.branches).toEqual([anonymousRequest(branchesPathname)])
      expect(traffic.products).toEqual([anonymousRequest(productsPathname)])
      expect(traffic.detail).toEqual([
        anonymousRequest(detailPathname(hiddenProductId), { priceListId }),
      ])
      expectExactCatalogTraffic(strictNetwork, hiddenProductId, 1)
    })
  })

  test.describe(`public catalog product detail rate limit recovery at ${viewport.key}`, () => {
    test.use({
      declaredRoutes: {
        routes: [
          branchRoute,
          priceContextsRoute,
          productsRoute([targetProduct]),
          // The accepted manual retry is the only request reaching the declared route, and it is held
          // in flight so a concurrent second activation would be an exceeded, aborted request.
          { ...detailRoute(targetProductId, targetDetail, 1), deferred: true },
        ],
      },
    })

    test('surfaces the 429 without an automatic retry, holds the manual retry in flight, and refuses a concurrent activation', async ({
      page,
      strictNetwork,
    }, testInfo) => {
      const traffic = captureAnonymousTraffic(page, targetProductId)
      let attempts = 0
      // The first attempt is answered with the documented throttle response; every later attempt falls
      // through to the declared route so the strict ledger still records exactly one accepted detail read.
      await page.route(`**${API_PREFIX}${detailPath(targetProductId)}*`, async (route) => {
        attempts += 1
        if (attempts > 1) return route.fallback()
        return route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'public catalog rate limited (e2e)' }),
        })
      })

      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openCatalog(page)

      const invoker = productInvoker(page, targetProduct.name)
      await expect(invoker).toBeVisible()
      await expectReadOnlyStorefront(page, [targetProduct.name])
      await invoker.click()

      const dialog = detailDialog(page)
      await expect(
        dialog.getByText(
          'Hay muchas solicitudes en este momento. Intenta de nuevo en unos momentos.',
          {
            exact: true,
          },
        ),
      ).toBeVisible()

      // No automatic retry happened: exactly one anonymous attempt exists and no detail content leaked through.
      await traffic.flush()
      expect(traffic.branches).toEqual([anonymousRequest(branchesPathname)])
      expect(traffic.products).toEqual([anonymousRequest(productsPathname)])
      expect(traffic.detail).toEqual([
        anonymousRequest(detailPathname(targetProductId), { priceListId }),
      ])
      expect(attempts).toBe(1)
      expect(
        await dialog.getByRole('heading', { name: targetDetail.name, exact: true }).count(),
      ).toBe(0)

      const retry = dialog.getByRole('button', { name: 'Reintentar', exact: true })
      await expect(retry).toBeVisible()
      await expect(retry).toBeEnabled()
      await retry.focus()
      await expect(retry).toBeFocused()
      expectInsideViewport(
        await measurableBox(retry, 'the dialog retry control'),
        viewport,
        'the dialog retry control',
      )
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.key}-product-detail-rate-limit`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      // While the error is shown, the only enabled controls on the page besides the inert shell are the
      // dialog close controls and the offered retry control.
      await expectDialogAddsNoActionBesidesClose(page, [targetProduct.name], { retryOffered: true })

      // Registered before any activation so the single accepted manual retry is awaited on the wire with
      // no race: the initial 429 attempt is already in the past, so the next detail read is that retry.
      const acceptedRetry = page.waitForRequest(
        (request) => new URL(request.url()).pathname === detailPathname(targetProductId),
      )

      // The manual retry is started by two native DOM activations of the same retry control, dispatched
      // back to back inside one synchronous browser turn. Vue can only replace that control in a later
      // microtask, so the concurrent activation provably lands on the still connected, still enabled
      // button instead of on an already removed locator, and it has to be refused by the fetching guard.
      const activations = await retry.evaluate((element) => {
        if (!(element instanceof HTMLButtonElement)) {
          throw new Error('the retry control must be a real HTML button element')
        }
        const snapshots: Array<{
          readonly activation: number
          readonly connected: boolean
          readonly disabled: boolean
          readonly received: number
        }> = []
        let received = 0
        const countClick = () => {
          received += 1
        }
        element.addEventListener('click', countClick)
        try {
          for (const activation of [1, 2]) {
            element.click()
            snapshots.push({
              activation,
              connected: element.isConnected,
              disabled: element.disabled,
              received,
            })
          }
        } finally {
          element.removeEventListener('click', countClick)
        }
        return snapshots
      })

      // Both activations were delivered to that same live control: it stayed connected and enabled even
      // after the first real click was handled, so no render had replaced it in between.
      expect(activations).toEqual([
        { activation: 1, connected: true, disabled: false, received: 1 },
        { activation: 2, connected: true, disabled: false, received: 2 },
      ])

      await expect(
        dialog.getByText('Reintentando detalle del producto', { exact: true }),
      ).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0)

      // The accepted manual retry is the only extra attempt on the wire, and the strict declared route
      // holds it in flight while the refused concurrent activation produces no later attempt.
      await acceptedRetry
      expect(
        await detailRequestWithin(
          page,
          detailPathname(targetProductId),
          CONCURRENT_REQUEST_WINDOW_MS,
        ),
        'the second activation of the connected retry control must not reach the transport',
      ).toBe(false)
      expect(attempts).toBe(2)
      await traffic.flush()
      expect(traffic.detail).toEqual([
        anonymousRequest(detailPathname(targetProductId), { priceListId }),
        anonymousRequest(detailPathname(targetProductId), { priceListId }),
      ])
      expectExactCatalogTraffic(strictNetwork, targetProductId, 1)

      // The accepted retry is still in flight, so the detail content cannot be rendered yet.
      expect(
        await dialog.getByRole('heading', { name: targetDetail.name, exact: true }).count(),
      ).toBe(0)

      // Releasing the held response completes exactly one manual retry and renders the real content.
      await strictNetwork.releaseDeferred()
      await expect(
        dialog.getByRole('heading', { name: targetDetail.name, exact: true }),
      ).toBeVisible()
      await expect(retry).toBeHidden()
      expect(attempts).toBe(2)
      await traffic.flush()
      expect(traffic.detail).toHaveLength(2)
      expectExactCatalogTraffic(strictNetwork, targetProductId, 1)
    })
  })
}
