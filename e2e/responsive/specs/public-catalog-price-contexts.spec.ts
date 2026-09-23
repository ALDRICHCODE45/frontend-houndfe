/**
 * PC4 responsive evidence for the public catalog price-context selector.
 *
 * Strict `/__e2e-api/**` declarations prove the real browser contract at 320/375/1280, in light and
 * dark mode: the header exposes the discovered contexts through one accessible `Lista de precios`
 * control that starts on the tenant default (PUBLICO), keeps a real 44px target and never overflows
 * its header or the viewport. Selecting the alternative (Mayoreo) through the real Nuxt UI popup
 * writes only that exact `priceListId` while preserving an unrelated query and the hash, and the list
 * refetch carries exactly one query parameter with no credential headers and no request body. The
 * strict ledger stays ordered branch discovery → price-context discovery → default list → explicit
 * Mayoreo list with no undeclared, exceeded or external request. Only semantic fixture ids are used:
 * no production identifier is hardcoded.
 */
import type { Locator } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { DeclaredRoute } from '../fixtures/network'

/** Sub-pixel CSS-px rounding tolerance for the containment measurements below. */
const OVERFLOW_TOLERANCE_PX = 1
/** WCAG 2.2 target size (minimum): the selector trigger must measure at least this square. */
const MIN_TARGET_PX = 44
/** Ordinary Playwright wait budget for the first application render. It is a wait, never a retry. */
const APP_SHELL_TIMEOUT_MS = 20_000

const viewports = [
  { key: 'compact', width: 320, height: 568 },
  { key: 'mobile', width: 375, height: 667 },
  { key: 'desktop', width: 1280, height: 800 },
] as const
const themes = [
  { key: 'light', colorScheme: 'light' as const },
  { key: 'dark', colorScheme: 'dark' as const },
] as const

const branch = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }
const publicoContext = {
  priceListId: 'price-list-publico',
  name: 'PUBLICO',
  isCatalogDefault: true,
}
const mayoreoContext = {
  priceListId: 'price-list-mayoreo',
  name: 'Mayoreo',
  isCatalogDefault: false,
}
const priceContextsResponse = [publicoContext, mayoreoContext]

const product = (id: string, name: string) => ({
  id,
  name,
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
})
const publicoProduct = product('product-publico', 'Producto público')
const mayoreoProduct = product('product-mayoreo', 'Producto Mayoreo')

const productPage = (items: readonly unknown[], priceContext: typeof publicoContext) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: items.length === 0 ? 0 : 1 },
  facets: { categories: [] },
  excludedCount: 0,
  priceContext,
})

const routes: readonly DeclaredRoute[] = [
  { method: 'GET', path: '/public/catalog/branches', json: [branch], count: 1 },
  {
    method: 'GET',
    path: '/public/catalog/centro/price-contexts',
    json: priceContextsResponse,
    count: 1,
  },
  {
    method: 'GET',
    path: '/public/catalog/centro/products',
    query: {},
    json: productPage([publicoProduct], publicoContext),
    count: 1,
  },
  {
    method: 'GET',
    path: '/public/catalog/centro/products',
    query: { priceListId: mayoreoContext.priceListId },
    json: productPage([mayoreoProduct], mayoreoContext),
    count: 1,
    deferred: true,
  },
]

async function measurableBox(locator: Locator, label: string) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`${label} rendered without a measurable box`)
  return box
}

for (const viewport of viewports) {
  for (const theme of themes) {
    test.describe(`public catalog price-context selector at ${viewport.key} ${theme.key}`, () => {
      test.use({ colorScheme: theme.colorScheme, declaredRoutes: { routes } })

      test('starts on PUBLICO and switches the whole catalog to Mayoreo through the real popup', async ({
        page,
        strictNetwork,
      }, testInfo) => {
        await page.addInitScript((mode) => {
          window.localStorage.setItem('vueuse-color-scheme', mode)
        }, theme.key)

        // Captures the explicit Mayoreo read so its exact single query param and anonymity are asserted
        // from the raw wire request, not only from the strict route match.
        const explicitRequests: Array<{
          url: string
          query: Record<string, string>
          authorization: string | undefined
          body: string | null
        }> = []
        page.on('request', (request) => {
          const url = new URL(request.url())
          if (
            url.pathname.endsWith('/public/catalog/centro/products') &&
            url.searchParams.get('priceListId') === mayoreoContext.priceListId
          ) {
            explicitRequests.push({
              url: request.url(),
              query: Object.fromEntries(url.searchParams),
              authorization: request.headers().authorization,
              body: request.postData(),
            })
          }
        })

        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro?source=responsive#products`)

        // Theme emulation is proven by the settled document class, never assumed.
        await expect
          .poll(async () =>
            ((await page.locator('html').getAttribute('class')) ?? '')
              .split(/\s+/)
              .includes('dark'),
          )
          .toBe(theme.key === 'dark')

        const selector = page.getByLabel('Lista de precios', { exact: true })
        await expect(selector).toBeVisible({ timeout: APP_SHELL_TIMEOUT_MS })
        // Discovery starts the fully-controlled selector on the tenant default PUBLICO context.
        await expect(selector).toContainText(publicoContext.name)

        // The trigger keeps a real rendered 44px target and stays inside both its header and the viewport.
        const selectorBox = await measurableBox(selector, 'the price-context selector')
        expect(selectorBox.width).toBeGreaterThanOrEqual(MIN_TARGET_PX)
        expect(selectorBox.height).toBeGreaterThanOrEqual(MIN_TARGET_PX)
        const headerBox = await measurableBox(page.locator('header'), 'the catalog header')
        expect(selectorBox.x, 'the selector must stay inside its header').toBeGreaterThanOrEqual(
          headerBox.x - OVERFLOW_TOLERANCE_PX,
        )
        expect(
          selectorBox.x + selectorBox.width,
          'the selector must stay inside its header',
        ).toBeLessThanOrEqual(headerBox.x + headerBox.width + OVERFLOW_TOLERANCE_PX)
        expect(selectorBox.x, 'the selector must stay inside the viewport').toBeGreaterThanOrEqual(
          0,
        )
        expect(
          selectorBox.x + selectorBox.width,
          'the selector must stay inside the viewport',
        ).toBeLessThanOrEqual(viewport.width + OVERFLOW_TOLERANCE_PX)
        expect(
          selectorBox.y + selectorBox.height,
          'the selector must stay inside the viewport',
        ).toBeLessThanOrEqual(viewport.height + OVERFLOW_TOLERANCE_PX)
        await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)

        // The default-context product renders under the discovery default before any explicit choice.
        await expect(page.getByRole('heading', { name: publicoProduct.name })).toBeVisible()

        // The real Nuxt UI popup is the only selection surface.
        await selector.click()
        const mayoreoOption = page.getByRole('option', { name: mayoreoContext.name, exact: true })
        await expect(mayoreoOption).toBeVisible()
        await mayoreoOption.click()

        // URL authority: the exact id is written and the unrelated query plus the hash are preserved.
        await expect.poll(() => page.url()).toContain(`priceListId=${mayoreoContext.priceListId}`)
        const selectedUrl = new URL(page.url())
        expect(selectedUrl.pathname).toBe('/catalogo/centro')
        expect(selectedUrl.searchParams.get('source')).toBe('responsive')
        expect(selectedUrl.searchParams.get('priceListId')).toBe(mayoreoContext.priceListId)
        expect(selectedUrl.hash).toBe('#products')

        // The held refetch drops the prior-context product and shows loading before Mayoreo lands.
        await expect(page.getByRole('heading', { name: publicoProduct.name })).toHaveCount(0)
        await expect(page.getByRole('heading', { name: 'Cargando productos…' })).toBeVisible()

        await strictNetwork.releaseDeferred()
        await expect(page.getByRole('heading', { name: mayoreoProduct.name })).toBeVisible()
        await expect(page.getByRole('heading', { name: publicoProduct.name })).toHaveCount(0)
        await expect(selector).toContainText(mayoreoContext.name)

        // The explicit list read carried exactly one query parameter and stayed anonymous.
        expect(explicitRequests).toHaveLength(1)
        expect(Object.keys(explicitRequests[0].query)).toEqual(['priceListId'])
        expect(explicitRequests[0].query).toEqual({
          priceListId: mayoreoContext.priceListId,
        })
        expect(explicitRequests[0].authorization).toBeUndefined()
        expect(explicitRequests[0].body).toBeNull()

        // Strict ledger order with no undeclared, exceeded or external request.
        expect(strictNetwork.requests()).toEqual([
          { method: 'GET', path: '/public/catalog/branches', query: {}, body: undefined },
          {
            method: 'GET',
            path: '/public/catalog/centro/price-contexts',
            query: {},
            body: undefined,
          },
          { method: 'GET', path: '/public/catalog/centro/products', query: {}, body: undefined },
          {
            method: 'GET',
            path: '/public/catalog/centro/products',
            query: { priceListId: mayoreoContext.priceListId },
            body: undefined,
          },
        ])
        expect(strictNetwork.violations()).toEqual([])

        await testInfo.attach(`${viewport.key}-${theme.key}-catalog-price-context-mayoreo`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        })
      })
    })
  }
}
