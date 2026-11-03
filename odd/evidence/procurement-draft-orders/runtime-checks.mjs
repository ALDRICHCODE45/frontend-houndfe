// Canonical parent-run MCP harness. No execution during preparation.
const API = 'http://127.0.0.1:40377'
const CREDENTIALS = '/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/.tmp/procurement-suppliers-o3a/.tmp/po-runtime.QtKB8y/credentials.json'
const FIXTURE_PREFIX = 'PO-e473f791-9135-473e-a30b-6face6a13b7a' // Non-secret backend seed prefix; confirm with runtime owner.
const ORIGIN = 'http://127.0.0.1:43179'
const DIR = '/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-draft-orders'
const ORDERS = '/procurement/purchase-orders'
const SUPPLIERS = '/procurement/suppliers'
const allowed = (method, path) =>
  (method === 'POST' && ['/auth/login', '/auth/logout', '/auth/refresh'].includes(path)) ||
  (method === 'GET' && ['/auth/me', '/auth/me/permissions', '/products'].includes(path)) ||
  (method === 'GET' && /^\/products\/[a-z0-9-]+\/variants$/.test(path)) ||
  (['GET', 'POST'].includes(method) && [ORDERS, SUPPLIERS].includes(path)) ||
  (['GET', 'PATCH', 'DELETE'].includes(method) && /^\/procurement\/suppliers\/[a-z0-9-]+$/.test(path)) ||
  (['GET', 'DELETE'].includes(method) && /^\/procurement\/purchase-orders\/[a-z0-9-]+$/.test(path)) ||
  (method === 'PUT' && /^\/procurement\/purchase-orders\/[a-z0-9-]+\/draft$/.test(path))
const safeCode = code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : null

export async function run(browserPage, stage) {
  const report = { stage, checks: [], requests: [], outsideScope: [], screenshots: [], runtimeErrorCount: 0, verdict: 'incomplete', coverage: 'real mounted auth/router and UI; direct boundary probes use browser fetch, not feature adapters' }
  let context, secondContext, step = 'validate configured placeholders'
  const check = (ok, name) => { if (!ok) { report.failureCheck = name; throw new Error('Assertion failed') } report.checks.push(name) }
  const pending = []
  try {
    check(['manager', 'permissions'].includes(stage), 'known stage')
    check(/^http:\/\/127\.0\.0\.1:\d+$/.test(API) && !['3000', '43179', '0'].includes(API.split(':').at(-1)) && Number(API.split(':').at(-1)) <= 65535 && CREDENTIALS.startsWith('/') && !CREDENTIALS.includes('__'), 'explicit disposable API and authorized absolute credentials path configured')
    context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const credentialPage = await context.newPage()
    let credentials
    try {
      await credentialPage.route('**/*', route => route.abort('blockedbyclient'))
      await credentialPage.setContent('<input id="fixture-credentials" type="file">')
      await credentialPage.locator('#fixture-credentials').setInputFiles(CREDENTIALS)
      credentials = await credentialPage.locator('#fixture-credentials').evaluate(async input => {
        const data = JSON.parse(await input.files[0].text())
        return { apiOrigin: data.apiOrigin, password: data.password, prefix: data.catalog?.prefix ?? data.prefix ?? null, users: { manager: { email: data.users.manager.email }, reader: { email: data.users.reader.email }, noaccess: { email: data.users.noaccess.email } } }
      })
    } finally { await credentialPage.close() }
    // The page callback cannot see module constants; apply the fallback here.
    credentials.prefix ??= FIXTURE_PREFIX
    check(credentials.apiOrigin === API && typeof credentials.password === 'string' && Object.values(credentials.users).every(user => typeof user.email === 'string'), 'O3a credential schema and exact API origin')
    // Prefix comes from authorized fixture metadata or the non-secret constant.
    // A missing/ambiguous prefix stops before mutations instead of guessing IDs.
    check(typeof credentials.prefix === 'string' && credentials.prefix !== '__FIXTURE_PREFIX__' && /^[A-Za-z0-9_-]{4,100}$/.test(credentials.prefix), 'backend supplies unique synthetic fixture prefix')
    const attach = async ctx => {
      // about:blank denies localStorage; only the FE origin needs the theme seed.
      await ctx.addInitScript(() => { try { localStorage.setItem('vueuse-color-mode', 'light') } catch {} })
      await ctx.route('**/*', route => {
        const req = route.request(), url = new URL(req.url()), method = req.method()
        if (url.origin === ORIGIN) return route.continue().catch(() => {})
        if (url.origin === API && (allowed(method, url.pathname) || (method === 'OPTIONS' && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].some(m => allowed(m, url.pathname))))) return route.continue().catch(() => {})
        // Same as O3a: public font/icon GETs load so screenshots show the real UI.
        if (method === 'GET' && url.protocol === 'https:' && ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'].includes(url.hostname)) return route.continue().catch(() => {})
        // Do not include untrusted URL paths/queries (which could contain PII).
        report.outsideScope.push({ method, origin: url.origin === API ? 'configured-api' : 'unapproved-origin', path: allowed('GET', url.pathname) ? url.pathname : '[redacted-unapproved-path]' })
        return route.abort('blockedbyclient').catch(() => {})
      })
      ctx.on('page', p => {
        p.setDefaultTimeout(15000)
        p.on('pageerror', error => {
          report.runtimeErrorCount++
          ;(report.runtimeErrors ??= []).push(String(error?.message ?? error).replace(/[^\s@]+@[^\s@]+/g, '[email]').slice(0, 160))
        })
        p.on('response', res => {
          const url = new URL(res.url()), req = res.request()
          if (url.origin !== API || !allowed(req.method(), url.pathname)) return
          const row = { method: req.method(), path: url.pathname, status: res.status(), error: null }
          report.requests.push(row)
          if (res.status() >= 400) pending.push(res.json().then(body => { row.error = safeCode(body.error) || safeCode(body.code) }).catch(() => {}))
        })
      })
    }
    await attach(context)
    const page = await context.newPage()
    step = 'open the FE origin before generating probe ids'
    // crypto.randomUUID needs a secure context; about:blank is not one, loopback is.
    await page.goto(`${ORIGIN}/login`)
    // Floating response waits must never escape as unhandled rejections.
    const waitRes = predicate => { const pending = page.waitForResponse(predicate); pending.catch(() => {}); return pending }
    const uuid = () => page.evaluate(() => crypto.randomUUID())
    const prefix = `FEProbe-${await uuid()}`
    const navigate = async (p, path) => p.evaluate(async path => {
      const globals = document.querySelector('#app')?.__vue_app__?.config.globalProperties
      if (!globals?.$router) return false
      await globals.$router.replace(path)
      return globals.$router.currentRoute.value.path
    }, path)
    const login = async (p, role) => {
      step = `${role}: real mounted auth login and route admission`
      await p.goto(`${ORIGIN}/login`)
      await p.waitForFunction(() => Boolean(document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('auth')))
      const ok = await p.evaluate(async ({ email, password }) => {
        try {
          const globals = document.querySelector('#app').__vue_app__.config.globalProperties
          const auth = globals.$pinia._s.get('auth')
          await auth.login({ email, password })
          if (!auth.isAuthenticated || auth.authPhase !== 'authenticated' || !auth.permissionsLoaded) return false
          await auth.fetchMe()
          return true
        } catch { return false }
      }, { email: credentials.users[role].email, password: credentials.password })
      check(ok, `${role}: real mounted auth store authenticated (no replacement router/store)`)
      return await navigate(p, ORDERS)
    }
    const logout = async () => {
      const ok = await page.evaluate(async () => { try { await document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth').logout(); return true } catch { return false } })
      check(ok, 'real mounted store logout')
    }
    // Tokens never cross the evaluate bridge. Paths are checked BEFORE fetch.
    const call = async (p, method, path, body) => {
      check(allowed(method, path.split('?')[0]), 'direct probe restricted to allowlist')
      return await p.evaluate(async ({ api, method, path, body }) => {
        try {
          const token = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth').accessToken
          const response = await fetch(api + path, { method, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
          const value = response.status === 204 ? null : await response.json()
          return { status: response.status, value }
        } catch { return { status: null, value: null } }
      }, { api: API, method, path, body })
    }
    const settled = async () => page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))
    })
    const shot = async name => {
      await settled()
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no page overflow: ${name}`)
      const d = page.getByRole('dialog')
      if (await d.count()) check(await d.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().left >= -1 && el.getBoundingClientRect().right <= innerWidth + 1), `overlay bounds: ${name}`)
      // The dialog itself can fit while its scrolling body overflows sideways.
      if (await d.count()) {
        const offender = await d.evaluate(el => {
          const box = [...el.querySelectorAll('*')].find(n => ['auto', 'scroll'].includes(getComputedStyle(n).overflowX) && n.scrollWidth > n.clientWidth + 1)
          if (!box) return null
          // Report the widest descendant that sticks out, by tag/class and size only.
          const right = box.getBoundingClientRect().right
          const label = n => `${n.tagName.toLowerCase()}.${String(n.className?.baseVal ?? n.className).split(' ').slice(0, 4).join('.')}`
          const wide = [...box.querySelectorAll('*')].filter(n => n.getBoundingClientRect().right > right + 1)
            .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width).slice(0, 6)
            .map(n => `${label(n)} w=${Math.round(n.getBoundingClientRect().width)}`)
          return `${label(box)} ${box.scrollWidth}>${box.clientWidth}; sticks out: ${wide.join(' | ')}`
        })
        if (offender) report.overlayOverflow = offender
        check(offender === null, `no horizontal scroll inside overlay: ${name}`)
      }
      const path = `${DIR}/runtime-${stage}-${name}.png`
      // Never screenshot the credential/login page; also mask any shell email.
      await page.screenshot({ path, fullPage: true, animations: 'disabled', mask: [page.getByText(/[^\s@]+@[^\s@]+\.[^\s@]+/), page.locator('input[type="password"],input[type="email"]')] })
      report.screenshots.push(path)
    }
    const search = async term => {
      const response = waitRes(r => { const u = new URL(r.url()); return u.origin === API && u.pathname === ORDERS && r.request().method() === 'GET' && (u.searchParams.get('search') || '') === term && r.status() === 200 })
      const input = page.getByPlaceholder('Buscar por proveedor o nota...', { exact: true })
      if (await input.inputValue() === term) await page.getByTestId('refresh-orders').click(); else await input.fill(term)
      await response
    }
    const d = page.getByRole('dialog')
    const save = async status => {
      const response = waitRes(r => r.url().startsWith(API + ORDERS) && ['POST', 'PUT'].includes(r.request().method()) && r.status() === status)
      await d.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
      const res = await response
      if (status >= 400) return { response: res, value: await res.json() }
      const value = await res.json()
      await d.getByRole('button', { name: 'Guardar borrador', exact: true }).waitFor({ state: 'visible' })
      await page.waitForFunction(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Guardar borrador'); return button && !button.disabled })
      return { response: res, value }
    }
    const close = async () => { await d.getByRole('button', { name: 'Cerrar', exact: true }).last().click(); await d.waitFor({ state: 'hidden' }) }
    const targetRow = () => page.locator('tr, article.order-card').filter({ hasText: prefix })
    const resume = async () => { await targetRow().getByRole('button', { name: 'Continuar', exact: true }).first().click(); await d.getByRole('button', { name: 'Guardar borrador', exact: true }).waitFor() }
    const pick = async (trigger, name) => { await d.getByText(trigger, { exact: true }).last().click(); await page.getByPlaceholder('Buscar producto...', { exact: true }).fill(name); await page.getByRole('option', { name, exact: true }).click() }
    check(await login(page, 'manager') === ORDERS, 'manager route admitted')
    await page.getByRole('heading', { name: 'Órdenes de compra', exact: true }).waitFor()
    await page.getByTestId('refresh-orders').waitFor()
    check((await call(page, 'GET', `${ORDERS}?limit=100`)).status === 200, 'real list loads')
    check(report.outsideScope.length === 0, 'no out-of-scope shell dependencies before mutations')
    step = 'unique incomplete draft through UI'
    await page.getByRole('button', { name: 'Nueva orden', exact: true }).click()
    await d.locator('textarea').fill(prefix)
    let current = (await save(201)).value
    check(current.supplierId === null && current.validation.issues.some(i => i.code === 'SUPPLIER_REQUIRED') && current.validation.issues.some(i => i.code === 'LINES_REQUIRED'), 'POST 201 incomplete draft diagnostics')
    await d.getByText('Selecciona un proveedor.', { exact: true }).waitFor()
    await d.getByText('Agrega al menos un renglón para completar la orden.', { exact: true }).waitFor()
    check(true, 'server diagnostics rendered')
    const id = current.id, path = `${ORDERS}/${id}`, draft = `${path}/draft`
    report.orderPath = path
    await close(); await search(prefix)
    check((await call(page, 'GET', `${ORDERS}?search=${encodeURIComponent(prefix)}`)).value.items.some(o => o.id === id), 'server note search finds unique draft')
    if (stage === 'permissions') {
      step = 'reader and noaccess real permission boundaries'
      await logout()
      for (const role of ['reader', 'noaccess']) {
        const route = await login(page, role)
        if (role === 'reader') {
          check(route === ORDERS, 'reader route admitted')
          await search(prefix)
          await page.getByText(prefix, { exact: true }).first().waitFor()
          check((await call(page, 'GET', path)).status === 200, 'reader real detail GET allowed')
        } else {
          check(route === '/403', 'noaccess real router forbidden')
          check((await call(page, 'GET', ORDERS)).status === 403 && (await call(page, 'GET', path)).status === 403, 'noaccess GET/list 403')
        }
        check(await page.getByRole('button', { name: 'Nueva orden', exact: true }).count() === 0 && await page.getByRole('button', { name: 'Continuar', exact: true }).count() === 0 && await page.getByTestId('discard-order').count() === 0, `${role}: no mutation UI`)
        for (const [method, url, body] of [['POST', ORDERS, { supplierId: null, note: prefix, location: { detail: null }, lines: [] }], ['PUT', draft, { expectedVersion: current.version, order: { supplierId: null, note: prefix, location: { detail: null }, lines: [] } }], ['DELETE', path, { expectedVersion: current.version }]]) {
          check((await call(page, method, url, body)).status === 403, `${role}: direct ${method} 403`)
        }
        await shot(`${role}-1440-light`)
        await logout()
      }
      report.retainedSyntheticDraft = true
    } else {
      step = 'resolve uniquely prefixed disposable catalog fixtures'
      const supplierRead = await call(page, 'GET', `${SUPPLIERS}?status=ALL&search=${encodeURIComponent(credentials.prefix)}&limit=100`)
      const productRead = await call(page, 'GET', `/products?type=PRODUCT&search=${encodeURIComponent(credentials.prefix)}&page=1&limit=100`)
      const serviceRead = await call(page, 'GET', `/products?type=SERVICE&search=${encodeURIComponent(credentials.prefix)}&page=1&limit=100`)
      check(supplierRead.status === 200 && productRead.status === 200 && serviceRead.status === 200, 'real seeded catalog reads')
      const active = supplierRead.value.items.filter(x => x.status === 'ACTIVE'), archived = supplierRead.value.items.filter(x => x.status === 'ARCHIVED')
      const kg = productRead.value.filter(x => x.unit === 'KILOGRAMO' && !x.hasVariants), unit = productRead.value.filter(x => x.unit === 'UNIDAD' && !x.hasVariants && x.useStock !== false), variants = productRead.value.filter(x => x.unit === 'UNIDAD' && x.hasVariants)
      check(active.length === 1 && archived.length === 1 && kg.length === 1 && unit.length === 1 && variants.length === 1 && serviceRead.value.length === 1 && productRead.value.some(x => x.useStock === false), 'unambiguous prefixed ACTIVE/ARCHIVED, kg/unit/variant/nonstock/SERVICE fixtures')
      const supplier = active[0], variantProduct = variants[0]
      await resume()
      await d.getByText('Sin proveedor', { exact: true }).last().click()
      const archivedRead = waitRes(r => r.url().startsWith(API + SUPPLIERS) && new URL(r.url()).searchParams.get('search') === archived[0].displayName && r.status() === 200)
      await page.getByPlaceholder('Buscar proveedor activo...', { exact: true }).fill(archived[0].displayName)
      const archivedResponse = await archivedRead, archivedBody = await archivedResponse.json(); await settled()
      check(new URL(archivedResponse.url()).searchParams.get('status') === 'ACTIVE' && !archivedBody.items.some(x => x.id === archived[0].id) && await page.getByRole('option', { name: archived[0].displayName, exact: true }).count() === 0, 'ARCHIVED supplier not offered')
      await page.getByPlaceholder('Buscar proveedor activo...', { exact: true }).fill(supplier.displayName)
      await page.getByRole('option', { name: supplier.displayName, exact: true }).click()
      await d.getByRole('button', { name: 'Agregar renglón', exact: true }).click()
      await d.getByText('Seleccionar producto', { exact: true }).last().click()
      const serviceResponse = waitRes(r => r.url().startsWith(API + '/products?') && new URL(r.url()).searchParams.get('search') === serviceRead.value[0].name && r.status() === 200)
      await page.getByPlaceholder('Buscar producto...', { exact: true }).fill(serviceRead.value[0].name)
      const filtered = await serviceResponse; await settled()
      check(new URL(filtered.url()).searchParams.get('type') === 'PRODUCT' && !(await filtered.json()).some(x => x.type === 'SERVICE' || x.id === serviceRead.value[0].id) && await page.getByRole('option', { name: serviceRead.value[0].name, exact: true }).count() === 0, 'SERVICE excluded by real PRODUCT-only picker')
      await page.getByPlaceholder('Buscar producto...', { exact: true }).fill(kg[0].name)
      await page.getByRole('option', { name: kg[0].name, exact: true }).click()
      await d.getByTestId('line-quantity').fill('2.5'); await d.getByTestId('line-amount').fill('10.5'); await d.getByTestId('line-tax').selectOption('EXCLUDES_TAX')
      current = (await save(200)).value
      const subtotal = current.lineSubtotals[0].subtotal
      check(current.lines[0].orderedQuantity === '2.5' && current.lines[0].informedUnitCost.amount === '10.5' && current.lines[0].informedUnitCost.taxBasis === 'EXCLUDES_TAX' && subtotal !== null, 'PUT 200 canonical kilogram quantity/cost/tax')
      await d.getByText(`Último subtotal guardado: ${subtotal.amount} ${subtotal.currency}`, { exact: false }).waitFor()
      check(true, 'server subtotal displayed verbatim without FE arithmetic')
      await d.getByRole('button', { name: 'Agregar renglón', exact: true }).click(); await pick('Seleccionar producto', unit[0].name)
      await d.getByTestId('line-quantity').last().fill('1.5')
      let localWrites = 0
      const observeWrite = req => { if (req.url() === API + draft && req.method() === 'PUT') localWrites++ }
      page.on('request', observeWrite)
      await d.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
      await d.getByText('Escribe una cantidad positiva con el formato de esta unidad.', { exact: true }).waitFor(); await settled()
      check(localWrites === 0, 'UNIDAD 1.5 rejected locally with zero PUT requests')
      page.off('request', observeWrite)
      await d.getByRole('button', { name: 'Quitar renglón 2', exact: true }).click()
      await d.getByRole('button', { name: 'Agregar renglón', exact: true }).click(); await pick('Seleccionar producto', variantProduct.name)
      await d.getByTestId('line-quantity').last().fill('1')
      current = (await save(200)).value
      check(current.validation.issues.some(i => i.code === 'VARIANT_REQUIRED'), 'server VARIANT_REQUIRED on unselected UNIDAD variant')
      await d.getByText('Selecciona una variante del producto.', { exact: true }).waitFor()
      const variantRead = await call(page, 'GET', `/products/${variantProduct.id}/variants`)
      check(variantRead.status === 200 && variantRead.value.length === 2, 'two real seeded variants')
      await d.getByLabel('Variante', { exact: false }).selectOption(variantRead.value[0].id)
      current = (await save(200)).value
      check(!current.validation.issues.some(i => i.code === 'VARIANT_REQUIRED'), 'variant selection clears server diagnostic')
      await close(); await search(supplier.displayName)
      check((await call(page, 'GET', `${ORDERS}?search=${encodeURIComponent(supplier.displayName)}`)).value.items.some(o => o.id === id), 'server supplier-name search finds draft')
      await search(prefix); await resume()
      step = 'second-context competing PUT then explicit reload'
      await d.locator('textarea').fill(`${prefix}-local`)
      secondContext = await browserPage.context().browser().newContext({ serviceWorkers: 'block' })
      await attach(secondContext)
      const secondPage = await secondContext.newPage()
      await login(secondPage, 'manager')
      const input = order => ({ supplierId: order.supplierId, note: order.note, location: { detail: order.location.detail }, lines: order.lines.map(l => ({ lineId: l.lineId, productId: l.productId, variantId: l.variantId, orderedQuantity: l.orderedQuantity, informedUnitCost: l.informedUnitCost })) })
      const remoteOrder = input(current); remoteOrder.note = `${prefix}-remote`
      const changed = await call(secondPage, 'PUT', draft, { expectedVersion: current.version, order: remoteOrder })
      check(changed.status === 200, 'independent authenticated context competing PUT 200')
      const conflict = await save(409)
      check(safeCode(conflict.value.error || conflict.value.code) === 'ORDER_VERSION_CONFLICT' && await d.locator('textarea').inputValue() === `${prefix}-local`, '409 ORDER_VERSION_CONFLICT preserves local buffer')
      page.once('dialog', dialog => dialog.accept())
      await d.getByRole('button', { name: 'Descartar cambios locales y cargar versión actual', exact: true }).click()
      await page.waitForFunction(note => document.querySelector('textarea')?.value === note, remoteOrder.note)
      current = changed.value
      check(await d.locator('textarea').inputValue() === remoteOrder.note, 'explicit reload replaces local buffer')
      await secondContext.close(); secondContext = null
      step = 'uncertain PUT response and identical explicit retry'
      await d.locator('textarea').fill(`${prefix}-retry`)
      let first, count = 0, same = false
      const drop = async route => {
        try {
          if (route.request().method() !== 'PUT') return await route.fallback()
          count++
          const request = route.request()
          if (count === 1) {
            const response = await route.fetch(), value = await response.json()
            first = { status: response.status(), version: value.version, key: request.headers()['idempotency-key'], body: request.postData() }
            return await route.abort('connectionreset')
          }
          same = first.key === request.headers()['idempotency-key'] && first.body === request.postData()
          return await route.fallback()
        } catch { await route.abort('connectionreset').catch(() => {}) }
      }
      await page.route(API + draft, drop)
      await d.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
      await d.getByRole('button', { name: 'Reintentar', exact: true }).waitFor()
      check(first?.status === 200 && count === 1 && Boolean(first.key), 'one real committed PUT response dropped; no automatic retry')
      const replayResponse = waitRes(r => r.url() === API + draft && r.request().method() === 'PUT' && r.status() === 200)
      await d.getByRole('button', { name: 'Reintentar', exact: true }).click(); await replayResponse
      await d.getByRole('button', { name: 'Reintentar', exact: true }).waitFor({ state: 'hidden' })
      await page.unroute(API + draft, drop)
      const recovered = await call(page, 'GET', path)
      check(recovered.status === 200 && count === 2 && same && recovered.value.version === first.version && first.version === current.version + 1, 'Reintentar identical key/body and single version increment')
      report.uncertainResult = { committedStatus: first.status, sameKeyAndBody: same, versionAdvancedOnce: true, explicitReplayCount: 1 }; first = null
      current = recovered.value
      await close(); await search(`${prefix}-retry`)
      step = '390/1440 light/dark list, editor, discard confirmation'
      for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(theme => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.colorScheme = theme }, theme)
        check(await (width === 390 ? page.getByTestId('mobile-cards-list') : page.locator('table')).isVisible(), `canonical list ${width}/${theme}`)
        await shot(`list-${width}-${theme}`); await resume(); await shot(`editor-${width}-${theme}`); await close()
        await targetRow().getByTestId('discard-order').first().click(); await d.waitFor()
        await shot(`discard-confirm-${width}-${theme}`)
        await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); await d.waitFor({ state: 'hidden' })
      }
      step = 'supplier deletion restriction rendered in real supplier screen'
      check(current.supplierId === supplier.id, 'persisted draft references seeded supplier before restriction probe')
      check(await navigate(page, SUPPLIERS) === SUPPLIERS, 'real supplier route admitted')
      await page.getByPlaceholder('Buscar proveedor...', { exact: true }).fill(supplier.displayName)
      await page.getByRole('button', { name: `Eliminar ${supplier.displayName}`, exact: true }).click()
      await d.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
      await d.getByText('Este proveedor tiene órdenes de compra y no se puede eliminar. Puedes archivarlo.', { exact: true }).waitFor()
      await Promise.all(pending)
      check(report.requests.some(r => r.method === 'DELETE' && r.path === `${SUPPLIERS}/${supplier.id}` && r.status === 409 && r.error === 'SUPPLIER_HAS_PURCHASE_ORDERS'), 'supplier screen DELETE 409 SUPPLIER_HAS_PURCHASE_ORDERS')
      await shot('supplier-delete-restricted')
      await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); await d.waitFor({ state: 'hidden' })
      step = 'real discard 204, row gone, GET 404'
      await navigate(page, ORDERS); await search(`${prefix}-retry`)
      await targetRow().getByTestId('discard-order').first().click(); await d.waitFor()
      const deleted = waitRes(r => r.url() === API + path && r.request().method() === 'DELETE' && r.status() === 204)
      await page.getByTestId('confirm-discard').click(); await deleted; await d.waitFor({ state: 'hidden' })
      await page.getByText('Borrador descartado correctamente.', { exact: true }).waitFor()
      await page.getByText('No hay borradores de órdenes de compra.', { exact: true }).waitFor()
      check(await page.getByTestId('discard-order').count() === 0 && (await call(page, 'GET', path)).status === 404, 'discard DELETE 204 removes row; detail GET 404')
    }
    await Promise.all(pending)
    check(report.outsideScope.length === 0, 'no outsideScope requests')
    check(report.runtimeErrorCount === 0, 'zero uncaught browser runtime errors')
    report.verdict = 'script assertions passed; parent must visually inspect screenshots'
  } catch (error) {
    report.verdict = 'stopped'
    report.blocker = `Failed step: ${step}. No raw exception retained; inspect sanitized requests and last passed check.`
    // Short diagnostic only: first line, emails masked, no request bodies.
    report.failureSummary = String(error?.message ?? error).split('\n')[0].replace(/[^\s@]+@[^\s@]+/g, '[email]').slice(0, 200)
  } finally {
    if (secondContext) await secondContext.close().catch(() => {})
    if (context) await context.close().catch(() => {})
  }
  return report
}
