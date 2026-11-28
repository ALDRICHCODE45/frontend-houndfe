/**
 * mobile-tables T1 — the shared mobile list layer at phone widths (customers list as the probe):
 *  (a) the toolbar «Filtros» bottom sheet renders every filter section with real controls, scrolls
 *      inside the sheet and keeps its footer on screen;
 *  (b) the pager under the table fits (no horizontal overflow at 360–407px);
 *  (c) form slideovers («Nuevo cliente») open as a full-height sheet without side gaps, with the
 *      footer actions full width and on screen.
 * Plain Playwright checks over permissive mocked `/__e2e-api` responses (no live backend).
 * Screenshots land under /tmp/mobile-tables/.
 */
import type { Page, Route } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'

const SHOTS = '/tmp/mobile-tables'
const TOTAL = 45

function listingRow(index: number) {
  return {
    id: `c-${index}`,
    firstName: `Cliente ${index} con nombre largo`,
    lastName: 'Pérez Hernández',
    businessName: null,
    phoneCountryCode: '+52',
    phone: '5512345678',
    email: `cliente${index}@hound.test`,
    globalPriceList: null,
    rfc: null,
    fiscalRegime: null,
    isTrusted: false,
    createdAt: '2026-01-02T03:04:05.000Z',
    primaryAddress: null,
    activePetsCount: 0,
    petSpecies: [],
    matchedPetName: null,
  }
}

async function mockApi(page: Page) {
  await page.route('**/*', (route: Route) => {
    const url = new URL(route.request().url())
    if (url.origin !== RESPONSIVE_ORIGIN) return route.abort()
    return route.fallback()
  })
  await page.route('**/__e2e-api/**', (route: Route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/__e2e-api', '')
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/customers/listing') {
      const limit = Number(url.searchParams.get('limit') ?? 5)
      const page0 = Number(url.searchParams.get('page') ?? 1)
      const data = Array.from({ length: limit }, (_, i) => listingRow((page0 - 1) * limit + i + 1))
      return json({ data, pagination: { page: page0, limit, total: TOTAL, totalPages: Math.ceil(TOTAL / limit) }, filterSummary: { count: TOTAL } })
    }
    if (path === '/customers/listing/options') return json({ field: url.searchParams.get('field'), data: [] })
    return json([])
  })
}

async function openCustomers(page: Page, width: number) {
  await page.setViewportSize({ width, height: 851 })
  await seedAuthSession(page, { permissions: ['read:Customer', 'create:Customer', 'update:Customer'] })
  await mockApi(page)
  await page.goto(`${RESPONSIVE_ORIGIN}/pos/customers`)
  await page.locator('.hf-toolbar').first().waitFor()
}

test.describe('mobile-tables T1 @mobile-tables', () => {
  test('(a) the Filtros sheet renders every section with controls, scrolls and keeps its footer', async ({ page }) => {
    await openCustomers(page, 407)
    await page.getByTestId('toolbar-filtros-button').click()
    const body = page.getByTestId('toolbar-filters-body')
    await body.waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/a-filters-sheet-407.png` })

    const sections = body.locator('[data-testid^="section-group-"]')
    expect(await sections.count()).toBeGreaterThan(1)
    const bodyBox = (await body.boundingBox())!
    // Every section is as wide as the sheet body (minus padding), never a clipped sliver.
    for (const section of await sections.all()) {
      const box = (await section.boundingBox())!
      expect(box.width, 'section width').toBeGreaterThan(bodyBox.width - 48)
    }
    // The first section shows a real control.
    const firstControl = sections.first().locator('button, input').first()
    await expect(firstControl).toBeVisible()
    const controlBox = (await firstControl.boundingBox())!
    expect(controlBox.width).toBeGreaterThan(40)
    // The body scrolls inside the sheet; the footer stays inside the viewport.
    const scrolls = await body.evaluate(el => el.scrollHeight > el.clientHeight)
    expect(scrolls).toBe(true)
    const footer = page.getByTestId('toolbar-filters-footer')
    await expect(footer).toBeInViewport({ ratio: 1 })
    const viewport = page.viewportSize()!
    expect(bodyBox.y + bodyBox.height).toBeLessThanOrEqual(viewport.height)
    await body.evaluate(el => el.scrollTo({ top: el.scrollHeight }))
    await page.screenshot({ path: `${SHOTS}/a-filters-sheet-407-bottom.png` })
    await expect(footer).toBeInViewport({ ratio: 1 })
  })

  for (const width of [360, 390]) {
    test(`(b) the pager fits at ${width}px`, async ({ page }) => {
      await openCustomers(page, width)
      const pager = page.locator('.hf-pagination').first()
      await pager.waitFor()
      await pager.scrollIntoViewIfNeeded()
      await pager.locator('.hf-pagination-size').click()
      await page.getByRole('menuitemcheckbox', { name: '5 por página', exact: true }).click()
      await expect(pager.getByText('Mostrando 1-5 de 45')).toBeVisible()
      await page.waitForTimeout(200)
      await pager.screenshot({ path: `${SHOTS}/b-pager-${width}.png` })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, 'document horizontal overflow').toBeLessThanOrEqual(0)
      const pagerOverflow = await pager.evaluate(el => {
        const box = el.getBoundingClientRect()
        return Array.from(el.querySelectorAll('*')).some(child => {
          const c = child.getBoundingClientRect()
          return c.width > 0 && (c.right > box.right + 0.5 || c.left < box.left - 0.5)
        })
      })
      expect(pagerOverflow, 'a pager child sticks out').toBe(false)
      const size = pager.locator('.hf-pagination-size')
      const sizeBox = (await size.boundingBox())!
      const pagerBox = (await pager.boundingBox())!
      expect(sizeBox.width, 'page-size not full width').toBeLessThan(pagerBox.width * 0.6)
      // Prev/next stay reachable.
      await expect(pager.getByRole('button', { name: /siguiente|next/i }).first()).toBeInViewport()
    })
  }

  test('(c) the «Nuevo cliente» slideover is a full-height sheet with full-width footer actions', async ({ page }) => {
    await openCustomers(page, 390)
    await page.getByRole('button', { name: 'Crear cliente' }).first().click()
    const content = page.locator('[role="dialog"]').last()
    await content.waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/c-new-customer-390.png` })
    const viewport = page.viewportSize()!
    const box = (await content.boundingBox())!
    expect(box.x, 'no left gap').toBeLessThanOrEqual(0.5)
    expect(box.width, 'no side gaps').toBeGreaterThanOrEqual(viewport.width - 0.5)
    expect(box.y, 'no top gap').toBeLessThanOrEqual(0.5)
    expect(box.y + box.height, 'reaches the bottom').toBeGreaterThanOrEqual(viewport.height - 0.5)
    expect(box.y + box.height, 'not cut at the bottom').toBeLessThanOrEqual(viewport.height + 0.5)
    const footer = content.locator('[data-slot="footer"]')
    await expect(footer).toBeInViewport({ ratio: 1 })
    const buttons = footer.locator('button')
    const footerBox = (await footer.boundingBox())!
    for (const button of await buttons.all()) {
      const b = (await button.boundingBox())!
      expect(b.width, 'footer action full width').toBeGreaterThan(footerBox.width * 0.4)
    }
    // No nested decorative cards on phones: sections keep at most a top hairline, no box or fill.
    const nestedCards = await content.evaluate(el => Array.from(el.querySelectorAll('.hf-section-card')).filter(card => {
      const style = getComputedStyle(card)
      return style.borderLeftWidth !== '0px' || style.borderBottomWidth !== '0px' || style.backgroundColor !== 'rgba(0, 0, 0, 0)'
    }).length)
    expect(nestedCards, 'decorated section cards on mobile').toBe(0)
  })

  test('desktop (1280px) keeps the numbered pager and the inset form panel', async ({ page }) => {
    await openCustomers(page, 1280)
    await page.locator('.hf-pagination').first().waitFor()
    await expect(page.locator('.hf-pagination-navigation').first()).toBeVisible()
    await expect(page.getByTestId('pagination-compact')).toBeHidden()
    await page.getByRole('button', { name: 'Crear cliente' }).first().click()
    const content = page.locator('[role="dialog"]').last()
    await content.waitFor()
    await page.waitForTimeout(400)
    const box = (await content.boundingBox())!
    expect(box.y, 'inset top kept').toBeGreaterThanOrEqual(15)
    expect(box.width, 'max-w-md kept').toBeLessThanOrEqual(448.5)
    await page.screenshot({ path: `${SHOTS}/d-desktop-1280.png` })
    const sections = await content.evaluate(el => Array.from(el.querySelectorAll('.hf-section-card')).map(card => getComputedStyle(card).borderLeftWidth))
    expect(sections.every(width => width === '1px')).toBe(true)
  })
})
