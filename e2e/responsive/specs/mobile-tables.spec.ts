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

/**
 * mobile-tables T3 (S4) — the chosen direction at 360 and 390px over mocked APIs:
 * A · Lista densa for Clientes, Productos and Cotizaciones, B · Tarjetas ricas for Ventas; the sticky
 * search + «Filtros (N)» + result line with the short «Ordenar» menu; the full-height Filtros sheet
 * with «Ver N resultados»; selection mode with the docked bulk bar; the compact pager; the mobile
 * default page size of 10. Screenshots land under /tmp/mobile-tables-t3/.
 */
const T3_SHOTS = '/tmp/mobile-tables-t3'
const T3_TOTAL = 86
const LONG_NAMES = [
  'Clínica Veterinaria Huellitas del Valle S.A. de C.V.',
  'María Fernanda Garza Lozano',
  'Héctor Villarreal Elizondo',
  'Estética Canina Patitas Felices',
]

function t3CustomerRow(index: number) {
  const name = LONG_NAMES[index % LONG_NAMES.length]!
  const [firstName, ...rest] = name.split(' ')
  const debt = index % 3 === 0 ? 1248000 + index * 100 : 0
  return {
    ...listingRow(index),
    id: `c-${index}`,
    firstName,
    lastName: rest.join(' '),
    activePetsCount: index % 2,
    petSpecies: index % 2 ? ['DOG'] : [],
    metrics: {
      openDebtCents: debt,
      overdueDebtCents: debt,
      overdueCount: debt ? 1 : 0,
      oldestOverdueDueDate: debt ? '2026-08-12' : null,
      salesCount: 4,
      totalSoldCents: 900000,
      averageTicketCents: 225000,
      lastPurchaseAt: index % 4 === 1 ? null : '2026-11-18T12:00:00.000Z',
    },
  }
}

function t3SaleRow(index: number) {
  return {
    id: `s-${index}`,
    folio: `A-202611-${String(10480 + index).padStart(6, '0')}`,
    status: 'CONFIRMED',
    paymentStatus: index % 2 ? 'PARTIAL' : 'PAID',
    deliveryStatus: 'PENDING',
    totalCents: 893000 + index * 100,
    debtCents: index % 2 ? 493000 : 0,
    confirmedAt: '2026-11-28T17:40:00.000Z',
    dueDate: index % 2 ? '2026-12-05' : null,
    customer: { id: `c-${index}`, name: LONG_NAMES[index % LONG_NAMES.length] },
    cashier: { id: 'u-1', name: 'César' },
    seller: null,
    paymentMethods: ['CASH'],
    channel: 'POS',
  }
}

function t3ProductRow(index: number) {
  return {
    id: `p-${index}`,
    name: index % 2 ? 'Croquetas Nupec Adulto Raza Mediana Sabor Pollo y Arroz 15 kg' : 'Arena aglutinante Fresh Step sin aroma 9 kg',
    type: 'PRODUCT',
    sku: `NUP-AD-${index}`,
    categoryName: 'Alimento seco',
    brandName: 'Nupec',
    priceCents: 138900,
    quantity: index % 3 === 0 ? 2 : 12,
    minQuantity: 5,
    useStock: true,
    hasVariants: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  }
}

function t3QuotationRow(index: number) {
  return {
    id: `q-${index}`,
    customerId: `c-${index}`,
    customer: { id: `c-${index}`, firstName: 'Estética Canina', lastName: 'Patitas Felices del Norte', email: null },
    status: index % 2 ? 'SENT' : 'DRAFT',
    expiresAt: '2099-12-04T00:00:00.000Z',
    totalCents: 1892000,
    createdAt: '2026-11-20T00:00:00.000Z',
  }
}

function paged<T>(url: URL, row: (index: number) => T) {
  const limit = Number(url.searchParams.get('limit') ?? 10)
  const page0 = Number(url.searchParams.get('page') ?? 1)
  const data = Array.from({ length: Math.min(limit, T3_TOTAL - (page0 - 1) * limit) }, (_, i) => row((page0 - 1) * limit + i + 1))
  return { data, pagination: { page: page0, limit, total: T3_TOTAL, totalPages: Math.ceil(T3_TOTAL / limit) } }
}

async function mockT3Api(page: Page, requests: URL[] = []) {
  await page.route('**/*', (route: Route) => {
    const url = new URL(route.request().url())
    if (url.origin !== RESPONSIVE_ORIGIN) return route.abort()
    return route.fallback()
  })
  await page.route('**/__e2e-api/**', (route: Route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const path = url.pathname.replace('/__e2e-api', '')
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/customers/listing') {
      return json({ ...paged(url, t3CustomerRow), filterSummary: { count: T3_TOTAL, openDebtCents: 5400000 } })
    }
    if (path === '/customers/listing/options') return json({ field: url.searchParams.get('field'), data: [{ value: 'Monterrey', count: 40 }, { value: 'San Nicolás', count: 30 }] })
    if (path === '/sales') {
      return json({
        ...paged(url, t3SaleRow),
        counts: { all: T3_TOTAL, pendingPayments: 40, notDelivered: 20 },
        summary: {},
        filterSummary: { count: T3_TOTAL, totalCents: 76000000, debtCents: 20000000 },
      })
    }
    if (path === '/products') return json(Array.from({ length: T3_TOTAL }, (_, i) => t3ProductRow(i + 1)))
    if (path === '/quotations') return json(paged(url, t3QuotationRow))
    return json([])
  })
}

const T3_PERMISSIONS = [
  'read:Customer', 'create:Customer', 'update:Customer', 'read:Sale', 'create:Sale',
  'read:Product', 'create:Product', 'read:Quotation', 'create:Quotation',
]

async function openT3(page: Page, path: string, width: number, requests?: URL[]) {
  await page.setViewportSize({ width, height: 844 })
  await seedAuthSession(page, { permissions: T3_PERMISSIONS })
  await mockT3Api(page, requests)
  await page.goto(`${RESPONSIVE_ORIGIN}${path}`)
  await page.locator('.hf-toolbar').first().waitFor()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'document horizontal overflow').toBeLessThanOrEqual(0)
}

async function expectPagerFits(page: Page) {
  const pager = page.locator('.hf-pagination').first()
  await pager.scrollIntoViewIfNeeded()
  const sticksOut = await pager.evaluate(el => {
    const box = el.getBoundingClientRect()
    return Array.from(el.querySelectorAll('*')).some(child => {
      const c = child.getBoundingClientRect()
      return c.width > 0 && (c.right > box.right + 0.5 || c.left < box.left - 0.5)
    })
  })
  expect(sticksOut, 'a pager child sticks out').toBe(false)
  await expect(pager.getByRole('button', { name: /siguiente/i }).first()).toBeInViewport()
}

const LISTS = [
  { name: 'clientes', path: '/pos/customers', item: 'mobile-list-row' },
  { name: 'productos', path: '/pos/products', item: 'mobile-list-row' },
  { name: 'cotizaciones', path: '/pos/cotizaciones', item: 'mobile-list-row' },
  { name: 'ventas', path: '/pos/ventas', item: 'mobile-list-card' },
] as const

test.describe('mobile-tables T3 @mobile-tables', () => {
  for (const width of [360, 390]) {
    for (const list of LISTS) {
      test(`${list.name} renders ${list.item === 'mobile-list-row' ? 'dense rows' : 'rich cards'} at ${width}px without overflow`, async ({ page }) => {
        await openT3(page, list.path, width)
        const items = page.getByTestId(list.item)
        await items.first().waitFor()
        expect(await items.count()).toBeGreaterThan(0)
        await expect(page.locator('table')).toHaveCount(0)
        // The full name wraps instead of being cut, and every row target is at least 44px tall.
        const name = items.first().locator('[data-testid$="-primary"]')
        const nameBox = await name.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, overflow: getComputedStyle(el).textOverflow }))
        expect(nameBox.scroll, 'name not clipped').toBeLessThanOrEqual(nameBox.client + 1)
        expect(nameBox.overflow).not.toBe('ellipsis')
        const itemBox = (await items.first().boundingBox())!
        expect(itemBox.height).toBeGreaterThanOrEqual(44)
        // Result line with the sort menu, under the sticky search.
        await expect(page.getByTestId('mobile-result-line')).toContainText(`${T3_TOTAL}`)
        await expect(page.getByTestId('mobile-sort-button')).toBeVisible()
        await page.waitForTimeout(200)
        await page.screenshot({ path: `${T3_SHOTS}/${list.name}-${width}.png`, fullPage: true })
        await expectNoHorizontalOverflow(page)
        await expectPagerFits(page)
      })
    }

    test(`clientes Filtros sheet at ${width}px: full height, sections with counts, «Ver N clientes»`, async ({ page }) => {
      await openT3(page, '/pos/customers', width)
      await page.getByTestId('mobile-list-row').first().waitFor()
      await page.getByTestId('toolbar-filtros-button').click()
      const layout = page.getByTestId('toolbar-filters-layout')
      await layout.waitFor()
      await page.waitForTimeout(400)
      const viewport = page.viewportSize()!
      const box = (await layout.boundingBox())!
      expect(box.y, 'sheet starts near the top').toBeLessThanOrEqual(16)
      expect(box.x).toBeLessThanOrEqual(0.5)
      expect(box.width).toBeGreaterThanOrEqual(viewport.width - 0.5)
      expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 0.5)
      const sections = page.getByTestId('toolbar-filters-body').locator('[data-testid^="section-group-"]')
      expect(await sections.count()).toBeGreaterThan(1)
      await expect(sections.first()).toBeVisible()
      // Sort is not in the sheet on phones.
      await expect(page.getByTestId('customers-sort-select')).toHaveCount(0)
      const apply = page.getByTestId('toolbar-filters-apply')
      await expect(apply).toHaveText(`Ver ${T3_TOTAL} clientes`)
      await expect(apply).toBeInViewport({ ratio: 1 })
      await expect(page.getByTestId('toolbar-filters-clear-all')).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: `${T3_SHOTS}/clientes-filtros-${width}.png` })
      await apply.click()
      await expect(layout).toBeHidden()
    })
  }

  test('clientes selection mode at 390px: marks inside the rows and the docked bulk bar', async ({ page }) => {
    await openT3(page, '/pos/customers', 390)
    const rows = page.getByTestId('mobile-list-row')
    await rows.first().waitFor()
    await page.getByTestId('mobile-select-toggle').click()
    await rows.nth(0).click()
    await rows.nth(1).click()
    await expect(rows.nth(0).locator('.hf-row-mark')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('mobile-select-head')).toContainText('2 seleccionados')
    const dock = page.locator('.hf-bulk-bar--docked')
    await expect(dock).toBeVisible()
    const viewport = page.viewportSize()!
    const box = (await dock.boundingBox())!
    expect(box.x).toBeLessThanOrEqual(0.5)
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 0.5)
    expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 0.5)
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${T3_SHOTS}/clientes-seleccion-390.png` })
    await expectNoHorizontalOverflow(page)
    await page.getByTestId('mobile-select-done').click()
    await expect(dock).toHaveCount(0)
  })

  test('clientes sort menu at 360px lists only the orderings', async ({ page }) => {
    await openT3(page, '/pos/customers', 360)
    await page.getByTestId('mobile-list-row').first().waitFor()
    await page.getByTestId('mobile-sort-button').click()
    const items = page.getByRole('menuitemcheckbox')
    await expect(items.first()).toBeVisible()
    await expect(page.getByRole('menuitemcheckbox', { name: 'Nombre · A–Z' })).toBeVisible()
    await page.screenshot({ path: `${T3_SHOTS}/clientes-ordenar-360.png` })
    await page.getByRole('menuitemcheckbox', { name: 'Deuda · mayor a menor' }).click()
    await expect(page.getByTestId('mobile-sort-button')).toContainText('Deuda')
  })

  test('the search block stays stuck under the app bar while the list scrolls (390px)', async ({ page }) => {
    await openT3(page, '/pos/customers', 390)
    await page.getByTestId('mobile-list-row').first().waitFor()
    const sticky = page.getByTestId('toolbar-mobile-sticky')
    const before = (await sticky.boundingBox())!
    await page.getByTestId('mobile-list-row').nth(6).scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(300)
    const after = (await sticky.boundingBox())!
    await expect(sticky).toBeInViewport()
    expect(after.y, 'stuck near the top of the scroll area').toBeLessThan(before.y)
    await page.screenshot({ path: `${T3_SHOTS}/clientes-scroll-390.png` })
  })

  test('a phone with nothing remembered asks for 10 rows', async ({ page }) => {
    const requests: URL[] = []
    await openT3(page, '/pos/customers', 390, requests)
    await page.getByTestId('mobile-list-row').first().waitFor()
    const listing = requests.filter(url => url.pathname.endsWith('/customers/listing'))
    expect(listing.length).toBeGreaterThan(0)
    expect(listing[0]!.searchParams.get('limit')).toBe('10')
  })

  test('desktop (1280px) keeps the table: no phone rows, no result line', async ({ page }) => {
    const requests: URL[] = []
    await openT3(page, '/pos/customers', 1280, requests)
    await page.locator('table tbody tr').first().waitFor()
    await expect(page.getByTestId('mobile-list-row')).toHaveCount(0)
    await expect(page.getByTestId('mobile-result-line')).toHaveCount(0)
    await expect(page.getByTestId('customers-sort-select')).toBeVisible()
    // Desktop keeps the table's own default (50 for customers).
    const listing = requests.filter(url => url.pathname.endsWith('/customers/listing'))
    expect(listing[0]!.searchParams.get('limit')).toBe('50')
    await page.screenshot({ path: `${T3_SHOTS}/clientes-desktop-1280.png` })
  })
})
