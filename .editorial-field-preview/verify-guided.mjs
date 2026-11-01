import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

const base = '.editorial-field-preview/'
const stamp = '2026-04-23T00:00:00.000Z'
const R = 'ev2-sha256-' + 'a'.repeat(64)
const product = { id: 'product-1', name: 'Arnés ajustable Terra', type: 'PRODUCT', sku: 'TERRA', category: { id: 'cat-1', name: 'Accesorios' }, brand: { id: 'brand-1', name: 'Terra' }, unit: 'UNIDAD', satKey: null, priceCents: 34900, purchaseNetCostCents: 18000, useStock: true, hasVariants: true, useLotsAndExpirations: false, variantCount: 2, variantStockTotal: 12, createdAt: stamp, updatedAt: stamp }
const variants = ['Mediano · azul', 'Grande · azul'].map((name, i) => ({ id: 'variant-' + (i + 1), name, option: 'Tamaño', value: name, quantity: 6, createdAt: stamp, updatedAt: stamp, variantPrices: [{ id: 'vp-' + i, variantId: 'variant-' + (i + 1), priceListId: 'public', priceListName: 'PUBLICO', priceCents: 34900, tierPrices: [] }] }))
const price = { id: 'public', productId: 'product-1', name: 'PUBLICO', priceCents: 34900, tierPrices: [], createdAt: stamp, updatedAt: stamp }
const document = title => ({ schemaVersion: 2, commercialTitle: title, description: 'Descripción editorial de prueba', mediaRefs: [], familyCode: null, values: [], facts: [] })
const initial = tenant => ({ cycle: 2, draft: { revision: 3, basePublishedRevision: null, document: document('Editorial ' + tenant) }, published: null })
const states = new Map()
const report = { status: 'running', phase: 'setup', groups: [], requests: [], screenshots: [], layout: [], pageErrors: [], consoleErrors: [], blockedExternal: [], failures: [], cleanup: {}, disclosures: ['Real ProductDetailView/ProductEditorialView, Nuxt UI, Pinia and VueQuery in an isolated RouterView shell, not full DashboardLayout or real router guards.', 'Synthetic nonpersisted sessions and intercepted HTTP; no real authentication/backend/database/publication proof.', 'External assets and WebSockets blocked. Native font fallbacks may render.', 'No deployment and no access to retired API/credentials.'] }
let server, browser, context, page, origin
const headers = { 'Content-Type': 'application/json', 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': R, 'Cache-Control': 'no-store' }
const writes = () => report.requests.filter(r => r.method !== 'GET')
const editorialReads = () => report.requests.filter(r => r.method === 'GET' && /editorial/.test(r.path))
const button = name => page.getByRole('button', { name, exact: true })
async function network(route) {
  const req = route.request()
  let url
  try { url = new URL(req.url()) } catch { throw new Error('Malformed intercepted fixture URL') }
  const path = url.pathname.replace('/guided-fixture-api', '')
  const entry = { phase: report.phase, method: req.method(), path }
  report.requests.push(entry)
  const reply = data => route.fulfill({ status: 200, headers, body: JSON.stringify(data) })
  assert(!/publish/.test(path), 'Publication must have no HTTP path')
  if (path === '/catalog-editorial/vocabulary') return reply({ contractVersion: 2, vocabularyRevision: R, vocabulary: { semanticsVersion: 'editorial-production-1', families: [], definitions: [] } })
  if (path.endsWith('/editorial/context')) return reply({ variants: variants.map(v => ({ id: v.id, name: v.name })) })
  if (/\/editorial(?:\/draft)?$/.test(path)) {
    let claims
    try { claims = JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1], 'base64url')) }
    catch { throw new Error('Malformed synthetic session claims') }
    const key = claims.tenantId
    if (!states.has(key)) states.set(key, initial(key))
    const state = states.get(key)
    if (req.method() === 'PUT') {
      const body = req.postDataJSON()
      assert.equal(path, '/products/product-1/editorial/draft')
      assert.equal(body.expectedCycle, state.cycle)
      assert.equal(body.expectedRevision, state.draft.revision)
      assert.equal(req.headers()['editorial-vocabulary-revision'], R)
      assert(req.headers()['idempotency-key'])
      state.draft = { ...state.draft, revision: state.draft.revision + 1, document: body.document }
    } else assert.equal(req.method(), 'GET')
    return reply({ contractVersion: 2, vocabularyRevision: R, state })
  }
  assert.equal(req.method(), 'GET', 'Unexpected operational write')
  if (path === '/categories') return reply([{ id: 'cat-1', name: 'Accesorios' }])
  if (path === '/brands') return reply([{ id: 'brand-1', name: 'Terra' }])
  if (path === '/price-lists') return reply([{ id: 'public', name: 'PUBLICO', isDefault: true, createdAt: stamp, updatedAt: stamp }])
  if (/^\/tenants\/[^/]+\/catalog-settings$/.test(path)) return reply({ catalogPublished: false, effectivePublication: false, priceContexts: [], stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null }, warnings: [], updatedAt: stamp })
  if (path === '/products/product-1') return reply(product)
  if (path === '/products/product-1/variants') return reply(variants)
  if (path === '/products/product-1/price-lists') return reply([price])
  if (['/products/product-1/images', '/products/product-1/lots'].includes(path)) return reply([])
  throw new Error('Unexpected API: ' + path)
}
async function scenario(target) {
  states.clear()
  await page.goto(origin + '/.editorial-field-preview/guided.html?target=' + encodeURIComponent(target))
  if (target.endsWith('/editorial')) await expect(page.locator('#editorial-title')).toBeVisible()
  else await expect(page.locator('input[name="name"]')).toBeVisible()
}
async function group(name, fn) { report.phase = name; await fn(); report.groups.push(name) }
async function settle() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
async function capture(name, width, theme) {
  await page.setViewportSize({ width, height: 900 })
  await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
  await page.evaluate(() => document.fonts.ready)
  await settle()
  await page.evaluate(() => Promise.allSettled(document.getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .map(animation => animation.finished)))
  await page.keyboard.press('Tab')
  await page.locator('nav button').first().focus()
  const focus = await page.locator('nav button').first().evaluate(button => ({
    visible: button.matches(':focus-visible'), outline: getComputedStyle(button).outlineWidth,
  }))
  assert(focus.visible && parseFloat(focus.outline) >= 2, 'Keyboard focus below2px')
  const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, token: getComputedStyle(document.body).getPropertyValue('--hf-page').trim(), nav: [...document.querySelectorAll('nav button')].filter(b => b.getClientRects().length).map(b => ({ text: b.textContent, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })) }))
  report.layout.push({ name, theme, focus, ...metrics })
  const path = base + `guided-${name}-${theme}-${width}.png`
  await page.screenshot({ path, fullPage: true }); report.screenshots.push(path)
  assert(metrics.scroll <= metrics.width, 'Horizontal overflow: ' + JSON.stringify(metrics))
  assert(metrics.token, 'Missing HF theme')
  if (name === 'presentations') {
    const bounds = await page.locator('#product-detail-form').evaluate(form => ({
      form: form.getBoundingClientRect().width,
      fieldset: form.querySelector('fieldset').getBoundingClientRect().width,
    }))
    report.layout.at(-1).formBounds = bounds
    assert(bounds.fieldset <= bounds.form + 1, 'Operational fieldset clips mobile contents: ' + JSON.stringify(bounds))
  }
  for (const b of metrics.nav) assert(b.width >= 44 && b.height >= 44, 'Navigation target below44px')
}
try {
  server = await createServer({ configFile: false, envDir: false, plugins: [vue(), tailwindcss(), ui({ dts: false })], resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } }, server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false } })
  await new Promise((resolve, reject) => { server.httpServer.once('error', reject); server.httpServer.listen(0, '127.0.0.1', resolve) })
  origin = 'http://127.0.0.1:' + server.httpServer.address().port
  report.origin = origin
  browser = await chromium.launch({ headless: true, timeout: 15000 })
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  await context.routeWebSocket('**/*', ws => ws.close())
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin !== origin) { report.blockedExternal.push(url.origin); return route.abort() }
    if (url.pathname.startsWith('/guided-fixture-api/')) {
      try { return await network(route) } catch (e) { report.failures.push(e.message); return route.abort() }
    }
    if (req.method() !== 'GET') { report.failures.push('Unexpected nonfixture write'); return route.abort() }
    return route.continue()
  })
  page = await context.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(30000)
  page.on('pageerror', e => report.pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()) })
  page.on('dialog', d => d.accept())
  await group('Operational layout light/dark desktop/mobile', async () => {
    await scenario('/pos/products/product-1')
    await expect(page.locator('input[name="name"]')).toHaveValue(product.name)
    const n = editorialReads().length
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) await capture('operation', width, theme)
    assert.equal(editorialReads().length, n)
    await page.locator('input[name="name"]').fill('Nombre operativo pendiente')
    await page.locator('[data-task="presentations"]').click()
    await expect(page.locator('input[name="purchaseCost"]')).toBeVisible()
    await capture('presentations', 390, 'light')
    await page.locator('[data-task="identity"]').click()
    await expect(page.locator('input[name="name"]')).toHaveValue('Nombre operativo pendiente')
  })
  await group('Embedded editor retains controls and independent save target', async () => {
    const n = writes().length
    await page.locator('[data-task="content"]').click()
    await expect(page.locator('#editorial-title')).toBeVisible()
    assert.equal(await page.locator('form form').count(), 0)
    assert.equal(await page.locator('#editorial-form').evaluate(e => Boolean(e.closest('#product-detail-form'))), false)
    const input = await page.locator('#editorial-title').elementHandle()
    await page.locator('#editorial-title').fill('Título editorial pendiente')
    await page.locator('[data-task="review"]').click()
    await expect(page.locator('#editorial-form')).toBeHidden()
    await expect(button('Publicar borrador…')).toHaveCount(0)
    await capture('embedded-review', 390, 'light')
    await page.locator('[data-task="identity"]').click()
    await expect(page.locator('input[name="name"]')).toHaveValue('Nombre operativo pendiente')
    await page.locator('[data-task="content"]').click()
    assert(await input.evaluate(e => e === document.querySelector('#editorial-title')))
    await expect(page.locator('#editorial-title')).toHaveValue('Título editorial pendiente')
    assert.equal(writes().length, n)
    await button('Guardar borrador').click()
    await expect(page.getByRole('heading', { name: 'Acuse histórico · solicitud confirmada' })).toBeVisible()
    assert.equal(writes().length, n + 1)
    assert.equal(writes().at(-1).path, '/products/product-1/editorial/draft')
    await page.locator('[data-task="identity"]').click()
    await expect(page.locator('input[name="name"]')).toHaveValue('Nombre operativo pendiente')
  })
  await group('Hidden editor retires actor and tenant state and revocation', async () => {
    await page.locator('[data-task="content"]').click()
    await page.locator('#editorial-title').fill('PRIVATE OLD SCOPE')
    const old = await page.locator('#editorial-title').elementHandle()
    await page.locator('[data-task="identity"]').click()
    await page.evaluate(() => window.__guided.scope('fixture-tenant-2', 'fixture-user-2'))
    await page.locator('[data-task="content"]').click()
    await expect(page.locator('#editorial-title')).toHaveValue('Editorial fixture-tenant-2')
    assert.equal(await old.evaluate(e => e.isConnected), false)
    await page.locator('[data-task="identity"]').click()
    await page.evaluate(() => window.__guided.revoke())
    await page.locator('[data-task="content"]').click()
    await expect(page.getByTestId('editorial-unavailable')).toContainText('No tienes permiso')
    await expect(page.locator('#editorial-form')).toHaveCount(0)
  })
  await group('Standalone actual saved summary and mobile/desktop themes', async () => {
    await scenario('/pos/products/product-1/editorial')
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) await capture('editorial', width, theme)
    const n = report.requests.length
    await page.locator('#editorial-title').fill('LOCAL NOT SAVED')
    await button('Revisar').click()
    await expect(page.locator('[aria-label="Resumen editorial privado"]')).not.toContainText('LOCAL NOT SAVED')
    await expect(page.locator('[aria-label="Resumen editorial privado"]')).toContainText('Cambios locales sin guardar')
    await expect(button('Publicar borrador…')).toHaveCount(0)
    await button('Contenido').click()
    await expect(page.locator('#editorial-title')).toHaveValue('LOCAL NOT SAVED')
    assert.equal(report.requests.length, n)
  })
  await group('Create mode has separate type and unavailable editorial', async () => {
    await scenario('/pos/products/create')
    await expect(page.locator('input[name="name"]')).toHaveValue('')
    for (const theme of ['light', 'dark']) await capture('create', 390, theme)
    const n = editorialReads().length
    await page.locator('[data-task="content"]').click()
    await expect(page.getByTestId('editorial-unavailable')).toContainText('Crea el producto primero')
    assert.equal(editorialReads().length, n)
    await expect(page.locator('#editorial-form')).toHaveCount(0)
  })
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.failures, [])
  report.status = 'passed'
} catch (e) {
  report.status = 'failed'; report.failures.push(e.stack); process.exitCode = 1
  if (page) { try { report.diagnostic = await page.locator('body').innerText(); await page.screenshot({ path: base + 'guided-failure.png', fullPage: true }) } catch { /* Preserve the original failure. */ } }
} finally {
  for (const [name, resource] of [['context', context], ['browser', browser], ['server', server]]) {
    if (resource) { try { await resource.close(); report.cleanup[name] = true } catch (e) { report.cleanup[name] = e.message; process.exitCode = 1 } }
  }
  await writeFile(base + 'guided-verification-' + Date.now() + '.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
