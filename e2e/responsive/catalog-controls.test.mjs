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
async function openCatalog(width, count = 1) {
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
  await page.route('**/public/catalog/**', async (route) => {
    const request = route.request()
    requests.push(request.method())
    const url = new URL(request.url())
    const priceContext =
      contexts.find((item) => item.priceListId === url.searchParams.get('priceListId')) ||
      contexts[0]
    const body = url.pathname.endsWith('/branches')
      ? branches
      : url.pathname.endsWith('/price-contexts')
        ? contexts
        : {
            items: [],
            meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
            facets: { categories: [] },
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
  return { page, requests, close: () => context.close() }
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
