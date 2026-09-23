/**
 * D4 responsive evidence for the public catalog product-detail slice.
 *
 * Strict `/__e2e-api/**` declarations prove exact anonymous branch, price-context discovery,
 * product-list and detail traffic, the exact detail URL carrying the resolved list `priceListId`,
 * credential-free wire headers on all four request classes, the absence of any detail fetch before
 * the product is activated, the real
 * UModal focus lifecycle, the two synchronous activations of the connected retry control while the
 * accepted manual retry response is held in flight, and the read-only price/stock semantics at desktop,
 * 375 px and 320 px. It also proves the read-only media preview contract in the browser: the exact
 * media-only control inventory, the 72×72 variant media frame, the enlarged-image dialog with its
 * keyboard and pointer activation, its Escape, custom-close and outside dismissal, its 44px close
 * target and its containment at every viewport, plus the sparse-detail feedback note. Every step drives
 * the real browser surface through accessible locators: no component internals, no `wrapper.vm` and no
 * direct component handler calls.
 *
 * The URL-keyed preview failure fallback is deliberately not proven here: this spec reuses only the
 * declared data-URI media, so a failing preview URL would require either a mutated fixture or an
 * undeclared request. That mutation-sensitive `error` transition stays covered by the unit suite, which
 * owns the keyed failure path.
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
/** The second variant of the same product carries no media, so it must stay an icon-only fallback. */
const nullImageVariantName = 'Termo 1 L azul'
/** The enlarged image is a distinct read-only sibling dialog with its own exact delivered title. */
const previewDialogName = 'Vista ampliada de imagen'
const previewCloseName = 'Cerrar vista de imagen'
/** Every interactive target this spec measures has to reach the 44px touch minimum. */
const MIN_TOUCH_TARGET_PX = 44
/** The exact square the variant media frame keeps at every viewport. */
const VARIANT_FRAME_SIZE_PX = 72
/** A rounded square, never an avatar: the cap keeps the frame's radius visibly non-circular. */
const VARIANT_FRAME_MAX_RADIUS_PX = 24

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
    {
      id: 'd2c3b4a5-f6e7-4b8c-9d0e-1f2a3b4c5d6e',
      name: nullImageVariantName,
      option: 'Color',
      value: 'Azul',
      // A declared null variant image must never produce an `<img>`: the compact thumbnail is icon-only.
      image: null,
      price: { priceCents: 2799, hidden: false },
      availabilityByBranch: [
        {
          branchId: 'b-1',
          branchName: branch.name,
          branchSlug,
          availability: 'low_stock',
          isSelected: true,
        },
      ],
      stockPresentation: { mode: 'SYSTEM_STATUS', status: 'low_stock', customQuantity: null },
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
/** The real media a populated read-only detail declares, and the media-only controls it earns. */
const realVariantName = targetDetail.variants[0].name
const mainPreviewControlName = `Ampliar imagen de ${targetDetail.name}`
const realVariantPreviewControlName = `Ampliar imagen de la variante ${realVariantName}`
/** Exact media-only controls a populated read-only detail may expose: one per real delivered image. */
const mediaControlNames = [mainPreviewControlName, realVariantPreviewControlName] as const

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
  readonly priceContexts: AnonymousRequestSnapshot[]
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
 * Observes branch discovery, price-context discovery, the product list and product detail on the
 * wire. `allHeaders()` is used on purpose: `headers()` drops cookie-related headers, which would make
 * the anonymity assertions vacuous.
 */
function captureAnonymousTraffic(page: Page, productId: string): AnonymousTraffic {
  const branches: AnonymousRequestSnapshot[] = []
  const priceContexts: AnonymousRequestSnapshot[] = []
  const products: AnonymousRequestSnapshot[] = []
  const detail: AnonymousRequestSnapshot[] = []
  const pending: Promise<void>[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    const bucket =
      url.pathname === branchesPathname
        ? branches
        : url.pathname === priceContextsPathname
          ? priceContexts
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
    priceContexts,
    products,
    detail,
    flush: async () => {
      await Promise.all(pending)
    },
  }
}

/**
 * The whole declared ledger: one anonymous branches read, one anonymous price-context discovery, one
 * anonymous list read, then N exact detail reads.
 */
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

/**
 * DOM-anchored dialog elements. The role locators above resolve nothing while the top modal hides the
 * other dialog from assistive technology, so overlap, containment and the outside dismissal point are
 * measured on these elements instead.
 */
const detailDialogElement = (page: Page): Locator =>
  page.locator('[role="dialog"]:has([data-testid="catalog-detail-split"])')
const previewDialogElement = (page: Page): Locator =>
  page.locator('[role="dialog"]:has([data-testid="catalog-detail-image-preview"])')

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

/**
 * Waits for the finite enter animation of a surface to settle, so the geometry, paint-order and focus
 * assertions below observe the final layout instead of a mid-transition frame. Infinite and paused
 * animations are excluded on purpose: they never settle, and nothing here depends on one.
 */
async function settleModalAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true }).filter((animation) => {
      if (animation.playState === 'paused') return false
      const timing = animation.effect?.getComputedTiming()
      return timing !== undefined && timing.iterations !== Infinity
    })
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
  })
}

/** Every computed corner radius, so the browser proves the shape instead of the class list. */
async function computedCornerRadii(locator: Locator): Promise<number[]> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((radius) => Number.parseFloat(radius))
  })
}

/** A grid-aligned box, as measured in viewport coordinates. */
interface MeasuredBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** True when the point falls outside at least one edge of the given rectangle. */
function isOutsideBox(point: { x: number; y: number }, box: MeasuredBox): boolean {
  return (
    point.x < box.x ||
    point.x > box.x + box.width ||
    point.y < box.y ||
    point.y > box.y + box.height
  )
}

/** True only when the inner rectangle stays within every edge of the outer rectangle. */
function containsBox(outer: MeasuredBox, inner: MeasuredBox): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/**
 * Proves the real paint order where the two dialogs overlap. The non-empty intersection of the outer
 * detail and the preview is computed first, then a point inside that shared rectangle must be owned by
 * the preview: a preview painted behind the detail fails here, and two dialogs that never overlap fail
 * too instead of silently proving nothing.
 */
async function expectPreviewPaintsAboveDetail(preview: Locator, detail: Locator): Promise<void> {
  const previewBox = await measurableBox(preview, 'the enlarged image dialog')
  const detailBox = await measurableBox(detail, 'the product detail dialog')
  const overlap = {
    left: Math.max(previewBox.x, detailBox.x),
    top: Math.max(previewBox.y, detailBox.y),
    right: Math.min(previewBox.x + previewBox.width, detailBox.x + detailBox.width),
    bottom: Math.min(previewBox.y + previewBox.height, detailBox.y + detailBox.height),
  }

  expect(
    overlap.right - overlap.left,
    'the enlarged view must really overlap the product detail',
  ).toBeGreaterThan(OVERFLOW_TOLERANCE_PX)
  expect(
    overlap.bottom - overlap.top,
    'the enlarged view must really overlap the product detail',
  ).toBeGreaterThan(OVERFLOW_TOLERANCE_PX)

  const previewOwnsOverlap = await preview.evaluate(
    (element, point) => {
      const topmost = document.elementFromPoint(point.x, point.y)
      return topmost !== null && element.contains(topmost)
    },
    { x: (overlap.left + overlap.right) / 2, y: (overlap.top + overlap.bottom) / 2 },
  )
  expect(previewOwnsOverlap, 'the enlarged view must paint above the detail it overlaps').toBe(true)
}

/** True when the decorative affordance lives inside the media control it decorates. */
async function affordanceOwnerLabel(locator: Locator): Promise<string | null> {
  return locator.evaluate(
    (element) => element.closest('button')?.getAttribute('aria-label') ?? null,
  )
}

/**
 * Horizontal containment only: a column that scrolls inside the dialog body is legitimately allowed to
 * extend vertically past the viewport, but nothing may ever poke out of the viewport width.
 */
function expectWithinViewportWidth(
  box: { x: number; width: number },
  viewport: (typeof viewports)[number],
  label: string,
): void {
  expect(box.x, `${label} must not start left of the viewport`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${label} must fit the viewport width`).toBeLessThanOrEqual(
    viewport.width + OVERFLOW_TOLERANCE_PX,
  )
}

function expectInsideViewport(
  box: MeasuredBox,
  viewport: (typeof viewports)[number],
  label: string,
): void {
  expectWithinViewportWidth(box, viewport, label)
  expect(box.y, `${label} must not start above the viewport`).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height, `${label} must fit the viewport height`).toBeLessThanOrEqual(
    viewport.height + OVERFLOW_TOLERANCE_PX,
  )
}

/**
 * Proves the computed variant media contract on one frame: a real 72×72 square, one shared modest
 * radius on all four corners, never a circle, and never wider than the viewport. The browser box and
 * the four computed radii, never the class list, are the evidence.
 */
async function expectVariantFrameGeometry(
  frame: Locator,
  viewport: (typeof viewports)[number],
  label: string,
): Promise<void> {
  await expect(frame).toBeVisible()
  const box = await measurableBox(frame, label)
  expect(Math.round(box.width), `${label} must be ${VARIANT_FRAME_SIZE_PX}px wide`).toBe(
    VARIANT_FRAME_SIZE_PX,
  )
  expect(Math.round(box.height), `${label} must be ${VARIANT_FRAME_SIZE_PX}px tall`).toBe(
    VARIANT_FRAME_SIZE_PX,
  )
  const radii = await computedCornerRadii(frame)
  expect(new Set(radii).size, `${label} must share one radius on all four corners`).toBe(1)
  expect(radii[0], `${label} must be rounded, never square-cornered`).toBeGreaterThan(0)
  expect(radii[0], `${label} radius must stay modest at the 72px edge`).toBeLessThanOrEqual(
    VARIANT_FRAME_MAX_RADIUS_PX,
  )
  expect(radii[0], `${label} must never be circular`).toBeLessThan(box.width / 2)
  expectWithinViewportWidth(box, viewport, label)
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

/**
 * The inert storefront shell plus one detail invoker per rendered product card. Branch choices live
 * inside the closed-by-default `Seleccionar sucursal` dialog, so they are never shell controls. The
 * tenant-scoped price-context selector is a real shell control once discovery resolves, so it belongs
 * to this exact inventory instead of the dialog allowance.
 */
const SHELL_CONTROL_NAMES = ['Explorar sucursales', 'Lista de precios', 'Cambiar tema'] as const
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
 * While the detail dialog is open the rest of the page must stay unchanged: every enabled control that
 * is not part of the inert shell inventory has to be the dialog's own close control, one of the exact
 * media-only preview controls a real delivered image earns, or the retry control actually offered.
 * Media labels are passed in and must be present, so the allowance can never cover a commerce,
 * selection, rating, search, filter or sort action hiding behind a media name.
 */
async function expectDialogAddsNoActionBesidesMedia(
  page: Page,
  productNames: readonly string[],
  options: { readonly mediaNames?: readonly string[]; readonly retryOffered?: boolean } = {},
): Promise<void> {
  const shell = shellControls(productNames).map(controlKey)
  const mediaNames = options.mediaNames ?? []
  const isAllowedExtra = (control: ControlSnapshot): boolean =>
    control.role === 'button' &&
    (/cerrar|close/i.test(control.name) ||
      mediaNames.includes(control.name) ||
      (options.retryOffered === true && control.name === 'Reintentar'))
  const extras = (await enabledPageControls(page)).filter(
    (control) => !shell.includes(controlKey(control)),
  )

  expect(extras, 'the open detail must add at least its own close control').not.toEqual([])
  expect(extras.filter((control) => !isAllowedExtra(control))).toEqual([])
  for (const mediaName of mediaNames) {
    expect(
      extras.map((control) => control.name),
      `the allowed media control "${mediaName}" must really be on screen`,
    ).toContain(mediaName)
  }
  expect(
    extras.some((control) => control.name === 'Cerrar detalle del producto'),
    'the detail must keep its own close control',
  ).toBe(true)
  await expect(page.getByRole('link')).toHaveCount(0)
}

/**
 * While the preview owns the surface, the page-wide enabled-control inventory is asserted exactly, not
 * as a difference against what the page offered before. The enlarged view isolates the application
 * root (`inert` plus `aria-hidden`) for its whole lifecycle, so the storefront shell, the product grid
 * and the detail dialog behind it all leave the accessibility tree together: the only enabled control
 * the complete page may still expose is the preview's own close button. Comparing against this exact
 * inventory therefore rejects a duplicated or missing close control, every grid, shell or detail
 * control surviving behind the enlarged view, and any newly enabled underlying action at once.
 */
async function expectExactPreviewPageInventory(page: Page): Promise<void> {
  const actual = (await enabledPageControls(page)).map(controlKey).sort()
  const expected = [controlKey({ role: 'button', name: previewCloseName })]
  expect(actual).toEqual(expected)
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
      expect(traffic.priceContexts).toEqual([anonymousRequest(priceContextsPathname)])
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
      expect(traffic.priceContexts).toEqual([anonymousRequest(priceContextsPathname)])
      expect(traffic.products).toEqual([anonymousRequest(productsPathname)])
      await expect(
        dialog.getByRole('heading', { name: decoyProduct.name, exact: true }),
      ).toHaveCount(0)
      await expect(dialog.getByText('$25.99', { exact: true })).toBeVisible()

      // The open detail adds no commerce, auth, search, filter, sort or speculative action anywhere on
      // the page: its only extra controls are its own close control and one media-only preview per real
      // delivered image.
      await expectDialogAddsNoActionBesidesMedia(page, [targetProduct.name, decoyProduct.name], {
        mediaNames: mediaControlNames,
      })

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

      // Read-only detail: the exact action inventory is one close control plus one media-only preview
      // control per real delivered image. Variant selection, commerce, rating, search, filter and sort
      // would all break this exact list.
      const actionNames = await dialog
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map(
            (button) => button.getAttribute('aria-label') ?? (button.textContent ?? '').trim(),
          ),
        )
      expect(actionNames.slice().sort()).toEqual(
        ['Cerrar detalle del producto', ...mediaControlNames].sort(),
      )
      expect(await dialog.locator('a[href]').count()).toBe(0)
      for (const role of ['spinbutton', 'textbox', 'checkbox', 'radio', 'combobox'] as const) {
        expect(
          await dialog.getByRole(role).count(),
          `the detail must expose no ${role} action`,
        ).toBe(0)
      }
      expect(await dialog.getByText(/\d+\s*unidades/).count()).toBe(0)
      // The sparse-detail note belongs to a product with neither description nor variants; this detail
      // publishes both, so the panel must not claim anything is missing.
      expect(await dialog.getByTestId('catalog-detail-empty-note').count()).toBe(0)
      await expect(dialog.getByText('Sin información adicional', { exact: true })).toHaveCount(0)

      // Product-level media renders the real declared image under its product-scoped alt.
      const mainImage = dialog.getByRole('img', {
        name: `Imagen de ${targetDetail.name}`,
        exact: true,
      })
      await expect(mainImage).toBeVisible()
      await expect(mainImage).toHaveAttribute('src', detailImageUrl)

      // The real main image is one media-only control: no variant selection, no pressed state and no
      // commerce state of any kind.
      const mainPreviewTrigger = dialog.getByRole('button', {
        name: mainPreviewControlName,
        exact: true,
      })
      await expect(mainPreviewTrigger).toBeVisible()
      await expect(mainPreviewTrigger).toBeEnabled()
      expect(await mainPreviewTrigger.getAttribute('aria-pressed')).toBeNull()
      expect(await mainPreviewTrigger.getAttribute('aria-current')).toBeNull()
      expect(await mainPreviewTrigger.getAttribute('aria-selected')).toBeNull()
      expect(
        await mainPreviewTrigger.evaluate((element) => element.tagName),
        'the preview trigger must be a real button',
      ).toBe('BUTTON')
      expect(
        await mainPreviewTrigger.locator('img[src]').count(),
        'the labelled media control owns the delivered image',
      ).toBe(1)

      // The always-visible `Ampliar` affordance adds a promise, never a control: it is hidden from
      // assistive technology, it lives inside the labelled media button, and no button is named after it.
      const mainZoomAffordance = dialog.getByTestId('catalog-detail-image-zoom-affordance')
      await expect(mainZoomAffordance).toBeVisible()
      expect(((await mainZoomAffordance.textContent()) ?? '').trim()).toBe('Ampliar')
      expect(await mainZoomAffordance.getAttribute('aria-hidden')).toBe('true')
      expect(
        await affordanceOwnerLabel(mainZoomAffordance),
        'the zoom affordance must live inside the labelled media control',
      ).toBe(mainPreviewControlName)
      await expect(page.getByRole('button', { name: 'Ampliar', exact: true })).toHaveCount(0)

      const variantRegion = dialog.getByRole('region', {
        name: 'Variantes disponibles',
        exact: true,
      })
      const variantRows = variantRegion.locator('[data-testid="catalog-detail-variant"]')
      await expect(variantRows).toHaveCount(targetDetail.variants.length)
      await expect(variantRegion.getByText(realVariantName, { exact: true })).toBeVisible()
      // Exactly one variant owns real delivered media, so the whole region exposes exactly one control.
      await expect(variantRegion.getByRole('button')).toHaveCount(1)

      // The real variant renders its declared data-URI thumbnail with the variant-scoped alt, inside the
      // same media-only preview contract as the main image.
      const realVariantRow = variantRows.filter({ hasText: realVariantName })
      const realThumbnail = realVariantRow.getByRole('img', {
        name: `Imagen de la variante ${realVariantName}`,
        exact: true,
      })
      await expect(realThumbnail).toBeVisible()
      await expect(realThumbnail).toHaveAttribute('src', detailImageUrl)
      const realVariantTrigger = realVariantRow.getByRole('button', {
        name: realVariantPreviewControlName,
        exact: true,
      })
      await expect(realVariantTrigger).toBeVisible()
      await expect(realVariantTrigger).toBeEnabled()
      expect(await realVariantTrigger.getAttribute('aria-pressed')).toBeNull()
      expect(await realVariantTrigger.getAttribute('aria-current')).toBeNull()
      expect(await realVariantTrigger.getAttribute('aria-selected')).toBeNull()

      // The thumbnail affordance repeats that promise at media scale, inside the labelled button and
      // hidden from assistive technology, so it never becomes a second control.
      const variantZoomAffordance = realVariantRow.getByTestId(
        'catalog-detail-variant-image-zoom-affordance',
      )
      await expect(variantZoomAffordance).toBeVisible()
      expect(await variantZoomAffordance.getAttribute('aria-hidden')).toBe('true')
      expect(
        await affordanceOwnerLabel(variantZoomAffordance),
        'the thumbnail affordance must live inside the labelled media control',
      ).toBe(realVariantPreviewControlName)

      // Both variant media frames — the one with real delivered media and the one with declared null
      // media — keep the identical browser-computed 72×72 square with a modest, non-circular radius.
      await expectVariantFrameGeometry(
        realVariantRow.getByTestId('catalog-detail-variant-image-frame'),
        viewport,
        'the variant media frame',
      )

      // The null-media variant stays icon-only: exact testid and variant-scoped aria-label, no `<img>`,
      // no control at all, and deliberately no visible copy inside the compact 72px frame.
      const nullImageVariantRow = variantRows.filter({ hasText: nullImageVariantName })
      await expect(
        nullImageVariantRow.getByTestId('catalog-detail-variant-image-fallback'),
      ).toBeVisible()
      await expect(
        nullImageVariantRow.getByRole('img', {
          name: `Imagen no disponible para la variante ${nullImageVariantName}`,
          exact: true,
        }),
      ).toBeVisible()
      await expect(nullImageVariantRow.locator('img')).toHaveCount(0)
      await expect(nullImageVariantRow.getByRole('button')).toHaveCount(0)
      // The null-media frame keeps the exact same computed geometry as the real-image frame: the media
      // absence changes the content of the frame, never its shape.
      await expectVariantFrameGeometry(
        nullImageVariantRow.getByTestId('catalog-detail-variant-image-frame'),
        viewport,
        'the null-media variant media frame',
      )

      // Every variant row stays a read-only list item. Only a row with real delivered media may expose
      // exactly one interactive control, and that control is its media-only preview button.
      for (const [index, variant] of targetDetail.variants.entries()) {
        const row = variantRows.nth(index)
        expect(await row.evaluate((element) => element.tagName), 'rows stay list items').toBe('LI')
        const rowMediaControls = row.getByRole('button')
        const rowInteractive = row.locator('button, input, select, textarea, a[href]')
        if (variant.image === null) {
          await expect(rowMediaControls).toHaveCount(0)
          expect(await rowInteractive.count(), 'null variant media stays inert').toBe(0)
        } else {
          await expect(rowMediaControls).toHaveCount(1)
          expect(await rowMediaControls.first().getAttribute('aria-label')).toBe(
            `Ampliar imagen de la variante ${variant.name}`,
          )
          expect(await rowInteractive.count(), 'media is the only control a row may own').toBe(1)
        }
        expect(await row.getAttribute('aria-selected')).toBeNull()
        expect(await row.getAttribute('aria-current')).toBeNull()
      }

      const variantRegionBox = await measurableBox(variantRegion, 'the variant region')
      expect(variantRegionBox.x).toBeGreaterThanOrEqual(0)
      expect(variantRegionBox.x + variantRegionBox.width).toBeLessThanOrEqual(
        viewport.width + OVERFLOW_TOLERANCE_PX,
      )
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.key}-product-detail-populated`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      // The read-only preview is a distinct sibling dialog. Every assertion below drives the real
      // browser surface: keyboard and pointer activation, the delivered URL, the paint order, the 44px
      // close target, containment at this exact viewport, and focus returning to the media control that
      // opened it while the detail underneath stays open.
      const previewDialog = page.getByRole('dialog', { name: previewDialogName, exact: true })
      const previewClose = previewDialog.getByRole('button', {
        name: previewCloseName,
        exact: true,
      })

      // Keyboard activation: Enter on the focused media control opens the preview with no pointer at all.
      await mainPreviewTrigger.press('Enter')
      await expect(previewDialog).toHaveCount(1)
      await expect(previewDialog).toBeVisible()
      await settleModalAnimations(previewDialog)
      // The detail is still on screen underneath: the preview never closes it.
      await expect(page.getByTestId('catalog-detail-split')).toBeVisible()

      // The enlarged view is its own dialog with one close control and no other action at all.
      await expect(previewDialog.getByRole('button')).toHaveCount(1)
      await expect(previewClose).toBeVisible()
      expect(await previewDialog.locator('a[href]').count()).toBe(0)
      for (const role of ['textbox', 'spinbutton', 'checkbox', 'radio', 'combobox'] as const) {
        expect(
          await previewDialog.getByRole(role).count(),
          `the enlarged view must expose no ${role} action`,
        ).toBe(0)
      }
      // The page-wide enabled-control inventory while the preview owns the surface is exact: the
      // isolated application root leaves only the preview's own close control on the whole page. No
      // duplicate, no grid invoker, no detail or shell control surviving behind the enlarged view, and
      // no underlying action newly enabled.
      await expectExactPreviewPageInventory(page)

      // The enlarged image reuses the exact delivered data-URI and the exact delivered alt.
      const enlargedImage = previewDialog.getByRole('img', {
        name: `Imagen de ${targetDetail.name}`,
        exact: true,
      })
      await expect(enlargedImage).toBeVisible()
      await expect(enlargedImage).toHaveAttribute('src', detailImageUrl)
      await expect(enlargedImage).toHaveAttribute('alt', `Imagen de ${targetDetail.name}`)
      // Real overlap proof: inside the shared rectangle of both dialogs the preview must own the hit.
      await expectPreviewPaintsAboveDetail(previewDialogElement(page), detailDialogElement(page))

      // Dialog, enlarged image and close target all fit this viewport with no horizontal overflow, and
      // the enlarged image stays geometrically inside the dialog it is painted in.
      const previewDialogBox = await measurableBox(previewDialog, 'the enlarged image dialog')
      expectInsideViewport(previewDialogBox, viewport, 'the enlarged image dialog')
      const enlargedImageBox = await measurableBox(enlargedImage, 'the enlarged image')
      expectInsideViewport(enlargedImageBox, viewport, 'the enlarged image')
      expect(
        containsBox(previewDialogBox, enlargedImageBox),
        'the enlarged image must stay inside the preview dialog on all four edges',
      ).toBe(true)
      const previewCloseBox = await measurableBox(previewClose, 'the preview close control')
      expectInsideViewport(previewCloseBox, viewport, 'the preview close control')
      expect(previewCloseBox.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
      expect(previewCloseBox.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.key}-product-detail-preview`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      // Escape closes only the preview: the detail survives and focus returns to its own media control.
      await page.keyboard.press('Escape')
      await expect(previewDialog).toBeHidden()
      await expect(mainPreviewTrigger).toBeFocused()
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', { name: targetDetail.name, exact: true }),
      ).toBeVisible()

      // The custom close control runs the same contract for the real variant media.
      await realVariantTrigger.click()
      await expect(previewDialog).toBeVisible()
      await settleModalAnimations(previewDialog)
      const enlargedVariantImage = previewDialog.getByRole('img', {
        name: `Imagen de la variante ${realVariantName}`,
        exact: true,
      })
      await expect(enlargedVariantImage).toBeVisible()
      await expect(enlargedVariantImage).toHaveAttribute('src', detailImageUrl)
      await expect(enlargedVariantImage).toHaveAttribute(
        'alt',
        `Imagen de la variante ${realVariantName}`,
      )
      await previewClose.click()
      await expect(previewDialog).toBeHidden()
      await expect(realVariantTrigger).toBeFocused()
      await expect(dialog).toBeVisible()

      // Outside interaction dismisses the preview too, and still never the detail behind it. One
      // deterministic viewport owns that evidence: at desktop width the centred detail dialog never
      // reaches the viewport corner used for the outside pointer interaction.
      if (viewport.key === 'desktop') {
        await mainPreviewTrigger.click()
        await expect(previewDialog).toBeVisible()
        await settleModalAnimations(previewDialog)
        // The outside interaction only proves dismissal when the point really is outside both dialogs.
        const outsidePoint = { x: 16, y: 16 }
        const previewRect = await measurableBox(
          previewDialogElement(page),
          'the enlarged image dialog',
        )
        const detailRect = await measurableBox(detailDialogElement(page), 'the detail dialog')
        expect(
          isOutsideBox(outsidePoint, previewRect),
          'the outside point must fall outside the enlarged image dialog',
        ).toBe(true)
        expect(
          isOutsideBox(outsidePoint, detailRect),
          'the outside point must fall outside the product detail dialog',
        ).toBe(true)
        await page.mouse.click(outsidePoint.x, outsidePoint.y)
        await expect(previewDialog).toBeHidden()
        await expect(mainPreviewTrigger).toBeFocused()
        await expect(dialog).toBeVisible()
      }

      // No preview interaction reached the network: the ledger is still exactly one detail read.
      await traffic.flush()
      expect(traffic.detail).toEqual([
        anonymousRequest(detailPathname(targetProductId), { priceListId }),
      ])
      expectExactCatalogTraffic(strictNetwork, targetProductId, 1)

      // Escape closes the dialog and focus returns to the exact product control that opened it, after
      // every preview interaction above.
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
      expect(traffic.priceContexts).toEqual([anonymousRequest(priceContextsPathname)])
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

      // No media was invented: the reserved detail slot falls back safely and says so visibly.
      const filteredImageFallback = dialog.getByTestId('catalog-detail-image-fallback')
      await expect(filteredImageFallback).toBeVisible()
      await expect(
        dialog.getByRole('img', {
          name: `Imagen no disponible para ${hiddenDetail.name}`,
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        filteredImageFallback.getByText('Imagen no disponible', { exact: true }),
      ).toBeVisible()
      expect(
        await dialog.locator('[data-testid="catalog-detail-image-frame"] img').count(),
        'the product-level no-image frame must never render an `<img>`',
      ).toBe(0)

      // A product published with neither description nor variants explains the sparse panel instead of
      // leaving an unexplained blank area.
      const emptyDetailNote = dialog.getByTestId('catalog-detail-empty-note')
      await expect(emptyDetailNote).toBeVisible()
      await expect(
        emptyDetailNote.getByRole('heading', { name: 'Sin información adicional', exact: true }),
      ).toBeVisible()
      await expect(
        emptyDetailNote.getByText(
          'Por ahora no hay descripción ni variantes publicadas para este producto.',
          { exact: true },
        ),
      ).toBeVisible()
      // The details column scrolls inside the dialog body, so the note is brought into view before it is
      // measured: bounded geometry means inside this viewport, not merely rendered somewhere below it.
      await emptyDetailNote.scrollIntoViewIfNeeded()
      expectInsideViewport(
        await measurableBox(emptyDetailNote, 'the sparse-detail note'),
        viewport,
        'the sparse-detail note',
      )

      // Hidden price never becomes "$0" and hidden stock never becomes a quantity or a stock claim.
      expect(await dialog.getByText(/\$/).count()).toBe(0)
      for (const claim of ['Disponible', 'Pocas piezas', 'Agotado']) {
        expect(await dialog.getByText(claim, { exact: true }).count(), `no ${claim} claim`).toBe(0)
      }
      expect(await dialog.getByText(/\d+\s*unidades/).count()).toBe(0)
      expect(
        await dialog.getByText(/sin existencia|out of stock|no disponible para venta/i).count(),
      ).toBe(0)

      // The unavailable detail still adds no commerce, auth, search, filter or speculative action, and
      // it has no delivered media, so it earns no media-only preview control either.
      await expectDialogAddsNoActionBesidesMedia(page, [hiddenProduct.name])

      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.key}-product-detail-hidden`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await traffic.flush()
      expect(traffic.branches).toEqual([anonymousRequest(branchesPathname)])
      expect(traffic.priceContexts).toEqual([anonymousRequest(priceContextsPathname)])
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
      expect(traffic.priceContexts).toEqual([anonymousRequest(priceContextsPathname)])
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
      await expectDialogAddsNoActionBesidesMedia(page, [targetProduct.name], { retryOffered: true })

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
