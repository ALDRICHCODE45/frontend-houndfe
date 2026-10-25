// Run against an existing build: node --test e2e/responsive/catalog-controls.test.mjs
// Public API responses are isolated in the browser; no database writes or server startup.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

let browser
before(async () => {
  browser = await chromium.launch()
})
after(async () => {
  await browser?.close()
})
const origin = process.env.CATALOG_TEST_URL || 'http://localhost:4173'
const contexts = [
  { priceListId: 'list-public', name: 'Público', isCatalogDefault: true },
  { priceListId: 'list-wholesale', name: 'Mayoreo para negocios', isCatalogDefault: false },
]
const categories = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Alimento para perro', count: 3 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Alimento para gato', count: 1 },
]
const products = ['Croqueta adulto', 'Croqueta cachorro', 'Croqueta felina', 'Premio dental'].map(
  (name, index) => ({
    id: `product-${index}`,
    name,
    slug: null,
    description: null,
    category: categories[index === 2 ? 1 : 0],
    brand: null,
    image: null,
    price: { fromPriceCents: 10000, priceCents: 10000, hidden: false },
    availability: 'available',
    stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null },
    hasVariants: false,
    rating: null,
    featuredLabel: null,
  }),
)
async function openCatalog(width, count = 1, populated = false) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const branches = Array.from({ length: count }, (_, i) => ({
    id: `branch-${i}`,
    slug: i ? 'norte' : 'centro',
    name: i ? 'Sucursal Norte' : 'Sucursal Centro',
    address: null,
    phone: null,
  }))
  const requests = []
  const ledger = []
  const unexpected = []
  await page.route('**/public/catalog/**', async (route) => {
    const request = route.request()
    requests.push(request.method())
    const url = new URL(request.url())
    ledger.push({ method: request.method(), url: request.url() })
    if (
      request.method() !== 'GET' ||
      !/^\/public\/catalog\/(branches|(?:centro|norte)\/(?:price-contexts|products))$/.test(
        url.pathname,
      )
    ) {
      unexpected.push(request.url())
      return route.abort()
    }
    const items = populated
      ? products.filter(
          (product) =>
            (!url.searchParams.get('q') ||
              product.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) &&
            (!url.searchParams.get('categoryId') ||
              product.category.id === url.searchParams.get('categoryId')),
        )
      : []
    const priceContext =
      contexts.find((item) => item.priceListId === url.searchParams.get('priceListId')) ||
      contexts[0]
    const body = url.pathname.endsWith('/branches')
      ? branches
      : url.pathname.endsWith('/price-contexts')
        ? contexts
        : {
            items,
            meta: { page: 1, limit: 20, total: items.length, totalPages: items.length ? 1 : 0 },
            facets: {
              categories: populated
                ? categories.map((category) => ({
                    ...category,
                    count: items.filter((item) => item.category.id === category.id).length,
                  }))
                : [],
            },
            excludedCount: 0,
            priceContext,
          }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  await page.goto(`${origin}/catalogo/centro`)
  await expect(page.getByRole('button', { name: 'Lista de precios', exact: true })).toBeEnabled()
  return {
    page,
    requests,
    ledger,
    close: async () => {
      await context.close()
      assert.deepEqual(unexpected, [], 'unexpected public API requests were blocked')
    },
  }
}

for (const width of [320, 390, 1440]) {
  test(`${width}: price options receive real pointer and keyboard selection`, async () => {
    const { page, requests, close } = await openCatalog(width)
    try {
      const trigger = page.getByRole('button', { name: 'Lista de precios', exact: true })
      await trigger.click()
      await page.getByRole('option', { name: 'Mayoreo para negocios' }).click({ timeout: 2500 })
      await expect(page).toHaveURL(/priceListId=list-wholesale/)
      await expect(trigger).toBeFocused()
      await trigger.press('Enter')
      const search = page.getByRole('combobox')
      await search.fill('Público')
      await search.press('ArrowDown')
      await search.press('Enter')
      await expect(page).toHaveURL(/priceListId=list-public/)
      assert(requests.every((method) => method === 'GET'))
    } finally {
      await close()
    }
  })

  test(`${width}: popup owns modern geometry, readable search and touch targets`, async () => {
    const { page, close } = await openCatalog(width)
    try {
      const trigger = page.getByRole('button', { name: 'Lista de precios', exact: true })
      await trigger.click()
      const popup = page.locator('.catalog-price-popup')
      await expect(popup).toBeVisible()
      await expect(popup).toHaveCSS('border-radius', '12px')
      await expect(trigger).toHaveCSS('border-radius', '6px')
      // Measure settled geometry, not the scale-in animation's intermediate frame.
      await expect.poll(async () => (await popup.boundingBox()).width).toBeGreaterThanOrEqual(224)
      for (const option of await page.getByRole('option').all()) {
        assert((await option.boundingBox()).height >= 44)
      }
      const search = popup.getByRole('combobox')
      await search.fill('Mayoreo')
      await expect(page.getByRole('option')).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
    } finally {
      await close()
    }
  })

  test(`${width}: branch backdrop covers the entire hero and traps/restores focus`, async () => {
    const { page, close } = await openCatalog(width)
    try {
      const trigger = page.getByRole('button', { name: 'Explorar sucursales', exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: 'Seleccionar sucursal', exact: true })
      await expect(dialog).toHaveCSS('opacity', '1')
      await expect(page.locator('.catalog-hero')).toHaveCSS('isolation', 'isolate')
      const overlay = page.locator('.catalog-branch-overlay')
      await expect(overlay).toHaveCSS('z-index', '40')
      await expect(dialog).toHaveCSS('z-index', '50')
      const box = await overlay.boundingBox()
      assert.deepEqual(box, { x: 0, y: 0, width, height: 900 })
      await page.keyboard.press('Tab')
      assert(await dialog.evaluate((el) => el.contains(document.activeElement)))
      await page.mouse.wheel(0, 600)
      assert.equal(await page.evaluate(() => window.scrollY), 0)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
    } finally {
      await close()
    }
  })

  for (const count of [1, 2])
    test(`${width}: ${count} branch rows use full width and coherent radii`, async () => {
      const { page, close } = await openCatalog(width, count)
      try {
        await page.getByRole('button', { name: 'Explorar sucursales', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Seleccionar sucursal', exact: true })
        await expect(dialog).toHaveCSS('opacity', '1')
        await expect(dialog).toHaveCSS('border-radius', '12px')
        const list = dialog.getByRole('list', { name: 'Sucursales disponibles' })
        const row = list.getByRole('button').first()
        assert(Math.abs((await row.boundingBox()).width - (await list.boundingBox()).width) < 2)
        await expect(row).toHaveCSS('border-radius', '6px')
        const closeButton = dialog.getByRole('button', {
          name: 'Cerrar selección de sucursal',
          exact: true,
        })
        assert((await closeButton.boundingBox()).height >= 44)
        await closeButton.click()
        await expect(dialog).toHaveCount(0)
        await expect(
          page.getByRole('button', { name: 'Explorar sucursales', exact: true }),
        ).toBeFocused()
      } finally {
        await close()
      }
    })
}

for (const width of [320, 390, 768, 1440]) {
  test(`${width}: discovery controls stay compact, contained and keyboard reachable`, async () => {
    const { page, close } = await openCatalog(width, 1, true)
    try {
      await expect(page.getByText('4 productos', { exact: true })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const input = page.getByLabel('Buscar productos o marcas')
      const submit = page.getByRole('button', { name: 'Buscar', exact: true })
      const clear = page.getByRole('button', { name: 'Limpiar búsqueda', exact: true })
      const labelBox = await page.locator('label[for="catalog-search"]').boundingBox()
      const inputBox = await input.boundingBox()
      const submitBox = await submit.boundingBox()
      const clearBox = await clear.boundingBox()
      assert(Math.abs(inputBox.y - submitBox.y) < 1)
      assert(labelBox.y + labelBox.height <= inputBox.y)
      assert(clearBox.y + clearBox.height <= inputBox.y)
      assert(clearBox.x >= labelBox.x + labelBox.width)
      await expect(input).toHaveCSS('font-size', '14px')
      await expect(input).toHaveCSS('border-radius', '6px')
      const category = page.getByRole('button', {
        name: 'Categoría Alimento para perro',
        exact: true,
      })
      await expect(category).toHaveCSS('font-size', '12px')
      for (const control of await page
        .locator('.catalog-search input, .catalog-search button, .catalog-category-controls button')
        .all()) {
        const box = await control.boundingBox()
        assert(box.height >= 44 && box.x >= 0 && box.x + box.width <= width)
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await input.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(input).toBeFocused()
      await expect(input).toHaveCSS('outline-style', 'solid')
      for (const control of [
        submit,
        clear,
        page.getByRole('button', { name: 'Todas las categorías', exact: true }),
        category,
      ]) {
        await page.keyboard.press('Tab')
        await expect(control).toBeFocused()
        await expect(control).toHaveCSS('outline-style', 'solid')
      }
      const unselectedBackground = await category.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      await category.press('Enter')
      await expect(category).toHaveAttribute('aria-pressed', 'true')
      assert.notEqual(
        await category.evaluate((el) => getComputedStyle(el).backgroundColor),
        unselectedBackground,
      )
    } finally {
      await close()
    }
  })

  test(`${width}: discovery submits, combines, clears and restores history without typing requests`, async () => {
    const { page, ledger, close } = await openCatalog(width, 1, true)
    try {
      const input = page.getByLabel('Buscar productos o marcas')
      const dog = page.getByRole('button', { name: 'Categoría Alimento para perro', exact: true })
      const cards = page.getByRole('button', { name: /^Ver detalles de / })
      const expectCards = async (names) => {
        await expect(cards).toHaveCount(names.length)
        for (const name of names)
          await expect(
            page.getByRole('button', { name: `Ver detalles de ${name}`, exact: true }),
          ).toBeVisible()
      }
      await expectCards(products.map((product) => product.name))
      const before = ledger.length
      const initialURL = page.url()
      await input.pressSequentially('croqueta')
      assert.equal(page.url(), initialURL)
      assert.equal(ledger.length, before)
      await input.press('Enter')
      await expect(page).toHaveURL(/q=croqueta/)
      await expectCards(products.slice(0, 3).map((product) => product.name))
      await expect(page.getByText('3 productos', { exact: true })).toBeVisible()
      await dog.click()
      await expect(page).toHaveURL(new RegExp(`categoryId=${categories[0].id}`))
      await expect(dog).toHaveAttribute('aria-pressed', 'true')
      await expectCards(products.slice(0, 2).map((product) => product.name))
      await expect(page.getByText('2 productos', { exact: true })).toBeVisible()
      await expect(dog).toHaveText('Alimento para perro 3')
      await expect(
        page.getByRole('button', { name: 'Todas las categorías', exact: true }),
      ).toHaveText('Todas 4')
      await page.getByRole('button', { name: 'Limpiar categoría', exact: true }).press('Enter')
      await expectCards(products.slice(0, 3).map((product) => product.name))
      assert.equal(new URL(page.url()).searchParams.get('q'), 'croqueta')
      assert.equal(new URL(page.url()).searchParams.has('categoryId'), false)
      await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click()
      await expectCards(products.map((product) => product.name))
      await expect(input).toHaveValue('')
      assert.equal(new URL(page.url()).search, '')
      await page.goBack()
      await expect(input).toHaveValue('croqueta')
      await expectCards(products.slice(0, 3).map((product) => product.name))
      await page.goBack()
      await expect(dog).toHaveAttribute('aria-pressed', 'true')
      await expectCards(products.slice(0, 2).map((product) => product.name))
      await page.goForward()
      await expect(dog).toHaveAttribute('aria-pressed', 'false')
      await expect(input).toHaveValue('croqueta')
      await expectCards(products.slice(0, 3).map((product) => product.name))
      assert(ledger.every((entry) => entry.method === 'GET'))
      const queries = ledger
        .filter((entry) => new URL(entry.url).pathname.endsWith('/products'))
        .map((entry) => new URL(entry.url).searchParams)
      assert(queries.some((query) => query.get('q') === 'croqueta' && !query.has('categoryId')))
      assert(
        queries.some(
          (query) => query.get('q') === 'croqueta' && query.get('categoryId') === categories[0].id,
        ),
      )
    } finally {
      await close()
    }
  })
}
