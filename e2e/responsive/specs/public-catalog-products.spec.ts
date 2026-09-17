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

test.describe('public catalog product selection', () => {
  test.use({
    declaredRoutes: {
      routes: [branchRoute(), productRoute('centro', { json: productPage(), count: 1 })],
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
    await page.getByRole('button', { name: centro.name }).click()

    await expect(page).toHaveURL(`${RESPONSIVE_ORIGIN}/catalogo/centro?source=responsive#products`)
    await expect(page.getByRole('button', { name: centro.name })).toHaveAttribute(
      'aria-current',
      'page',
    )
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
    await expect(page.getByTestId('catalog-product-image-fallback')).toBeVisible()
    await expect(page.getByText(/\$0/)).toHaveCount(0)
    await expect(page.getByText(/Disponible|Pocas piezas|Agotado|unidades/)).toHaveCount(0)
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375)
    await testInfo.attach('catalog-products-mobile-hidden-price', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/products',
    ])
  })
})

test.describe('public catalog empty products', () => {
  test.use({
    declaredRoutes: {
      routes: [branchRoute(), productRoute('centro', { json: productPage([]), count: 1 })],
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
        '/public/catalog/centro/products',
        '/public/catalog/centro/products',
      ])
    })
  })
}

test.describe('public catalog network recovery', () => {
  test.use({
    declaredRoutes: {
      routes: [branchRoute(), productRoute('centro', { json: productPage(), count: 1 })],
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
    await page.getByRole('button', { name: norte.name }).click()
    await expect(page.getByRole('heading', { name: norteProduct.name })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('button', { name: centro.name })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('heading', { name: centroProduct.name })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('button', { name: norte.name })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('heading', { name: norteProduct.name })).toBeVisible()
    expectOnlyCatalogRequests(strictNetwork, [
      '/public/catalog/branches',
      '/public/catalog/centro/products',
      '/public/catalog/norte/products',
      '/public/catalog/centro/products',
      '/public/catalog/norte/products',
    ])
  })
})
