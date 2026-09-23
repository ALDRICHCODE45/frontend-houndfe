import type { Locator, Page } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { DeclaredRoute } from '../fixtures/network'

const centro = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }
const norte = { id: 'b-2', name: 'Sucursal Norte', slug: 'norte', address: null, phone: null }
const priceContext = { priceListId: 'list-1', name: 'Lista pública', isCatalogDefault: true }
const visibleProduct = {
  id: 'product-1',
  name: 'Café molido',
  slug: null,
  description: null,
  category: { id: 'coffee', name: 'Café' },
  brand: { name: 'Tostadores' },
  image: { url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' },
  price: { fromPriceCents: 2599, priceCents: 2599, hidden: false },
  availability: 'available',
  stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null },
  hasVariants: false,
  rating: null,
  featuredLabel: null,
}
const productPage = (items: readonly unknown[] = [visibleProduct]) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: items.length === 0 ? 0 : 1 },
  facets: { categories: [] },
  excludedCount: 0,
  priceContext,
})
const branchRoute = (branches = [centro]): DeclaredRoute => ({
  method: 'GET',
  path: '/public/catalog/branches',
  json: branches,
  count: 1,
})
const productRoute = (
  slug: string,
  route: Omit<DeclaredRoute, 'method' | 'path'>,
): DeclaredRoute => ({ method: 'GET', path: `/public/catalog/${slug}/products`, ...route })
/** Anonymous tenant-scoped discovery always precedes the anonymous product list for the same branch. */
const priceContextsRoute = (slug: string, count = 1): DeclaredRoute => ({
  method: 'GET',
  path: `/public/catalog/${slug}/price-contexts`,
  json: [priceContext],
  count,
})

function expectOnlyCatalogRequests(
  strictNetwork: {
    requests(): readonly {
      method: string
      path: string
      query: Readonly<Record<string, string>>
      body: unknown
    }[]
    violations(): readonly string[]
  },
  expected: readonly string[],
) {
  expect(strictNetwork.requests().map((request) => request.path)).toEqual(expected)
  expect(
    strictNetwork
      .requests()
      .every(
        (request) =>
          request.method === 'GET' &&
          Object.keys(request.query).length === 0 &&
          request.body === undefined,
      ),
  ).toBe(true)
  expect(strictNetwork.violations()).toEqual([])
}

/** Sub-pixel CSS-px rounding tolerance for the horizontal containment measurements below. */
const OVERFLOW_TOLERANCE_PX = 1

async function measurableBox(locator: Locator, label: string) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`${label} rendered without a measurable box`)
  return box
}

const branchTrigger = (page: Page): Locator =>
  page.getByRole('button', { name: 'Explorar sucursales', exact: true })

/** Branch choices only exist inside the closed-by-default `Seleccionar sucursal` dialog. */
async function selectBranch(page: Page, name: string): Promise<void> {
  await branchTrigger(page).click()
  await page
    .getByRole('dialog', { name: 'Seleccionar sucursal', exact: true })
    .getByRole('button', { name, exact: true })
    .click()
}

test.describe('public catalog product selection', () => {
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { json: productPage(), count: 1 }),
      ],
    },
  })

  test('clicking a discovered branch uses only the anonymous first-page request and renders the returned card', async ({
    page,
    strictNetwork,
  }, testInfo) => {
    const productRequests: Array<{
      url: string
      authorization: string | undefined
      body: string | null
    }> = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname.endsWith('/public/catalog/centro/products'))
        productRequests.push({
          url: request.url(),
          authorization: request.headers().authorization,
          body: request.postData(),
        })
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo?source=responsive#products`)
    await selectBranch(page, centro.name)

    await expect(page).toHaveURL(`${RESPONSIVE_ORIGIN}/catalogo/centro?source=responsive#products`)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(branchTrigger(page)).toContainText(centro.name)
    await expect(page.getByRole('heading', { name: visibleProduct.name })).toBeVisible()
    await expect(page.getByText('$25.99')).toBeVisible()
    await testInfo.attach('catalog-products-desktop', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

    expect(productRequests).toEqual([
      {
        url: `${RESPONSIVE_ORIGIN}/__e2e-api/public/catalog/centro/products`,
        authorization: undefined,
        body: null,
      },
    ])
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

test.describe('public catalog direct URL presentation', () => {
  const hiddenProduct = {
    ...visibleProduct,
    id: 'product-hidden',
    name: 'Producto sin imagen ni precio público',
    image: null,
    price: { fromPriceCents: null, priceCents: null, hidden: true },
    availability: null,
    stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
  }
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { json: productPage([hiddenProduct]), count: 1 }),
      ],
    },
  })

  test('renders valid nullable availability successfully with neutral hidden stock, image fallback, and hidden price', async ({
    page,
    strictNetwork,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)

    await expect(page.getByRole('heading', { name: hiddenProduct.name })).toBeVisible()
    await expect(page.getByText('Consultar precio')).toBeVisible()

    // A null list image renders the honest fallback and never invents an `<img>` for that card.
    const card = page.locator(`[data-catalog-product-id="${hiddenProduct.id}"]`)
    const fallback = card.getByTestId('catalog-product-image-fallback')
    await expect(fallback).toBeVisible()
    await expect(
      card.getByRole('img', {
        name: `Imagen no disponible para ${hiddenProduct.name}`,
        exact: true,
      }),
    ).toBeVisible()
    await expect(fallback.getByText('Imagen no disponible', { exact: true })).toBeVisible()
    await expect(card.locator('img')).toHaveCount(0)
    await expect(page.getByText(/\$0/)).toHaveCount(0)
    await expect(page.getByText(/Disponible|Pocas piezas|Agotado|unidades/)).toHaveCount(0)
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375)
    await testInfo.attach('catalog-products-mobile-hidden-price', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

test.describe('public catalog empty products', () => {
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { json: productPage([]), count: 1 }),
      ],
    },
  })

  test('renders a successful empty first page', async ({ page, strictNetwork }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)

    await expect(
      page.getByRole('heading', { name: 'Esta sucursal todavía no tiene productos publicados' }),
    ).toBeVisible()
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

test.describe('public catalog custom quantity', () => {
  const quantityProduct = {
    ...visibleProduct,
    id: 'product-quantity',
    availability: null,
    stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 },
  }
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { json: productPage([quantityProduct]), count: 1 }),
      ],
    },
  })

  test('renders CUSTOM_QUANTITY zero without calling it out of stock', async ({
    page,
    strictNetwork,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)

    await expect(page.getByText('0 unidades')).toBeVisible()
    await expect(page.getByText(/Disponible|Pocas piezas|Agotado/)).toHaveCount(0)
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

test.describe('public catalog aggregate custom quantity', () => {
  const aggregateQuantityProduct = {
    ...visibleProduct,
    id: 'product-aggregate-quantity',
    availability: 'low_stock',
    stockPresentation: { mode: 'CUSTOM_QUANTITY', status: 'low_stock', customQuantity: null },
  }
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { json: productPage([aggregateQuantityProduct]), count: 1 }),
      ],
    },
  })

  test('renders the variant aggregate status when CUSTOM_QUANTITY has no individual quantity', async ({
    page,
    strictNetwork,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)

    await expect(page.getByText('Pocas piezas')).toBeVisible()
    await expect(page.getByText('unidades')).toHaveCount(0)
    await testInfo.attach('catalog-products-mobile-aggregate-custom-quantity', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

test.describe('public catalog unknown selection', () => {
  test.use({ declaredRoutes: { routes: [branchRoute()] } })

  test('keeps an unknown 320px slug invalid without requesting products', async ({
    page,
    strictNetwork,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/desconocida`)
    await expect(
      page.getByRole('heading', { name: 'Esta sucursal no está disponible' }),
    ).toBeVisible()
    expectOnlyCatalogRequests(strictNetwork, ['/public/catalog/branches'])
  })
})

test.describe('public catalog product loading', () => {
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { deferred: true, json: productPage(), count: 1 }),
      ],
    },
  })

  test('shows loading while the declared product response is held, then renders the card', async ({
    page,
    strictNetwork,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)
    await expect(page.getByRole('heading', { name: 'Cargando productos…' })).toBeVisible()
    await strictNetwork.releaseDeferred()
    await expect(page.getByRole('heading', { name: visibleProduct.name })).toBeVisible()
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

for (const [status, message] of [
  [429, 'Demasiadas solicitudes. Intenta de nuevo más tarde.'],
  [500, 'No pudimos cargar los productos.'],
] as const) {
  test.describe(`public catalog ${status} recovery`, () => {
    test.use({
      declaredRoutes: {
        routes: [
          branchRoute(),
          priceContextsRoute('centro'),
          productRoute('centro', {
            status,
            json: { message: 'retryable product failure' },
            count: 2,
          }),
        ],
      },
    })

    test('exposes a focusable retry control that reissues the isolated product request', async ({
      page,
      strictNetwork,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)
      const retry = page.getByRole('button', { name: 'Reintentar productos' })
      await expect(page.getByText(message)).toBeVisible()
      await retry.focus()
      await expect(retry).toBeFocused()
      await retry.click()
      await expect
        .poll(
          () =>
            strictNetwork
              .requests()
              .filter((request) => request.path === '/public/catalog/centro/products').length,
        )
        .toBe(2)
      expectOnlyCatalogRequests(strictNetwork, [
        '/public/catalog/branches',
        '/public/catalog/centro/price-contexts',
        '/public/catalog/centro/products',
        '/public/catalog/centro/products',
      ])
    })
  })
}

test.describe('public catalog network recovery', () => {
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { json: productPage(), count: 1 }),
      ],
    },
  })

  test('recovers from a first transport abort through the guarded retry control', async ({
    page,
    strictNetwork,
  }) => {
    const productPattern = '**/__e2e-api/public/catalog/centro/products'
    let productAttempts = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/public/catalog/centro/products'))
        productAttempts++
    })
    await page.route(productPattern, (route) => route.abort('failed'))
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)
    await expect(page.getByText('No se pudo conectar. Revisa tu conexión.')).toBeVisible()
    await page.unroute(productPattern)
    await page.getByRole('button', { name: 'Reintentar productos' }).click()
    await expect(page.getByRole('heading', { name: visibleProduct.name })).toBeVisible()
    expect(productAttempts).toBe(2)
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

/**
 * Structural media and category-surface evidence at the three responsive widths the catalog owns.
 *
 * The category band must stay a transparent full-bleed container: no rendered bottom border, no
 * divider shadow, exactly one contained toolbar child, and a toolbar that is strictly inset from both
 * viewport edges so no page-wide rule can reappear. Every measurement below is a rendered box or a
 * computed style, never a class string.
 */
for (const viewport of [
  { key: 'compact', width: 320, height: 568 },
  { key: 'mobile', width: 375, height: 667 },
  { key: 'desktop', width: 1280, height: 800 },
] as const) {
  test.describe(`public catalog category surface at ${viewport.key}`, () => {
    test.use({
      declaredRoutes: {
        routes: [
          branchRoute(),
          priceContextsRoute('centro'),
          productRoute('centro', { json: productPage(), count: 1 }),
        ],
      },
    })

    test('renders the real card image and one strictly inset toolbar without a full-width divider', async ({
      page,
      strictNetwork,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)

      // The real list image renders from the exact declared URL under its product-scoped alt, so the
      // fallback branch is provably not the rendered one.
      const card = page.locator(`[data-catalog-product-id="${visibleProduct.id}"]`)
      await expect(card).toBeVisible()
      const image = card.getByRole('img', {
        name: `Imagen de ${visibleProduct.name}`,
        exact: true,
      })
      await expect(image).toBeVisible()
      await expect(image).toHaveAttribute('src', visibleProduct.image.url)
      await expect(card.getByTestId('catalog-product-image-fallback')).toHaveCount(0)

      const bar = page.getByTestId('catalog-category-bar')
      await expect(bar).toHaveCount(1)
      const band = await bar.evaluate((element) => {
        const style = getComputedStyle(element)
        const bandWidth = element.getBoundingClientRect().width
        // Tailwind preflight makes `border-style: solid` and `border-width: 0` the global default, so
        // the rendered width is the only honest signal: a re-added `border-b` or a bordered divider
        // child would show up here as a non-zero, near-full-band bottom border.
        const fullWidthBottomBorders = [element, ...Array.from(element.querySelectorAll('*'))]
          .filter(
            (node) =>
              Number.parseFloat(getComputedStyle(node).borderBottomWidth) > 0 &&
              node.getBoundingClientRect().width >= bandWidth * 0.9,
          )
          .map((node) => node.getAttribute('data-testid') ?? node.tagName)
        return {
          children: Array.from(element.children).map((child) => child.getAttribute('data-testid')),
          bottomBorderWidthPx: Number.parseFloat(style.borderBottomWidth),
          boxShadow: style.boxShadow,
          fullWidthBottomBorders,
        }
      })
      expect(band.children, 'the band must own exactly its contained toolbar child').toEqual([
        'catalog-category-toolbar',
      ])
      expect(band.bottomBorderWidthPx, 'the band itself must render no bottom border').toBe(0)
      expect(
        band.fullWidthBottomBorders,
        'no full-width divider may render inside the band',
      ).toEqual([])
      expect(band.boxShadow, 'the band must render no divider shadow').toBe('none')

      const toolbar = page.getByTestId('catalog-category-toolbar')
      await expect(toolbar).toHaveCount(1)
      await expect(bar.getByTestId('catalog-category-toolbar')).toHaveCount(1)

      const toolbarBox = await measurableBox(toolbar, 'the category toolbar')
      expect(
        toolbarBox.x,
        'the toolbar must be strictly inset from the left viewport edge',
      ).toBeGreaterThan(0)
      expect(
        toolbarBox.x + toolbarBox.width,
        'the toolbar must be strictly inset from the right viewport edge',
      ).toBeLessThan(viewport.width)
      expect(toolbarBox.x, 'the toolbar must stay inside the viewport').toBeGreaterThanOrEqual(0)
      expect(
        toolbarBox.x + toolbarBox.width,
        'the toolbar must stay inside the viewport',
      ).toBeLessThanOrEqual(viewport.width + OVERFLOW_TOLERANCE_PX)
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)

      await testInfo.attach(`catalog-category-surface-${viewport.key}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
      expectOnlyCatalogRequests(strictNetwork, [
        '/public/catalog/branches',
        '/public/catalog/centro/price-contexts',
        '/public/catalog/centro/products',
      ])
    })
  })
}

/**
 * Media failure transition owned by the browser: the declared card image is an undecodable `data:`
 * payload, so the load fails locally and the honest fallback replaces the broken `<img>` with no wire
 * request at all. A same-origin 404 would exercise the same branch, but it would depend on the dev
 * server response for image paths; the local decode failure keeps the strict ledger provably identical.
 */
test.describe('public catalog card media failure', () => {
  const undecodableImageProduct = {
    ...visibleProduct,
    id: 'product-undecodable-image',
    name: 'Producto con imagen ilegible',
    image: { url: 'data:image/png;base64,AAAA' },
  }
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute(),
        priceContextsRoute('centro'),
        productRoute('centro', { json: productPage([undecodableImageProduct]), count: 1 }),
      ],
    },
  })

  test('replaces an undecodable image with the honest fallback and no extra network traffic', async ({
    page,
    strictNetwork,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)

    const card = page.locator(`[data-catalog-product-id="${undecodableImageProduct.id}"]`)
    const fallback = card.getByTestId('catalog-product-image-fallback')
    await expect(fallback).toBeVisible()
    await expect(
      card.getByRole('img', {
        name: `Imagen no disponible para ${undecodableImageProduct.name}`,
        exact: true,
      }),
    ).toBeVisible()
    await expect(fallback.getByText('Imagen no disponible', { exact: true })).toBeVisible()
    await expect(card.locator('img')).toHaveCount(0)

    await testInfo.attach('catalog-products-undecodable-image', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
    ])
  })
})

test.describe('public catalog browser history', () => {
  const centroProduct = { ...visibleProduct, id: 'centro-product', name: 'Producto Centro' }
  const norteProduct = { ...visibleProduct, id: 'norte-product', name: 'Producto Norte' }
  test.use({
    declaredRoutes: {
      routes: [
        branchRoute([centro, norte]),
        priceContextsRoute('centro', 2),
        priceContextsRoute('norte', 2),
        productRoute('centro', { json: productPage([centroProduct]), count: 2 }),
        productRoute('norte', { json: productPage([norteProduct]), count: 2 }),
      ],
    },
  })

  test('synchronizes selected branch and product through browser back and forward', async ({
    page,
    strictNetwork,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)
    await expect(page.getByRole('heading', { name: centroProduct.name })).toBeVisible()
    await selectBranch(page, norte.name)
    await expect(page.getByRole('heading', { name: norteProduct.name })).toBeVisible()
    await page.goBack()
    await expect(branchTrigger(page)).toContainText(centro.name)
    await expect(page.getByRole('heading', { name: centroProduct.name })).toBeVisible()
    await page.goForward()
    await expect(branchTrigger(page)).toContainText(norte.name)
    await expect(page.getByRole('heading', { name: norteProduct.name })).toBeVisible()
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
      '/public/catalog/norte/price-contexts',
      '/public/catalog/norte/products',
      '/public/catalog/centro/price-contexts',
      '/public/catalog/centro/products',
      '/public/catalog/norte/price-contexts',
      '/public/catalog/norte/products',
    ])
  })
})
