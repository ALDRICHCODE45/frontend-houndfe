// Canonical parent-run MCP harness for O3c. No execution during preparation.
// The three placeholders below are replaced by generate-runtime-mcp.mjs only.
const API = '__API_ORIGIN__'
const CREDENTIALS = '__CREDENTIALS_PATH__'
const DIR = '__EVIDENCE_DIR__'
// Git HEAD at generation time, and whether src/docs had uncommitted changes then (traceability, L19).
const COMMIT = '__COMMIT__'
const TREE_DIRTY = '__TREE_DIRTY__'
const ORIGIN = 'http://127.0.0.1:43179'
const ORDERS = '/procurement/purchase-orders'
const SUPPLIERS = '/procurement/suppliers'
// Display names announced by the backend for the disposable tenant (L13).
const NAMES = { manager: 'María González', confirmer: 'Sofía Ramírez', canceller: 'Jorge Martínez' }
const STAGE_ROLES = {
  manager: ['manager'],
  permissions: ['manager', 'editor', 'confirmer', 'canceller', 'reader', 'noaccess'],
  transitions: ['manager'],
}
const LABEL = { DRAFT: 'Borrador', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' }
// Readable options of the Estado filter, in the order the listbox shows them.
const STATUS_LABEL = { ALL: 'Todas', DRAFT: 'Borradores', CONFIRMED: 'Confirmadas', CANCELLED: 'Canceladas' }
// Money on screen: 2 decimals, es-MX (the exact server value lives in the title where it was rounded).
const MONEY = /\$[\d,]+\.\d{2}$/
// Display rounding of a server decimal string to 2 decimals stays within half a cent of it.
const nearAmount = (shown, amount) => Math.abs(decimalOf(shown) - Number(amount)) <= 0.005 + 1e-9
const hasExtraDecimals = amount => /\.\d*[1-9]\d*$/.test(amount) && amount.split('.')[1].replace(/0+$/, '').length > 2
const STALE_COPY = {
  ORDER_STATE_CONFLICT: 'La orden ya no está en un estado que permita esta acción. Revisa su estado actual.',
  // After a transition the order is already re-read (bb1ba884), so the copy no longer promises kept local edits.
  ORDER_VERSION_CONFLICT: 'La orden cambió en otra sesión. Ya se cargó su versión actual; revísala antes de continuar.',
}
const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
// formatShortDateTime: "3 nov, 20:43", with the year only when it is not the current one.
const SHORT_DATE = /^\d{1,2} [a-záéíóúñ]{3,5}( \d{4})?, \d{2}:\d{2}$/
const TONE = { DRAFT: 'warning', CONFIRMED: 'success', CANCELLED: 'neutral' }
// Copy the clarity pass removed from the open order (text diet): none of it may come back as a permanent paragraph.
const HELP_COPY = ['Puedes guardar el borrador incompleto', 'Hasta 2000 caracteres', 'Hasta 500 caracteres', 'Guarda tus cambios antes de confirmar o cancelar.', 'Completa los avisos del borrador para poder confirmarla.', 'Al confirmar se congelan el proveedor']
const decimalOf = text => Number(text.replace(/[^\d.]/g, ''))
// Same allowlist idea as O3b, narrowed to what the order screens and the harness need.
const allowed = (method, path) =>
  (method === 'POST' && ['/auth/login', '/auth/logout', '/auth/refresh'].includes(path)) ||
  (method === 'GET' && ['/auth/me', '/auth/me/permissions', '/products', SUPPLIERS].includes(path)) ||
  (method === 'GET' && /^\/products\/[a-z0-9-]+\/variants$/.test(path)) ||
  (method === 'GET' && /^\/procurement\/suppliers\/[a-z0-9-]+$/.test(path)) ||
  (['GET', 'POST'].includes(method) && path === ORDERS) ||
  (method === 'GET' && /^\/procurement\/purchase-orders\/[a-z0-9-]+$/.test(path)) ||
  (method === 'POST' && /^\/procurement\/purchase-orders\/[a-z0-9-]+\/(confirm|cancel)$/.test(path))
const safeCode = code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : null
const redact = path => path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')

export async function run(browserPage, stage, part = null) {
  const report = {
    stage, commit: COMMIT, workingTreeDirty: TREE_DIRTY, checks: [], findings: [], requests: [], outsideScope: [], screenshots: [], nativeDialogs: [], observed: {}, showcase: {},
    runtimeErrorCount: 0, verdict: 'incomplete',
    coverage: 'real mounted auth/router and UI; direct boundary probes use browser fetch with the same session, not feature adapters',
  }
  let context, step = 'validate configured placeholders'
  const check = (ok, name) => { if (!ok) { report.failureCheck = name; throw new Error('Assertion failed') } report.checks.push(name) }
  // A finding is recorded but does not stop the stage: it documents a divergence from the brief.
  const finding = (ok, name) => { (ok ? report.checks : report.findings).push(name) }
  const pending = []
  const log = [] // raw response log; summarised into report.requests at the end
  try {
    check(Object.keys(STAGE_ROLES).includes(stage), 'known stage')
    check(/^[0-9a-f]{40}$/.test(COMMIT) && typeof TREE_DIRTY === 'boolean', 'report carries the git commit the harness was generated from')
    check(/^http:\/\/127\.0\.0\.1:\d+$/.test(API) && !['3000', '43179', '0'].includes(API.split(':').at(-1)) && Number(API.split(':').at(-1)) <= 65535, 'explicit disposable loopback API configured')
    check(CREDENTIALS.startsWith('/') && !CREDENTIALS.includes('__') && DIR.startsWith('/') && !DIR.includes('__'), 'absolute credentials path and evidence directory configured')
    context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const credentialPage = await context.newPage()
    let credentials
    try {
      await credentialPage.route('**/*', route => route.abort('blockedbyclient'))
      await credentialPage.setContent('<input id="fixture-credentials" type="file">')
      await credentialPage.locator('#fixture-credentials').setInputFiles(CREDENTIALS)
      // Read in browser memory only; the callback keeps nothing but what the stage logs in with.
      credentials = await credentialPage.locator('#fixture-credentials').evaluate(async (input, roles) => {
        const data = JSON.parse(await input.files[0].text())
        const users = {}
        for (const role of roles) users[role] = { email: data.users?.[role]?.email, password: data.users?.[role]?.password ?? data.password }
        return { apiOrigin: data.apiOrigin ?? null, users }
      }, STAGE_ROLES[stage])
    } finally { await credentialPage.close() }
    check(credentials.apiOrigin === null || credentials.apiOrigin === API, 'credential API origin matches the configured API')
    check(STAGE_ROLES[stage].every(role => typeof credentials.users[role].email === 'string' && typeof credentials.users[role].password === 'string'), 'credential schema has every role this stage logs in with')
    const attach = async ctx => {
      await ctx.addInitScript(() => { try { localStorage.setItem('vueuse-color-mode', 'light') } catch {} })
      await ctx.route('**/*', route => {
        const req = route.request(), url = new URL(req.url()), method = req.method()
        if (url.origin === ORIGIN) return route.continue().catch(() => {})
        if (url.origin === API && (allowed(method, url.pathname) || (method === 'OPTIONS' && ['GET', 'POST'].some(m => allowed(m, url.pathname))))) return route.continue().catch(() => {})
        if (method === 'GET' && url.protocol === 'https:' && ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'].includes(url.hostname)) return route.continue().catch(() => {})
        report.outsideScope.push({ method, origin: url.origin === API ? 'configured-api' : 'unapproved-origin', path: allowed('GET', url.pathname) ? redact(url.pathname) : '[redacted-unapproved-path]' })
        return route.abort('blockedbyclient').catch(() => {})
      })
      ctx.on('page', p => {
        p.setDefaultTimeout(15000)
        p.on('pageerror', error => {
          report.runtimeErrorCount++
          ;(report.runtimeErrors ??= []).push(String(error?.message ?? error).replace(/[^\s@]+@[^\s@]+/g, '[email]').slice(0, 160))
        })
        // The only native prompt expected is the unsaved-changes confirm; count and accept it.
        p.on('dialog', dialog => { report.nativeDialogs.push(`${dialog.type()}: ${dialog.message().slice(0, 60)}`); dialog.accept().catch(() => {}) })
        p.on('response', res => {
          const url = new URL(res.url()), req = res.request()
          if (url.origin !== API || !allowed(req.method(), url.pathname)) return
          const row = { method: req.method(), path: redact(url.pathname), status: res.status(), error: null }
          if (req.method() === 'GET' && url.pathname === ORDERS) {
            const value = url.searchParams.get('status')
            row.statusParam = value === null ? null : ['DRAFT', 'CONFIRMED', 'CANCELLED'].includes(value) ? value : 'other'
          }
          log.push(row)
          if (res.status() >= 400) pending.push(res.json().then(body => { row.error = safeCode(body.error) || safeCode(body.code) }).catch(() => {}))
        })
      })
    }
    await attach(context)
    const page = await context.newPage()
    step = 'open the FE origin'
    await page.goto(`${ORIGIN}/login`)
    const waitRes = predicate => { const waiting = page.waitForResponse(predicate); waiting.catch(() => {}); return waiting }
    const uuid = () => page.evaluate(() => crypto.randomUUID())
    const until = async (fn, name, ms = 10000) => {
      const end = Date.now() + ms
      while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(100) }
      return check(false, name)
    }
    let vw = 1440
    let statusNow = '', searchNow = '' // mirror of the list filters held by the mounted view
    const setView = async (width, theme) => {
      vw = width
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(theme => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.colorScheme = theme }, theme)
    }
    const navigate = async path => page.evaluate(async path => {
      const globals = document.querySelector('#app')?.__vue_app__?.config.globalProperties
      if (!globals?.$router) return false
      await globals.$router.replace(path)
      return globals.$router.currentRoute.value.path
    }, path)
    const login = async role => {
      step = `${role}: real mounted auth login and route admission`
      await page.goto(`${ORIGIN}/login`)
      await page.waitForFunction(() => Boolean(document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('auth')))
      const ok = await page.evaluate(async ({ email, password }) => {
        try {
          const auth = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth')
          await auth.login({ email, password })
          if (!auth.isAuthenticated || auth.authPhase !== 'authenticated' || !auth.permissionsLoaded) return false
          await auth.fetchMe()
          return true
        } catch { return false }
      }, credentials.users[role])
      check(ok, `${role}: real mounted auth store authenticated (no replacement router/store)`)
      statusNow = ''; searchNow = ''
      return await navigate(ORDERS)
    }
    const logout = async () => {
      const ok = await page.evaluate(async () => { try { await document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth').logout(); return true } catch { return false } })
      check(ok, 'real mounted store logout')
    }
    // Tokens never cross the evaluate bridge. Paths are checked BEFORE fetch.
    const call = async (method, path, body) => {
      check(allowed(method, path.split('?')[0]), 'direct probe restricted to allowlist')
      return await page.evaluate(async ({ api, method, path, body }) => {
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
    // Two overlays can be open at once (editor + confirmation), so address them by content.
    const slide = () => page.locator('[role="dialog"]').filter({ has: page.locator('form.order-form, [data-testid="order-readonly"]') })
    const modal = () => page.locator('[role="dialog"]').filter({ has: page.getByTestId('cancel-transition') })
    const scanIds = async name => {
      const leaks = await page.evaluate(source => {
        const re = new RegExp(source, 'i')
        const attrs = [...document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')].map(n => ['aria-label', 'title', 'placeholder', 'alt'].map(a => n.getAttribute(a) ?? '').join(' ')).join('\n')
        return [document.body.innerText, attrs].filter(text => re.test(text)).length
      }, UUID_SOURCE)
      check(leaks === 0, `no uuid-like string in visible text or labels: ${name}`)
    }
    // Open-order design (S8, artboards 04/05): the 48rem cap, a fixed header and footer around one scrolling body, a single solid
    // primary, the sticky bar on mobile, no loose secondary buttons and the Geist face. Measures the open order, if any.
    const ORDER_CAP_REM = 48
    const orderDesign = async name => {
      const m = await page.evaluate(() => {
        const dialog = [...document.querySelectorAll('[role="dialog"]')].find(d => d.querySelector('form.order-form, [data-testid="order-readonly"]'))
        if (!dialog) return null
        const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
        const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
        const main = dialog.querySelector('form.order-form, [data-testid="order-readonly"]')
        return { content: box(dialog), rem, innerWidth, innerHeight, formWidth: main.getBoundingClientRect().width,
          header: box(dialog.querySelector('.order-header')), body: box(dialog.querySelector('.order-body')), footer: box(dialog.querySelector('[data-testid="order-footer"]')),
          primaries: [...dialog.querySelectorAll('.hf-primary-control')].filter(shown).length,
          fontFamily: getComputedStyle(dialog.querySelector('.order-header-title')).fontFamily,
          loose: [...dialog.querySelectorAll('button')].filter(b => /^(Cancelar orden|Descartar|Quitar|Cambiar producto)/.test((b.textContent ?? '').trim())).length }
      })
      if (!m) return
      const cap = ORDER_CAP_REM * m.rem
      if (vw >= 768) {
        check(m.content.width <= cap + 1, `order slideover is at most ${ORDER_CAP_REM}rem wide (${Math.round(m.content.width)}px of ${Math.round(cap)}px): ${name}`)
        check(m.content.width < m.innerWidth - 100, `order slideover does not stretch to the viewport: ${name}`)
        check(m.formWidth <= cap + 1, `order content is at most ${ORDER_CAP_REM}rem wide: ${name}`)
      } else check(m.content.width >= m.innerWidth - 1, `the order is a full-screen sheet at ${vw}: ${name}`)
      check(Boolean(m.header) && Boolean(m.body) && m.header.bottom <= m.body.y + 1, `the header sits above the scrolling body: ${name}`)
      if (m.footer) {
        check(m.body.bottom <= m.footer.y + 1 && m.footer.bottom <= m.content.bottom + 1, `the footer sits under the body, inside the order: ${name}`)
        if (vw < 768) check(Math.abs(m.footer.bottom - m.innerHeight) <= 1, `the sticky action bar is pinned to the bottom edge at ${vw}: ${name}`)
      }
      check(m.primaries <= 1, `at most one solid primary in the open order (${m.primaries}): ${name}`)
      check(m.loose === 0, `Cancelar, Descartar, Quitar and Cambiar producto live in ⋮ menus, not as loose buttons: ${name}`)
      check(/Geist/.test(m.fontFamily), `computed font-family of the open order contains Geist (${m.fontFamily.slice(0, 40)}): ${name}`)
    }
    const shot = async name => {
      await settled()
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no page overflow: ${name}`)
      // The dialog can fit while a scrolling descendant overflows sideways, so inspect those too.
      const offenders = await page.evaluate(() => {
        const label = n => `${n.tagName.toLowerCase()}.${String(n.className?.baseVal ?? n.className).split(' ').slice(0, 3).join('.')}`
        const shown = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
        const scrolls = n => ['auto', 'scroll'].includes(getComputedStyle(n).overflowX) && n.scrollWidth > n.clientWidth + 1
        const out = []
        for (const dialog of document.querySelectorAll('[role="dialog"]')) {
          if (!shown(dialog)) continue
          const r = dialog.getBoundingClientRect()
          if (dialog.scrollWidth > dialog.clientWidth + 1 || r.left < -1 || r.right > innerWidth + 1) out.push(`dialog ${label(dialog)} ${dialog.scrollWidth}>${dialog.clientWidth}`)
          for (const n of dialog.querySelectorAll('*')) if (scrolls(n)) out.push(`dialog scroller ${label(n)} ${n.scrollWidth}>${n.clientWidth}`)
        }
        if (innerWidth < 768) for (const n of document.querySelectorAll('main *')) if (scrolls(n)) out.push(`page scroller ${label(n)} ${n.scrollWidth}>${n.clientWidth}`)
        return out.slice(0, 6)
      })
      if (offenders.length) (report.overflow ??= {})[name] = offenders
      check(offenders.length === 0, `no horizontal overflow in page, dialogs or their scrolling descendants: ${name}`)
      await orderDesign(name)
      const path = `${DIR}/runtime-${stage}-${name}.png`
      await page.screenshot({ path, fullPage: true, animations: 'disabled', mask: [page.getByText(/[^\s@]+@[^\s@]+\.[^\s@]+/), page.locator('input[type="password"],input[type="email"]')] })
      report.screenshots.push(path)
    }
    const snap = async name => { await scanIds(name); await shot(name) }

    // ---- list helpers: filters, rows, readable lookup ----
    const isList = (r, status, term) => {
      const u = new URL(r.url())
      return u.origin === API && u.pathname === ORDERS && r.request().method() === 'GET' && (u.searchParams.get('status') || '') === status && (u.searchParams.get('search') || '') === term && r.status() === 200
    }
    const rows = () => page.locator(vw < 768 ? 'article.order-card' : 'tbody tr').filter({ has: page.locator('button.hf-row-primary') })
    // The refresh button left the toolbar, and the app re-reads the list after every command, so repeating a term needs no new request.
    const applySearch = async term => {
      if (searchNow === term) return null
      const response = waitRes(r => isList(r, statusNow, term))
      await page.getByPlaceholder('Buscar por proveedor o nota...', { exact: true }).fill(term)
      searchNow = term
      return await response
    }
    // The Estado filter is a USelect: open its listbox and pick the option by its readable label.
    // On mobile it lives in the Filtros bottom sheet.
    const withStatusSelect = async fn => {
      const mobile = vw < 768
      if (mobile) await page.getByTestId('toolbar-filtros-button').click()
      const trigger = page.getByTestId('order-status-filter')
      await trigger.waitFor({ state: 'visible' })
      try { return await fn(trigger) } finally {
        if (mobile) { await page.getByTestId('toolbar-filters-close').click(); await trigger.waitFor({ state: 'hidden' }) }
      }
    }
    const statusValue = () => withStatusSelect(async trigger => {
      const label = (await trigger.innerText()).trim()
      return Object.keys(STATUS_LABEL).find(key => STATUS_LABEL[key] === label) ?? null
    })
    const setStatus = async value => {
      const wanted = value === 'ALL' ? '' : value
      if (wanted === statusNow) return null
      return await withStatusSelect(async trigger => {
        const response = waitRes(r => isList(r, wanted, searchNow))
        await trigger.click()
        await page.getByRole('option', { name: STATUS_LABEL[value], exact: true }).click()
        statusNow = wanted
        return await response
      })
    }
    // Design assertions for the filter (S8/S9 D1). Runs with Todas selected, so choosing it again changes nothing.
    const filterDesign = async tag => {
      step = `filter design checks: ${tag}`
      const mobile = vw < 768
      check(await page.getByTestId('refresh-orders').count() === 0, `the toolbar has no refresh button at ${vw}: ${tag}`)
      await withStatusSelect(async trigger => {
        check(await trigger.getAttribute('role') === 'combobox' && await trigger.getAttribute('aria-label') === 'Estado', `Estado filter is a labelled combobox: ${tag}`)
        check(await page.locator('.hf-toolbar select, [data-testid="toolbar-filters-body"] select, select[data-testid="order-status-filter"]').count() === 0, `no native select in the toolbar or the Filtros sheet: ${tag}`)
        const box = await trigger.boundingBox()
        check(Boolean(box) && box.height >= 43.5, `Estado trigger keeps the 44px hit area: ${tag}`)
        if (mobile) {
          check((await page.getByTestId('toolbar-filters-body').innerText()).includes('Estado'), `Estado is a titled section of the Filtros sheet: ${tag}`)
        } else {
          const search = await page.getByPlaceholder('Buscar por proveedor o nota...', { exact: true }).boundingBox()
          check(Boolean(search) && Math.abs(search.y + search.height / 2 - (box.y + box.height / 2)) <= 6 && box.x >= search.x + search.width - 1, `Estado filter shares the search row at ${vw}: ${tag}`)
          // V1: the filter must be fully visible inside the table card (a clipped or overflowing filter used to pass the row check).
          const card = await page.locator('.hf-table-surface').first().boundingBox()
          check(Boolean(card) && box.x >= card.x && box.x + box.width <= card.x + card.width && box.y >= card.y && box.y + box.height <= card.y + card.height, `Estado filter lies fully inside the table card at ${vw}: ${tag}`)
          // The toolbar is search, Estado and one primary at the card's right edge; the refresh button is gone (catalog: Toolbar).
          const create = await page.getByTestId('create-order').boundingBox()
          const mid = b => b.y + b.height / 2
          check(Boolean(create) && Math.abs(mid(create) - mid(search)) <= 6, `Nueva orden is on the search row at ${vw}: ${tag}`)
          check(search.x < box.x && box.x + box.width <= create.x + 1, `toolbar order is search, Estado, Nueva orden at ${vw}: ${tag}`)
          check(card.x + card.width - (create.x + create.width) <= 40 && card.x + card.width - (create.x + create.width) >= 0, `Nueva orden is right-aligned to the table card at ${vw}: ${tag}`)
          check(search.width <= 24 * 16 + 1 && search.width >= 200, `the search is bounded (${Math.round(search.width)}px) and leaves room for the filter and actions at ${vw}: ${tag}`)
        }
        await trigger.click()
        const options = (await page.getByRole('option').allInnerTexts()).map(text => text.trim())
        check(JSON.stringify(options) === JSON.stringify(Object.values(STATUS_LABEL)), `the listbox offers ${Object.values(STATUS_LABEL).join(', ')} by readable label: ${tag}`)
        await page.getByRole('option', { name: STATUS_LABEL.ALL, exact: true }).click()
        await page.getByRole('listbox').waitFor({ state: 'hidden' })
      })
    }
    const badges = async (name, expected) => {
      await until(async () => expected === undefined ? (await rows().count()) > 0 : (await rows().count()) === expected, `rows rendered: ${name}`)
      const count = await rows().count()
      const labels = (await rows().locator('[data-testid="order-status"]').allTextContents()).map(t => t.trim())
      check(labels.length === count && labels.every(t => Object.values(LABEL).includes(t)), `every row carries a status badge (Borrador/Confirmada/Cancelada): ${name}`)
      check(await (vw < 768 ? page.getByTestId('mobile-cards-list') : page.locator('table')).first().isVisible(), `canonical ${vw < 768 ? 'mobile cards' : 'table'} layout: ${name}`)
      return labels
    }
    const termOf = order => (order.note ?? '').split('\n')[0].trim().slice(0, 100) || order.supplierName
    // Locate by a readable term (note or supplier name); the row index comes from the same query's API order.
    const locateRow = async (order, name) => {
      const term = termOf(order)
      check(Boolean(term), `${name}: order has a readable note or supplier name`)
      await setStatus('ALL')
      await applySearch(term)
      const found = await call('GET', `${ORDERS}?search=${encodeURIComponent(term)}&limit=25`)
      const index = found.status === 200 ? found.value.items.findIndex(item => item.id === order.id) : -1
      check(index >= 0, `${name}: located through the readable search term`)
      await until(async () => (await rows().count()) === found.value.items.length && (await rows().nth(index).innerText()).includes(order.supplierName ?? term), `${name}: rendered rows match the query result`)
      return index
    }
    // The whole row opens the order (a click on a plain cell); `via: 'button'` uses the primary button, the keyboard path to the same target.
    const openOrder = async (order, name, via = 'row') => {
      const row = rows().nth(await locateRow(order, name))
      if (via === 'button') await row.locator('button.hf-row-primary').click()
      else await (vw < 768 ? row.locator('.order-card-footer') : row.locator('td').nth(2)).click()
      await slide().waitFor({ state: 'visible' })
    }
    const closeEditor = async ({ restoresFocus = false } = {}) => {
      await page.keyboard.press('Escape'); await slide().waitFor({ state: 'hidden' })
      // The row's primary button is what an order opened from the list gives focus back to (the menu item or cell is gone or not focusable).
      if (restoresFocus) await until(() => page.evaluate(() => document.activeElement?.classList.contains('hf-row-primary') ?? false), 'closing the order returns focus to the row that opened it')
    }
    // Polls: the list re-reads itself after the command, and the order of rows can change with the status.
    const rowStatus = async (order, name, expected) => {
      const term = termOf(order)
      await applySearch(term)
      let text = ''
      await until(async () => {
        const found = await call('GET', `${ORDERS}?search=${encodeURIComponent(term)}&limit=25`)
        const index = found.status === 200 ? found.value.items.findIndex(item => item.id === order.id) : -1
        if (index < 0 || (await rows().count()) !== found.value.items.length) return false
        text = (await rows().nth(index).locator('[data-testid="order-status"]').innerText()).trim()
        return text === expected
      }, `${name}: list row shows ${expected}`)
      return text
    }

    // ---- ⋮ menus: read what a menu offers without choosing anything ----
    const menuInfo = menu => menu.evaluate(el => {
      const items = [...el.querySelectorAll('[role="menuitem"]')]
      const last = items[items.length - 1]
      const separator = el.querySelector('[role="separator"]')
      const dangerous = item => String(item.className).includes('hf-row-action-danger')
      return {
        labels: items.map(item => item.textContent.trim()),
        disabled: items.filter(item => item.getAttribute('aria-disabled') === 'true' || item.hasAttribute('data-disabled')).map(item => item.textContent.trim()),
        dangerCount: items.filter(dangerous).length, dangerLast: Boolean(last) && dangerous(last),
        separatorBeforeDanger: Boolean(separator && last && dangerous(last) && (separator.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING)),
      }
    })
    const closeMenu = async menu => { await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' }) }
    const openRowMenu = async (order, name) => {
      const row = rows().nth(await locateRow(order, name))
      await row.getByRole('button', { name: /^Acciones de la orden/ }).click()
      const menu = page.getByRole('menu')
      await menu.waitFor({ state: 'visible' })
      return { row, menu }
    }
    const rowMenu = async (order, name) => {
      const { menu } = await openRowMenu(order, name)
      const info = await menuInfo(menu)
      await closeMenu(menu)
      check(await slide().count() === 0, `${name}: opening the ⋮ menu does not open the order`)
      return info
    }
    const sameLabels = (info, expected) => JSON.stringify(info.labels) === JSON.stringify(expected)

    // ---- editor / transition helpers ----
    const present = id => slide().getByTestId(id).count().then(n => n > 0)
    // The header primary is aria-disabled (never `disabled`) and points at the checklist; "ready" means it is not.
    const confirmState = async () => {
      const button = slide().getByTestId('confirm-order')
      if (await button.count() === 0) return null
      return await button.getAttribute('aria-disabled') === 'true' ? 'blocked' : 'ready'
    }
    const headerTrigger = () => slide().getByRole('button', { name: 'Más acciones de la orden', exact: true })
    const NO_MENU = { labels: [], disabled: [], dangerCount: 0, dangerLast: false, separatorBeforeDanger: false }
    // The header ⋮ is the only home of Cancelar orden… and Descartar borrador.
    const headerMenu = async () => {
      if (await headerTrigger().count() === 0) return NO_MENU
      await headerTrigger().click()
      const menu = page.getByRole('menu')
      await menu.waitFor({ state: 'visible' })
      const info = await menuInfo(menu)
      await closeMenu(menu)
      return info
    }
    const cancelAvailable = async () => { const info = await headerMenu(); return info.labels.includes('Cancelar orden…') && !info.disabled.includes('Cancelar orden…') }
    const openTransition = async kind => {
      if (kind === 'confirm') await slide().getByTestId('confirm-order').click()
      else {
        await headerTrigger().click()
        await page.getByRole('menuitem', { name: 'Cancelar orden…', exact: true }).click()
      }
      await modal().waitFor({ state: 'visible' })
    }
    const noTransitionUi = async name => {
      check(!(await present('confirm-order')) && !(await headerMenu()).labels.includes('Cancelar orden…') && await slide().getByRole('button', { name: /^(Confirmar|Cancelar) orden$/ }).count() === 0, `no Confirmar/Cancelar order UI: ${name}`)
    }
    // A draft without update permission renders the read-only block (D3): no form, no controls to disable, marked Solo lectura in the header.
    const readOnlyDraft = async name => {
      const block = slide().getByTestId('order-readonly')
      await block.waitFor()
      check(await slide().locator('form.order-form').count() === 0 && await slide().getByRole('button', { name: /^(Guardar|Agregar renglón|Cambiar producto|Quitar)/ }).count() === 0, `read-only draft has no form or edit controls: ${name}`)
      check(await block.locator('button, input, select, textarea, [disabled], [aria-disabled="true"]').count() === 0, `read-only draft has no buttons or disabled controls in its block: ${name}`)
      check((await slide().getByTestId('order-status').first().innerText()).trim() === LABEL.DRAFT, `read-only draft shows the Borrador status badge: ${name}`)
      check((await slide().locator('.order-header-meta').innerText()).includes('Solo lectura'), `read-only draft is marked Solo lectura: ${name}`)
    }
    // Money in read-only views is es-MX currency in tabular right-aligned cells; absent amounts read a dash, a missing one Falta.
    const moneyCells = async name => {
      const cells = slide().locator('[data-testid="line-cost"], [data-testid="line-subtotal"]')
      const texts = (await cells.allInnerTexts()).map(t => t.trim())
      check(texts.length > 0 && texts.every(text => text === '—' || /^Falta( el costo| la cantidad)?$/.test(text) || MONEY.test(text)), `read-only money matches $1,234.00 with 2 decimals (or a dash, or Falta): ${name}`)
      check(await cells.evaluateAll(nodes => nodes.every(n => { const s = getComputedStyle(n); return s.fontVariantNumeric.includes('tabular-nums') && ['right', 'end'].includes(s.textAlign) })), `read-only money is right-aligned with tabular numerals: ${name}`)
    }
    const disabledPrimaryLegible = async name => {
      const style = await slide().getByTestId('confirm-order').evaluate(el => { const s = getComputedStyle(el); return { opacity: s.opacity, cursor: s.cursor } })
      check(style.opacity === '1' && style.cursor === 'not-allowed', `disabled Confirmar orden is not faded: ${name}`)
    }
    const modalCopy = async (kind, name, order) => {
      const text = await modal().innerText()
      check(/No se modifican existencias, pagos ni deuda/.test(text), `${kind} dialog says it does not move stock, payments or debt: ${name}`)
      check(kind === 'confirm' ? /Se congelarán/.test(text) : /definitiva/.test(text), `${kind} dialog copy: ${name}`)
      check(await modal().locator('input, textarea, select').count() === 0, `${kind} dialog has no reason field: ${name}`)
      // D5: a compact summary of what is being confirmed or cancelled, with no client-side totals.
      const summary = modal().getByTestId('order-summary')
      await summary.waitFor({ state: 'visible' })
      const summaryText = await summary.innerText()
      const shown = Math.min(5, order.lines.length)
      const items = (await summary.locator('li').allInnerTexts()).map(t => t.trim())
      check(summaryText.includes(order.supplierName) && summaryText.includes(order.tenantName), `${kind} dialog summary names the supplier and the location: ${name}`)
      check((await summary.locator('dd').nth(2).innerText()).trim() === String(order.lines.length), `${kind} dialog summary shows the line count: ${name}`)
      check(items.length === shown && order.lineNames.slice(0, shown).every((product, i) => items[i].includes(product) && items[i].includes(' — ')), `${kind} dialog summary lists up to 5 lines as product — quantity: ${name}`)
      check(order.lines.length > 5 ? summaryText.includes(`y ${order.lines.length - 5} ${order.lines.length - 5 === 1 ? 'renglón' : 'renglones'} más`) : !summaryText.includes('más'), `${kind} dialog summary counts the remaining lines: ${name}`)
      check(!/\$|Total/.test(summaryText), `${kind} dialog summary shows no totals: ${name}`)
    }
    const escapeReturnsFocus = async (kind, name) => {
      await openTransition(kind)
      await page.keyboard.press('Escape')
      await modal().waitFor({ state: 'hidden' })
      check(await slide().isVisible(), `Escape closes only the confirmation dialog: ${name}`)
      // Confirmar returns to the primary; Cancelar was chosen in the header ⋮, so focus goes back to that trigger.
      await until(() => page.evaluate(kind => { const el = document.activeElement; return kind === 'confirm' ? el?.getAttribute('data-testid') === 'confirm-order' : el?.getAttribute('aria-label') === 'Más acciones de la orden' }, kind), `focus returns to the invoker after Escape: ${name}`)
    }
    const transition = async (kind, name) => {
      await openTransition(kind)
      const done = waitRes(r => r.request().method() === 'POST' && r.url().startsWith(API + ORDERS + '/') && r.url().endsWith('/' + kind) && r.status() === 200)
      await modal().getByTestId('confirm-transition').click()
      await done
      await modal().waitFor({ state: 'hidden' })
      await slide().getByTestId('order-readonly').waitFor()
      report.checks.push(`${kind} applied through the dialog: ${name}`)
    }
    const expectClosed = async (state, actor, name) => {
      const s = slide()
      await s.getByTestId('order-readonly').waitFor()
      check(await s.locator('form.order-form, textarea, input, select').count() === 0 && await s.getByRole('button', { name: 'Guardar borrador', exact: true }).count() === 0, `form fields are gone: ${name}`)
      await until(async () => (await s.getByTestId('order-status').first().innerText()).trim() === LABEL[state], `header status badge is ${LABEL[state]}: ${name}`)
      await s.getByText(`${LABEL[state]} por ${actor}`, { exact: false }).first().waitFor()
      report.checks.push(`read-only block shows "${LABEL[state]} por ${actor}": ${name}`)
    }
    const subtotalsMatch = async (order, name) => {
      const texts = (await slide().locator('[data-testid="line-subtotal"]').allInnerTexts()).map(t => t.trim())
      const costs = (await slide().locator('[data-testid="line-cost"]').allInnerTexts()).map(t => t.trim())
      // Formatting never recalculates: the digits equal the server decimal string, rounded to 2 decimals for display (the exact value is the title).
      const same = (text, amount) => MONEY.test(text) && nearAmount(text, amount)
      const subtotals = order.lines.map(line => order.subtotals.find(item => item.lineId === line.lineId)?.subtotal ?? null)
      check(texts.length > 0 && texts.length === subtotals.length && texts.every((text, i) => subtotals[i] ? same(text, subtotals[i].amount) : text === '—'), `line subtotals are the server values formatted as currency (dash when none): ${name}`)
      check(costs.length === order.lines.length && costs.every((text, i) => order.lines[i].informedUnitCost?.amount ? same(text, order.lines[i].informedUnitCost.amount) : text === '—'), `unit costs are the server values formatted as currency: ${name}`)
      await moneyCells(name)
    }

    // ---- list design (artboards 02 and 05), checked against the API page the list shows ----
    const totalCheck = async (row, item, label) => {
      const cell = row.locator('[data-testid="order-total"]')
      const totals = item.totals ?? null
      if (totals === null) { check((await cell.innerText()).trim() === '—', `${label}: no server total reads a dash`); return }
      const entries = cell.locator('.order-total-entry')
      check(await entries.count() === totals.length, `${label}: ${totals.length} total ${totals.length === 1 ? 'entry' : 'entries'}, as the server sent`)
      for (const [n, total] of totals.entries()) {
        const text = (await entries.nth(n).innerText()).trim()
        const shown = text.replace(/\s*(sin|con) imp\.$/, '')
        check(MONEY.test(shown) && nearAmount(shown, total.amount), `${label}: total ${n + 1} is the server amount, 2 decimals and not recalculated`)
        const title = await entries.nth(n).getAttribute('title')
        check(hasExtraDecimals(total.amount) ? title !== null && decimalOf(title) === Number(total.amount) : title === null, `${label}: total ${n + 1} carries the exact value in its title only where it was rounded`)
        if (totals.length === 2) check(text.endsWith(total.taxBasis === 'EXCLUDES_TAX' ? 'sin imp.' : 'con imp.'), `${label}: total ${n + 1} carries its tax basis label`)
      }
      if (totals.length === 1) check(await cell.locator('.order-total-basis').count() === 0, `${label}: a single total has no basis label`)
      if (totals.length === 2 && vw >= 768) {
        const [a, b] = [await entries.nth(0).boundingBox(), await entries.nth(1).boundingBox()]
        check(Boolean(a) && Boolean(b) && b.y >= a.y + a.height - 1, `${label}: the two totals are stacked, never summed`)
      }
      if (vw >= 768) check(await cell.evaluate(el => { const style = getComputedStyle(el); return ['right', 'end'].includes(style.textAlign) && style.fontVariantNumeric.includes('tabular-nums') }), `${label}: the total is right-aligned with tabular numerals`)
    }
    const listDesign = async tag => {
      step = `list design checks: ${tag}`
      const mobile = vw < 768
      check((await page.locator('main h1').first().innerText()).trim() === 'Órdenes de compra' && await page.locator('main .hf-page-header p, main .hf-page-subtitle').count() === 0, `the page header is only the title, with no subtitle: ${tag}`)
      check(/Geist/.test(await page.locator('main').first().evaluate(el => getComputedStyle(el).fontFamily)), `computed font-family of the page contains Geist: ${tag}`)
      if (!mobile) {
        const heads = (await page.locator('thead th').allTextContents()).map(text => text.trim())
        check(JSON.stringify(heads) === JSON.stringify(['Proveedor', 'Estado', 'Renglones', 'Total', 'Actualizada', 'Acciones']), `columns are Proveedor, Estado, Renglones, Total, Actualizada, Acciones: ${tag}`)
      }
      const api = await call('GET', `${ORDERS}?limit=25`)
      check(api.status === 200, `the API page behind the list reads: ${tag}`)
      const items = api.value.items
      await until(async () => (await rows().count()) === items.length, `rows match the API page (${items.length}): ${tag}`)
      for (const [i, item] of items.entries()) {
        const row = rows().nth(i), label = `${tag} row ${i + 1}`
        const primary = row.locator('button.hf-row-primary')
        check((await primary.innerText()).trim() === (item.supplierDisplaySnapshot?.displayName ?? 'Sin proveedor') && await primary.evaluate(el => getComputedStyle(el).fontWeight) === '600', `${label}: the supplier is the semibold primary button`)
        check(await row.locator('.hf-row-secondary').count() === (item.note ? 1 : 0), `${label}: the note is the secondary line`)
        const badge = row.locator('[data-testid="order-status"]')
        check((await badge.innerText()).trim() === LABEL[item.status] && await badge.getAttribute('data-tone') === TONE[item.status], `${label}: status badge ${LABEL[item.status]} with the ${TONE[item.status]} tone`)
        const aviso = row.locator('[data-testid="order-aviso"]')
        check(await aviso.count() === (item.issueCount > 0 ? 1 : 0) && (item.issueCount === 0 || /aviso/.test(await aviso.innerText())), `${label}: an aviso marker only when there are avisos`)
        await totalCheck(row, item, label)
        const date = (await (mobile ? row.locator('.order-card-footer > span').last() : row.locator('td').nth(4)).innerText()).trim()
        check(SHORT_DATE.test(date), `${label}: short date (${date})`)
        const triggers = row.locator('button[aria-label^="Acciones de la orden"]')
        check(await triggers.count() === 1 && /, (borrador|confirmada|cancelada)$/.test(await triggers.first().getAttribute('aria-label')), `${label}: a single ⋮ named after the order`)
        if (!mobile) check(await row.locator('td').last().locator('button').count() === 1, `${label}: Acciones holds only the ⋮, no loose buttons`)
        if (!mobile) { const box = await row.boundingBox(); check(Boolean(box) && box.height <= 72, `${label}: the desktop row is compact, at most 72px (${Math.round(box?.height ?? 0)}px)`) }
      }
    }
    // The seeds that prove the Total contract: null for incompleteCost and cancelledFromDraft, one or two (mixed bases) otherwise.
    const seedTotals = async (found, tag) => {
      step = `seed totals: ${tag}`
      check(found.incompleteCost.totals === null && found.cancelledFromDraft.totals === null && found.mixedTaxBasis.totals.length === 2 && (found.readyToConfirm.totals?.length ?? 0) >= 1, `server totals: null for incompleteCost and cancelledFromDraft, two for mixedTaxBasis, at least one for a complete draft: ${tag}`)
      for (const key of ['incompleteCost', 'cancelledFromDraft', 'readyToConfirm', 'mixedTaxBasis']) {
        const row = rows().nth(await locateRow(found[key], `${key} ${tag}`))
        await totalCheck(row, found[key], `${key} ${tag}`)
      }
      await applySearch('')
    }
    const DRAFT_MENU = ['Continuar', 'Confirmar…', 'Cancelar…']
    const rowMenus = async (found, tag) => {
      step = `row ⋮ menus: ${tag}`
      const draft = await rowMenu(found.readyToConfirm, `ready draft menu ${tag}`)
      const discard = draft.labels.includes('Descartar borrador')
      report.observed.managerCanDiscard = discard
      check((sameLabels(draft, DRAFT_MENU) || sameLabels(draft, [...DRAFT_MENU, 'Descartar borrador'])) && draft.disabled.length === 0 && draft.dangerCount === (discard ? 1 : 0) && (!discard || (draft.dangerLast && draft.separatorBeforeDanger)), `draft ⋮ menu: Continuar, Confirmar…, Cancelar…, then the separated destructive Descartar borrador: ${tag}`)
      const incomplete = await rowMenu(found.incompleteCost, `incompleteCost menu ${tag}`)
      check(incomplete.labels.includes('Confirmar…') && incomplete.disabled.join('|') === 'Confirmar…', `a draft with avisos has Confirmar… disabled in its ⋮ menu: ${tag}`)
      const confirmed = await rowMenu(found.confirmed, `confirmed menu ${tag}`)
      check(sameLabels(confirmed, ['Ver orden', 'Cancelar…']) && confirmed.dangerCount === 0, `confirmed ⋮ menu: Ver orden, Cancelar…: ${tag}`)
      const cancelled = await rowMenu(found.cancelledFromDraft, `cancelled menu ${tag}`)
      check(sameLabels(cancelled, ['Ver orden']), `cancelled ⋮ menu: Ver orden only: ${tag}`)
      await applySearch('')
    }
    // Confirmar… and Cancelar… from a row open the order first and then the dialog; neither is confirmed here.
    const rowMenuFlows = async (found, tag) => {
      step = `row menu flows: ${tag}`
      let { menu } = await openRowMenu(found.readyToConfirm, `Confirmar… from the row ${tag}`)
      await menu.getByRole('menuitem', { name: 'Confirmar…', exact: true }).click()
      await slide().waitFor({ state: 'visible' }); await modal().waitFor({ state: 'visible' })
      check((await modal().innerText()).includes('Confirmar orden') && await modal().getByTestId('confirm-transition').count() === 1, `row Confirmar… opens the order and then the confirmation dialog: ${tag}`)
      await page.keyboard.press('Escape'); await modal().waitFor({ state: 'hidden' })
      check(await slide().isVisible() && await page.evaluate(() => document.querySelector('.order-shell')?.contains(document.activeElement) ?? false), `Escape closes only the dialog and focus stays inside the open order: ${tag}`)
      await closeEditor()
      ;({ menu } = await openRowMenu(found.confirmed, `Cancelar… from the row ${tag}`))
      await menu.getByRole('menuitem', { name: 'Cancelar…', exact: true }).click()
      await slide().waitFor({ state: 'visible' }); await modal().waitFor({ state: 'visible' })
      check(/definitiva/.test(await modal().innerText()), `row Cancelar… opens the order and then the cancellation dialog: ${tag}`)
      await modal().getByTestId('cancel-transition').click(); await modal().waitFor({ state: 'hidden' })
      await closeEditor()
      await applySearch('')
    }

    // ---- open order design (artboards 04 and 05) ----
    const stepStates = () => slide().locator('ol[aria-label="Pasos para confirmar"] li').evaluateAll(items => items.map(li => `${li.dataset.step}:${li.dataset.state}`))
    const checklistText = async () => (await slide().locator('ul[aria-label="Pendientes para confirmar"]').innerText()).trim()
    const headerChecks = async (tag, order, status, { primary }) => {
      const header = slide().locator('.order-header')
      const word = { DRAFT: 'guardada', CONFIRMED: 'confirmada', CANCELLED: 'cancelada' }[status]
      const meta = (await header.locator('.order-header-meta').innerText()).replace(/\s+/g, ' ').trim()
      const badge = header.getByTestId('order-status')
      check((await header.locator('.order-header-title').innerText()).trim() === (order.supplierName ?? 'Sin proveedor'), `the header title is the supplier name: ${tag}`)
      check((await badge.innerText()).trim() === LABEL[status] && await badge.getAttribute('data-tone') === TONE[status] && meta.includes(order.tenantName) && SHORT_DATE.test(meta.split(`${word} `)[1] ?? ''), `header meta line: ${LABEL[status]} badge, location and "${word}" with a short date: ${tag}`)
      const date = header.locator('.order-header-when')
      const lineTops = await date.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return [...new Set([...range.getClientRects()].map(rect => Math.round(rect.top)))].length })
      check(await date.count() === 1 && lineTops === 1 && await date.evaluate(el => getComputedStyle(el).whiteSpace === 'nowrap'), `the header date stays on one line, never broken inside: ${tag}`)
      const solid = primary && vw >= 768 ? 1 : 0
      check(await header.locator('.hf-primary-control').count() === solid, `the header holds ${solid ? 'exactly one solid primary' : 'no solid primary'}: ${tag}`)
    }
    const textDiet = async tag => {
      const text = await slide().innerText()
      for (const copy of HELP_COPY) check(!text.includes(copy), `no permanent help copy "${copy.slice(0, 34)}": ${tag}`)
      check(await slide().locator('.order-counter, [data-testid="order-transition-bar"]').count() === 0, `no character counter or transition bar by default: ${tag}`)
    }
    const footerChecks = async (tag, state) => {
      if (vw >= 768) {
        const footer = slide().locator('.order-footer')
        const text = (await footer.locator('.order-save-state').innerText()).replace(/\s+/g, ' ').trim()
        check(state === 'dirty' ? text === 'Cambios sin guardar' : text.startsWith('Guardado · ') && SHORT_DATE.test(text.replace('Guardado · ', '')), `footer save state reads "${text}": ${tag}`)
        check(await footer.getByRole('button', { name: 'Guardar borrador', exact: true }).count() === 1, `Guardar borrador sits in the footer: ${tag}`)
      } else {
        const names = (await slide().locator('.order-action-bar').getByRole('button').allInnerTexts()).map(text => text.trim())
        check(JSON.stringify(names) === JSON.stringify(['Guardar', 'Confirmar orden']), `sticky bar at ${vw} holds Guardar and Confirmar orden: ${tag}`)
        check(await slide().getByTestId('confirm-order').count() === 1, `a single Confirmar orden on mobile, in the bar: ${tag}`)
        const bar = await slide().locator('.order-action-bar > *').evaluateAll(nodes => nodes.map(node => {
          const box = node.getBoundingClientRect(), range = document.createRange()
          range.selectNodeContents(node)
          const text = range.getBoundingClientRect()
          return { width: box.width, offset: (text.left + text.width / 2) - (box.left + box.width / 2) }
        }))
        check(bar.length === 2 && Math.abs(bar[0].width - bar[1].width) <= 1, `the sticky bar buttons have equal widths (${bar.map(b => Math.round(b.width)).join(' / ')}): ${tag}`)
        check(bar.every(b => Math.abs(b.offset) <= 3), `the sticky bar labels are centered (offsets ${bar.map(b => b.offset.toFixed(1)).join(' / ')}): ${tag}`)
      }
    }
    // Line design (artboard 05, P2/P3/P7): "Falta" once per cell, a readable name on the mobile card, 2-decimal money.
    const lineDesign = async tag => {
      const rowsLocator = slide().locator('.order-line-row')
      const count = await rowsLocator.count()
      for (let i = 0; i < count; i++) {
        const row = rowsLocator.nth(i), label = `${tag} line ${i + 1}`
        const cells = (await row.locator(':scope > div').allInnerTexts()).map(text => text.replace(/\s+/g, ' ').trim())
        check(cells.every(text => (text.match(/Falta/g) ?? []).length <= 1), `${label}: no repeated "Falta" in a cell (${cells.filter(text => /Falta/.test(text)).join(' | ') || 'none'})`)
        for (const money of await row.locator('[data-testid="line-cost"], [data-testid="line-subtotal"]').all()) {
          const text = (await money.innerText()).replace(/\s+/g, " ").trim()
          check(text === '—' || /^Falta( el costo)?$/.test(text) || MONEY.test(text), `${label}: money reads 2 decimals, a dash or Falta ("${text}")`)
        }
        if (vw >= 640) continue
        const name = row.locator('.order-line-toggle, .order-line-name').first()
        const text = (await name.innerText()).trim()
        const geometry = await name.evaluate(el => {
          const box = el.getBoundingClientRect(), range = document.createRange(), node = el.firstChild
          range.setStart(node, 0); range.setEnd(node, Math.min(12, node.textContent.length))
          const head = range.getBoundingClientRect(), style = getComputedStyle(el)
          return { fits: head.right <= box.right + 1 && head.bottom <= box.bottom + 1, width: box.width, lines: Math.round(box.height / (parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4)), horizontalClip: el.scrollWidth > el.clientWidth + 1 }
        })
        check(geometry.fits && !geometry.horizontalClip && geometry.width >= 12 * 6 && geometry.lines <= 2, `${label}: the card name "${text.slice(0, 24)}" is not truncated below 12 characters (${Math.round(geometry.width)}px wide, ${geometry.lines} line(s))`)
        const [nameBox, menuBox, qtyBox, totalBox] = await Promise.all([name.boundingBox(), row.locator('.order-line-menu').boundingBox(), row.locator('.order-line-qty').boundingBox(), row.locator('.order-line-total').boundingBox()])
        if (menuBox && qtyBox && totalBox && nameBox) check(menuBox.y <= nameBox.y + 12 && qtyBox.y >= nameBox.y + nameBox.height - 2 && Math.abs((totalBox.y + totalBox.height / 2) - (qtyBox.y + qtyBox.height / 2)) <= 14 && totalBox.x > qtyBox.x, `${label}: the ⋮ sits at the top-right and the quantity, cost and subtotal share row 2`)
      }
    }
    const linesChecks = async (tag, order, { editable }) => {
      await lineDesign(tag)
      const lines = slide().locator('.order-line-row')
      check(await lines.count() === order.lines.length && await lines.locator('[data-testid="line-subtotal"]').count() === order.lines.length, `lines are compact rows with a subtotal each (${order.lines.length}): ${tag}`)
      const grid = await lines.first().evaluate(el => { const style = getComputedStyle(el); return { display: style.display, tracks: style.gridTemplateColumns.split(' ').length } })
      check(grid.display === 'grid' && grid.tracks === (vw < 640 ? 3 : editable ? 5 : 4), `a line is a ${vw < 640 ? 'two-row, three-track card' : 'table row'} at ${vw} (${grid.tracks} tracks): ${tag}`)
      if (!editable) { check(await lines.locator('button').count() === 0, `read-only lines have no edit affordance: ${tag}`); return }
      const first = lines.first()
      await first.getByRole('button', { name: 'Más acciones del renglón 1', exact: true }).click()
      const menu = page.getByRole('menu')
      await menu.waitFor({ state: 'visible' })
      const info = await menuInfo(menu)
      await closeMenu(menu)
      check(sameLabels(info, ['Editar renglón', 'Cambiar producto', 'Quitar renglón']) && info.dangerLast && info.separatorBeforeDanger, `line ⋮ menu: Editar, Cambiar producto, then the separated destructive Quitar: ${tag}`)
      const toggle = first.locator('button.order-line-toggle')
      check(await toggle.getAttribute('aria-expanded') === 'false' && await slide().locator('.order-line-edit').count() === 0, `lines start collapsed: ${tag}`)
      await first.locator('.order-line-qty').click()
      await slide().locator('.order-line-edit').first().waitFor({ state: 'visible' })
      check(await toggle.getAttribute('aria-expanded') === 'true' && await slide().locator('.order-line-edit [data-testid="line-quantity"]').count() === 1 && await slide().locator('.order-line-edit [data-testid="line-amount"]').count() === 1 && await slide().locator('.order-line-edit [data-testid="line-tax"]').count() === 1, `a row click expands the inline edit row (cantidad, costo, impuestos): ${tag}`)
      await slide().locator('button.order-line-done').first().click()
      await until(async () => await slide().locator('.order-line-edit').count() === 0, `Listo collapses the edit row: ${tag}`)
      await until(() => page.evaluate(() => document.activeElement?.classList.contains('order-line-toggle') ?? false), `Listo returns focus to the line: ${tag}`)
    }
    const twoColumns = async tag => {
      if (vw >= 768) {
        const [a, b] = [await slide().locator('.order-grid > *').nth(0).boundingBox(), await slide().locator('.order-grid > *').nth(1).boundingBox()]
        const note = await slide().locator('textarea').boundingBox()
        check(Boolean(a) && Boolean(b) && Math.abs(a.y - b.y) <= 6 && a.x < b.x && note.y >= Math.max(a.y + a.height, b.y + b.height) - 1, `supplier and location detail sit in two columns, the note below: ${tag}`)
      } else {
        const more = slide().locator('details.order-more')
        check(await more.count() === 1 && await more.getAttribute('open') === null && (await more.locator('summary').innerText()).includes('Nota y ubicación'), `mobile folds Nota y ubicación into one closed row: ${tag}`)
      }
    }
    const readyDraftChecks = async (tag, order) => {
      await headerChecks(tag, order, 'DRAFT', { primary: true })
      check(JSON.stringify(await stepStates()) === JSON.stringify(['complete:done', 'save:done', 'confirm:current']), `step strip: Completar and Guardar done, Confirmar current: ${tag}`)
      check(await checklistText() === 'Lista para confirmar', `the checklist says Lista para confirmar: ${tag}`)
      const menu = await headerMenu()
      check((sameLabels(menu, ['Cancelar orden…']) || (sameLabels(menu, ['Cancelar orden…', 'Descartar borrador']) && menu.dangerLast && menu.separatorBeforeDanger)) && menu.disabled.length === 0, `header ⋮ menu: Cancelar orden…, then the separated Descartar borrador: ${tag}`)
      await textDiet(tag); await twoColumns(tag); await linesChecks(tag, order, { editable: true }); await footerChecks(tag, 'saved')
    }
    const incompleteDraftChecks = async (tag, order) => {
      await headerChecks(tag, order, 'DRAFT', { primary: true })
      check((await stepStates())[0] === 'complete:current', `step strip: Completar is current while avisos remain: ${tag}`)
      check(/pendiente|\(\d+\)/.test(await slide().locator('li[data-step="complete"] .order-step-count').innerText()), `the pending count rides on Completar: ${tag}`)
      check(await confirmState() === 'blocked' && await slide().getByTestId('confirm-order').getAttribute('aria-describedby') === 'order-checklist', `Confirmar orden is aria-disabled and points at the checklist: ${tag}`)
      const items = (await slide().locator('ul[aria-label="Pendientes para confirmar"] li[data-state="pending"] .order-check-message').allInnerTexts()).map(text => text.replace(/\s+en \d+ renglones?$/, '').trim())
      check(items.length > 0 && new Set(items).size === items.length && await slide().locator('.order-line-edit .order-warning').count() === 0, `the checklist lists each pending item once and no field repeats it as a message: ${tag}`)
      // P1: grouped by line and family. A cost sub-field (amount, currency, unit, taxes) is one "Falta el costo", never several items.
      const FAMILY = { COST_AMOUNT_REQUIRED: 'cost', COST_CURRENCY_REQUIRED: 'cost', COST_UNIT_REQUIRED: 'cost', COST_TAX_BASIS_REQUIRED: 'cost', QUANTITY_REQUIRED: 'quantity', QUANTITY_FRACTION_NOT_ALLOWED: 'quantity', PRODUCT_REQUIRED: 'reference', VARIANT_REQUIRED: 'reference', REFERENCE_UNAVAILABLE: 'reference', REFERENCE_INCOMPATIBLE: 'reference', UNIT_MISMATCH: 'unit' }
      const expected = new Set(order.issueCodes.map(code => FAMILY[code] ?? code)).size
      const pending = slide().locator('ul[aria-label="Pendientes para confirmar"] li[data-state="pending"]')
      check(await pending.count() === expected, `the checklist has one item per issue family (${expected} for ${order.issueCodes.length} diagnostics): ${tag}`)
      check((await pending.evaluateAll(nodes => nodes.map(node => node.querySelectorAll('button.order-check-link').length))).every(links => links <= 1), `each checklist item has a single link at most: ${tag}`)
      if (order.issueCodes.every(code => code.startsWith('COST_'))) check(items.length === 1 && items[0] === 'Falta el costo', `all the cost sub-fields collapse into one "Falta el costo" (${items.join(' | ')}): ${tag}`)
      await lineDesign(tag)
      const link = slide().locator('button.order-check-link').first()
      check(await link.count() === 1 && (vw < 768 ? (await link.innerText()).trim() === 'Ver renglón' : (await link.innerText()).trim().startsWith('Ir a ')), `the checklist links to the flagged line (${vw < 768 ? 'Ver renglón' : 'Ir a {producto}'}): ${tag}`)
      await link.click()
      await until(() => page.evaluate(() => { const el = document.activeElement; return el?.getAttribute('aria-invalid') === 'true' && Boolean(el.closest('.order-line-edit')) }), `the checklist link opens the flagged line and focuses its missing field: ${tag}`)
      const flagged = slide().locator('.order-line-row[data-flagged="true"]'), plain = slide().locator('.order-line-row:not([data-flagged="true"])')
      check(await flagged.count() >= 1, `a line with avisos is flagged: ${tag}`)
      if (await plain.count()) check(await flagged.first().evaluate(el => getComputedStyle(el).backgroundColor) !== await plain.first().evaluate(el => getComputedStyle(el).backgroundColor), `the flagged line has the warning tint: ${tag}`)
      if (order.issueCodes.some(code => ['COST_AMOUNT_REQUIRED', 'QUANTITY_REQUIRED'].includes(code))) check((await flagged.first().locator('.order-missing').allInnerTexts()).some(text => text.includes('Falta')), `the flagged line shows a Falta marker: ${tag}`)
      await textDiet(tag); await footerChecks(tag, 'saved')
    }
    const closedOrderChecks = async (tag, order, status) => {
      await headerChecks(tag, order, status, { primary: false })
      check(await slide().locator('ol[aria-label="Pasos para confirmar"]').count() === 0 && await slide().locator('[data-testid="order-footer"]').count() === 0, `a closed order has no step strip and no footer: ${tag}`)
      const menu = await headerMenu()
      check(status === 'CANCELLED' ? menu.labels.length === 0 : sameLabels(menu, ['Cancelar orden…']), `closed order header ⋮ menu: ${status === 'CANCELLED' ? 'absent' : 'Cancelar orden…'}: ${tag}`)
      await textDiet(tag); await linesChecks(tag, order, { editable: false })
    }

    // ---- fixtures: read-only classification of the showcase orders by readable attributes ----
    const brief = (d, totals = null) => ({
      totals,
      id: d.id, status: d.status, version: d.version, createdAt: d.createdAt, note: d.note ?? null,
      tenantName: d.locationSnapshot?.tenantName ?? null, lineNames: d.lines.map(line => d.lineDisplaySnapshots?.find(item => item.lineId === line.lineId)?.productName ?? 'Sin producto'),
      supplierId: d.supplierId ?? null, supplierName: d.supplierDisplaySnapshot?.displayName ?? null, supplierStatus: d.supplierDisplaySnapshot?.status ?? null,
      location: d.location, lines: d.lines, subtotals: d.lineSubtotals, canConfirm: d.canConfirm === true,
      issueCodes: (d.validation?.issues ?? []).map(i => i.code), supplierCurrentVersion: d.supplierCurrentVersion ?? null, referenceToken: d.referenceToken ?? null,
      confirmedAt: d.confirmedAt ?? null, cancelledAt: d.cancelledAt ?? null, confirmedBy: d.confirmedBy?.displayName ?? null, cancelledBy: d.cancelledBy?.displayName ?? null,
    })
    const resolveShowcase = async need => {
      step = 'classify the showcase orders (read-only)'
      const items = []
      for (const status of ['DRAFT', 'CONFIRMED', 'CANCELLED']) {
        let cursor = null
        for (let n = 0; n < 5; n++) {
          const res = await call('GET', `${ORDERS}?status=${status}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
          check(res.status === 200, `showcase list ${status} reads`)
          items.push(...res.value.items)
          cursor = res.value.nextCursor
          if (!cursor) break
        }
      }
      check(items.length > 0 && items.length <= 80, 'disposable tenant has a small, non-empty order set')
      const all = []
      for (const item of items) {
        const res = await call('GET', `${ORDERS}/${item.id}`)
        check(res.status === 200, 'showcase detail reads')
        all.push(brief(res.value, item.totals ?? null))
      }
      // Probe orders created by earlier runs of this harness are never showcase candidates.
      const seeds = all.filter(d => !(d.note ?? '').startsWith('Pedido de prueba de permisos')).sort((a, b) => a.createdAt < b.createdAt ? -1 : 1)
      const drafts = seeds.filter(d => d.status === 'DRAFT'), confirmed = seeds.filter(d => d.status === 'CONFIRMED'), cancelled = seeds.filter(d => d.status === 'CANCELLED')
      // Mixed-basis drafts are kept for the totals checks, never consumed by a confirm or cancel.
      const ready = drafts.filter(d => d.canConfirm && d.supplierStatus === 'ACTIVE' && (d.totals?.length ?? 0) !== 2)
      const found = {
        readyToConfirm: ready[0], readyToConfirmSpare: ready[1],
        incompleteCost: drafts.find(d => !d.canConfirm && d.supplierStatus === 'ACTIVE' && d.issueCodes.some(code => code.startsWith('COST_'))),
        archivedSupplierDraft: drafts.find(d => d.supplierStatus === 'ARCHIVED'),
        // Mixed tax bases: two server totals, shown stacked and never summed (L8).
        mixedTaxBasis: drafts.find(d => d.totals?.length === 2), confirmedMixedTaxBasis: confirmed.find(d => d.totals?.length === 2),
        confirmed: confirmed.find(d => d.confirmedBy), confirmedSpare: confirmed.at(-1),
        cancelledFromDraft: cancelled.find(d => !d.confirmedAt && d.lines.length > 0),
        // The seeded one (confirmed by Sofía, cancelled by Jorge); later runs leave other confirmed-then-cancelled orders behind.
        cancelledFromConfirmed: cancelled.find(d => d.confirmedAt && d.cancelledAt && [d.confirmedBy, d.cancelledBy].join('|') === [NAMES.confirmer, NAMES.canceller].join('|'))
          ?? cancelled.find(d => d.confirmedAt && d.cancelledAt && d.confirmedBy && d.cancelledBy),
        templates: [], confirmedPool: confirmed,
      }
      // Templates for cloned probe orders: complete orders with an active supplier.
      found.templates = [...ready, ...confirmed, ...cancelled.filter(d => d.confirmedAt)].filter(d => d.supplierId && d.supplierStatus === 'ACTIVE' && d.lines.length > 0)
      report.showcase = Object.fromEntries(need.map(key => [key, key === 'templates' ? found.templates.length > 0 : Boolean(found[key])]))
      report.showcase.readyDrafts = ready.length; report.showcase.confirmedOrders = confirmed.length
      // Seeds are recorded by readable name (never ids) so a report says which fixtures it ran on.
      report.showcaseOrders = Object.fromEntries(need.filter(key => key !== 'templates' && found[key]).map(key => [key, `${found[key].supplierName ?? 'Sin proveedor'} · ${(found[key].note ?? '').split('\n')[0].slice(0, 60)}`]))
      finding(ready.length >= 3, 'runtime seeds at least three ready drafts (readyToConfirm, 2 and 3)')
      finding(confirmed.length >= 3, 'runtime seeds at least three confirmed orders (confirmed, 2 and 3)')
      finding(Boolean(found.confirmedMixedTaxBasis), 'runtime seeds the confirmedMixedTaxBasis order (two frozen totals)')
      report.missingShowcase = need.filter(key => !report.showcase[key])
      check(report.missingShowcase.length === 0, `showcase orders are present: ${need.join(', ')}`)
      return found
    }
    // A probe is a fresh draft cloned (through the manager session) from a complete order; seeds are never touched.
    const makeProbe = async (templates, label) => {
      for (const template of templates.slice(0, 3)) {
        const lines = []
        for (const line of template.lines) lines.push({ lineId: await uuid(), productId: line.productId, variantId: line.variantId, orderedQuantity: line.orderedQuantity, informedUnitCost: line.informedUnitCost && { amount: line.informedUnitCost.amount, currency: line.informedUnitCost.currency, unit: line.informedUnitCost.unit, taxBasis: line.informedUnitCost.taxBasis } })
        const res = await call('POST', ORDERS, { supplierId: template.supplierId, note: `Pedido de prueba de permisos para ${label} · ${new Date().toLocaleString('es-MX')}`, location: { detail: template.location?.detail ?? null }, lines })
        if (res.status === 201 && res.value.canConfirm === true) return brief(res.value)
      }
      return check(false, `a ready probe draft (${label}) could be cloned from a complete order`)
    }

    // =========================== stages ===========================
    check(await login('manager') === ORDERS, 'manager route admitted')
    await page.getByRole('heading', { name: 'Órdenes de compra', exact: true }).waitFor()
    await page.getByTestId('create-order').waitFor()
    await until(async () => (await rows().count()) > 0, 'list renders rows')
    check(report.outsideScope.length === 0, 'no out-of-scope shell dependencies before mutations')

    if (stage === 'manager') {
      const found = await resolveShowcase(['readyToConfirm', 'readyToConfirmSpare', 'incompleteCost', 'archivedSupplierDraft', 'mixedTaxBasis', 'confirmed', 'cancelledFromDraft', 'cancelledFromConfirmed'])
      const firstList = log.find(r => r.method === 'GET' && r.path === ORDERS)
      check(firstList?.statusParam === null && await statusValue() === 'ALL', 'Estado filter defaults to Todas and the first list request carries no status')

      const filterChecks = async tag => {
        step = `status filter checks: ${tag}`
        await setStatus('ALL'); await applySearch('')
        await filterDesign(tag)
        const all = await badges(`Todas ${tag}`)
        finding(new Set(all).size === 3, `Todas first page shows Borrador, Confirmada and Cancelada rows: ${tag}`)
        for (const status of ['DRAFT', 'CONFIRMED', 'CANCELLED']) {
          const res = await setStatus(status)
          const body = await res.json()
          check(new URL(res.url()).searchParams.get('status') === status, `filtering to ${LABEL[status]} sends status=${status}: ${tag}`)
          const labels = await badges(`${LABEL[status]} ${tag}`, body.items.length)
          check(body.items.length > 0 && body.items.every(item => item.status === status) && labels.every(t => t === LABEL[status]), `rows match the ${LABEL[status]} filter: ${tag}`)
        }
        const res = await setStatus('ALL')
        check(!new URL(res.url()).searchParams.has('status'), `going back to Todas drops the status param: ${tag}`)
        await badges(`Todas again ${tag}`)
      }

      const readOnlyTour = async tag => {
        step = `read-only tour: ${tag}`
        await setStatus('ALL'); await applySearch('')
        await badges(`list ${tag}`)
        await listDesign(tag)
        await seedTotals(found, tag)
        await rowMenus(found, tag)
        await rowMenuFlows(found, tag)
        await setStatus('ALL'); await applySearch('')
        await snap(`list-${tag}`)

        // The whole row opens the order; the primary button is the keyboard path to the same target.
        if (tag === '1440-light') {
          await openOrder(found.confirmed, 'primary button', 'button')
          await closeEditor({ restoresFocus: true })
        }
        await openOrder(found.readyToConfirm, `ready draft ${tag}`)
        check(await slide().locator('form.order-form').count() === 1 && await confirmState() === 'ready' && await cancelAvailable(), `ready draft: Confirmar orden ready and Cancelar orden… available: ${tag}`)
        await readyDraftChecks(tag, found.readyToConfirm)
        const saved = (await slide().locator('[data-testid="line-subtotal"]').allInnerTexts()).map(t => t.trim())
        finding(saved.length > 0 && saved.every(text => MONEY.test(text)), `saved line subtotals in the editor are currency formatted: ${tag}`)
        await snap(`draft-ready-${tag}`)
        await openTransition('confirm'); await modalCopy('confirm', tag, found.readyToConfirm); await snap(`confirm-dialog-${tag}`)
        await page.keyboard.press('Escape'); await modal().waitFor({ state: 'hidden' })
        await openTransition('cancel'); await modalCopy('cancel', tag, found.readyToConfirm); await snap(`cancel-dialog-${tag}`)
        await modal().getByTestId('cancel-transition').click(); await modal().waitFor({ state: 'hidden' })
        await escapeReturnsFocus('confirm', tag)
        await escapeReturnsFocus('cancel', tag)
        // An unsaved edit makes Guardar the current step, blocks both transitions and asks to save from the checklist and the footer.
        if (vw < 768) await slide().locator('details.order-more > summary').click()
        const original = await slide().locator('textarea').inputValue()
        await slide().locator('textarea').fill(`${original} edición local`)
        await until(async () => await confirmState() === 'blocked' && !(await cancelAvailable()), `unsaved edit blocks Confirmar orden and Cancelar orden…: ${tag}`)
        check((await headerMenu()).disabled.includes('Cancelar orden…'), `unsaved edit leaves Cancelar orden… visible but disabled: ${tag}`)
        check((await stepStates()).join() === 'complete:done,save:current,confirm:upcoming', `unsaved edit makes Guardar the current step: ${tag}`)
        check((await checklistText()).includes('Guarda el borrador para validar los cambios'), `unsaved edit shows "Guarda el borrador para validar los cambios" in the checklist: ${tag}`)
        await footerChecks(tag, 'dirty')
        await disabledPrimaryLegible(`unsaved edit ${tag}`)
        await snap(`draft-unsaved-${tag}`)
        const dialogsBefore = report.nativeDialogs.length
        await closeEditor()
        check(report.nativeDialogs.length === dialogsBefore + 1, `closing an unsaved editor asks once before discarding: ${tag}`)

        await openOrder(found.incompleteCost, `incompleteCost ${tag}`)
        await incompleteDraftChecks(tag, found.incompleteCost)
        await disabledPrimaryLegible(`incompleteCost ${tag}`)
        await snap(`draft-incomplete-${tag}`); await closeEditor({ restoresFocus: true })

        await openOrder(found.archivedSupplierDraft, `archivedSupplierDraft ${tag}`)
        check(await confirmState() === 'blocked', `archivedSupplierDraft: Confirmar orden blocked: ${tag}`)
        await snap(`draft-archived-supplier-${tag}`); await closeEditor()

        await openOrder(found.confirmed, `confirmed ${tag}`)
        await expectClosed('CONFIRMED', found.confirmed.confirmedBy, `confirmed ${tag}`)
        await closedOrderChecks(tag, found.confirmed, 'CONFIRMED')
        await subtotalsMatch(found.confirmed, `confirmed ${tag}`)
        check(!(await present('confirm-order')) && await cancelAvailable(), `confirmed: no Confirmar, Cancelar orden… available: ${tag}`)
        await snap(`confirmed-${tag}`); await closeEditor()

        const both = found.cancelledFromConfirmed
        check(both.confirmedBy === NAMES.confirmer && both.cancelledBy === NAMES.canceller, `cancelledFromConfirmed actors are ${NAMES.confirmer} and ${NAMES.canceller}: ${tag}`)
        await openOrder(both, `cancelledFromConfirmed ${tag}`)
        await expectClosed('CANCELLED', NAMES.canceller, `cancelledFromConfirmed ${tag}`)
        await closedOrderChecks(tag, both, 'CANCELLED')
        const closure = await slide().getByTestId('order-readonly').innerText()
        // A cancelled order that was confirmed first keeps both closure records (bb1ba884).
        check(closure.includes(`Confirmada por ${NAMES.confirmer}`) && closure.includes(`Cancelada por ${NAMES.canceller}`), `cancelledFromConfirmed shows both Confirmada por ${NAMES.confirmer} and Cancelada por ${NAMES.canceller}: ${tag}`)
        await noTransitionUi(`cancelled ${tag}`)
        await snap(`cancelled-from-confirmed-${tag}`); await closeEditor()

        await openOrder(found.cancelledFromDraft, `cancelledFromDraft ${tag}`)
        await expectClosed('CANCELLED', found.cancelledFromDraft.cancelledBy, `cancelledFromDraft ${tag}`)
        await subtotalsMatch(found.cancelledFromDraft, `cancelledFromDraft ${tag}`)
        check((await slide().locator('[data-testid="line-subtotal"]').allInnerTexts()).every(t => t.trim() === '—'), `never-confirmed cancelled order shows the subtotal dash: ${tag}`)
        await snap(`cancelled-from-draft-${tag}`); await closeEditor()
      }

      // `part` splits the manager stage under the MCP request limit: 'tour:<width>-<theme>' runs one read-only tour, 'mutations' only the confirm and cancel.
      report.part = part
      for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
        if (part && part !== `tour:${width}-${theme}`) continue
        await setView(width, theme)
        if (theme === 'light') await filterChecks(String(width))
        await readOnlyTour(`${width}-${theme}`)
      }

      // Mutations: the confirm is exercised at 1440/light, the cancel at 390/dark (both on the designated spares).
      if (!part || part === 'mutations') {
      step = 'confirm readyToConfirm through the dialog'
      await setView(1440, 'light')
      await openOrder(found.readyToConfirm, 'confirm flow')
      await transition('confirm', 'readyToConfirm')
      await expectClosed('CONFIRMED', NAMES.manager, 'readyToConfirm after confirm')
      await page.getByText('Orden confirmada correctamente.', { exact: true }).waitFor()
      await snap('result-confirmed-1440-light')
      const confirmedRead = await call('GET', `${ORDERS}/${found.readyToConfirm.id}`)
      check(confirmedRead.status === 200 && confirmedRead.value.status === 'CONFIRMED' && confirmedRead.value.confirmedBy?.displayName === NAMES.manager, 'API agrees: CONFIRMED by the manager')
      await closeEditor()
      check(await rowStatus(found.readyToConfirm, 'confirmed row', LABEL.CONFIRMED) === LABEL.CONFIRMED, 'list row now shows Confirmada')

      step = 'cancel readyToConfirmSpare through the dialog'
      await setView(390, 'dark')
      await openOrder(found.readyToConfirmSpare, 'cancel flow')
      await transition('cancel', 'readyToConfirmSpare')
      await expectClosed('CANCELLED', NAMES.manager, 'readyToConfirmSpare after cancel')
      await page.getByText('Orden cancelada correctamente.', { exact: true }).waitFor()
      await noTransitionUi('cancelled order after the transition')
      await snap('result-cancelled-390-dark')
      const cancelledRead = await call('GET', `${ORDERS}/${found.readyToConfirmSpare.id}`)
      check(cancelledRead.status === 200 && cancelledRead.value.status === 'CANCELLED' && cancelledRead.value.confirmedAt === null, 'API agrees: CANCELLED, never confirmed')
      await closeEditor()
      check(await rowStatus(found.readyToConfirmSpare, 'cancelled row', LABEL.CANCELLED) === LABEL.CANCELLED, 'list row now shows Cancelada')
      }
    } else if (stage === 'transitions') {
      const found = await resolveShowcase(['confirmedSpare'])
      const pool = found.confirmedPool
      report.observed.confirmedAvailable = pool.length
      // One stale scenario per viewport, each on its own CONFIRMED order (the last created first).
      for (const [index, [width, theme]] of [[1440, 'light'], [390, 'dark']].entries()) {
        const target = pool[pool.length - 1 - index]
        const tag = `${width}-${theme}`
        if (!target) { report.observed[`skipped-${tag}`] = 'not enough CONFIRMED orders'; continue }
        step = `stale cancel: ${tag}`
        await setView(width, theme)
        await openOrder(target, `confirmed order ${tag}`)
        check(await cancelAvailable(), `Cancelar orden… is available before the order goes stale: ${tag}`)
        await snap(`stale-before-${tag}`)
        const fresh = await call('GET', `${ORDERS}/${target.id}`)
        check(fresh.status === 200 && fresh.value.status === 'CONFIRMED' && fresh.value.version === target.version, `order still CONFIRMED at the version the UI holds: ${tag}`)
        const competing = await call('POST', `${ORDERS}/${target.id}/cancel`, { expectedVersion: fresh.value.version })
        check(competing.status === 200 && competing.value.status === 'CANCELLED', `harness cancels the order with the same session: ${tag}`)
        await openTransition('cancel')
        const rejection = waitRes(r => r.request().method() === 'POST' && r.url().startsWith(API + ORDERS + '/') && r.url().endsWith('/cancel') && r.status() === 409)
        await modal().getByTestId('confirm-transition').click()
        const rejected = await rejection
        const code = safeCode((await rejected.json()).error)
        report.observed[`staleErrorCode-${tag}`] = code
        check(Object.keys(STALE_COPY).includes(code), `stale cancel is rejected with ORDER_STATE_CONFLICT or ORDER_VERSION_CONFLICT: ${tag}`)
        // The backend checks the version before the state, so a competing cancel normally yields ORDER_VERSION_CONFLICT; both are accepted and the observed code is reported.
        await modal().waitFor({ state: 'hidden' })
        report.checks.push(`confirmation dialog closes on the rejection: ${tag}`)
        const signature = r => `${r.method} ${r.path} ${r.status}`
        await until(() => log.map(signature).lastIndexOf(`POST ${ORDERS}/:id/cancel 409`) >= 0, `rejection recorded in the request log: ${tag}`)
        const at = log.map(signature).lastIndexOf(`POST ${ORDERS}/:id/cancel 409`)
        await until(() => log.slice(at + 1).some(r => r.method === 'GET' && r.path === `${ORDERS}/:id` && r.status === 200), `order is re-read after the rejection: ${tag}`)
        await until(() => log.slice(at + 1).some(r => r.method === 'GET' && r.path === ORDERS && r.status === 200), `list is refreshed after the rejection: ${tag}`)
        report.observed[`requestsAfterRejection-${tag}`] = log.slice(at + 1).map(signature).slice(0, 8)
        await expectClosed('CANCELLED', NAMES.manager, `re-read after stale cancel ${tag}`)
        await slide().getByRole('alert').filter({ hasText: STALE_COPY[code] }).first().waitFor()
        report.checks.push(`rejection message stays visible after the re-read: ${tag}`)
        await noTransitionUi(`re-read order after the stale cancel ${tag}`)
        await snap(`stale-after-${tag}`)
        await closeEditor()
        check(await rowStatus(target, `stale order ${tag}`, LABEL.CANCELLED) === LABEL.CANCELLED, `list row shows Cancelada: ${tag}`)
      }
      check(report.checks.some(name => name.startsWith('rejection message stays visible')), 'at least one stale scenario ran to completion')
    } else {
      // permissions
      const found = await resolveShowcase(['incompleteCost', 'confirmed', 'cancelledFromConfirmed', 'templates'])
      step = 'clone two probe drafts through the manager session'
      const confirmProbe = await makeProbe(found.templates, 'confirmar'), cancelProbe = await makeProbe(found.templates, 'cancelar')
      const forbidden = async (role, probe, kinds) => {
        for (const kind of kinds) {
          const body = kind === 'confirm' ? { expectedVersion: probe.version, expectedSupplierVersion: probe.supplierCurrentVersion, expectedReferenceToken: probe.referenceToken } : { expectedVersion: probe.version }
          const res = await call('POST', `${ORDERS}/${probe.id}/${kind}`, body)
          check(res.status === 403, `${role}: direct ${kind} is 403`)
        }
      }
      // What each role's row ⋮ menu offers (the Acciones column never holds loose buttons). The reader sees no mutation chrome at all.
      const MENUS = {
        editor: { draft: ['Continuar'], absent: ['Confirmar…', 'Cancelar…'], confirmed: ['Ver orden'] },
        confirmer: { draft: ['Ver orden', 'Confirmar…'], absent: ['Continuar', 'Cancelar…'], confirmed: ['Ver orden'] },
        canceller: { draft: ['Ver orden', 'Cancelar…'], absent: ['Continuar', 'Confirmar…'], confirmed: ['Ver orden', 'Cancelar…'] },
        reader: { draft: ['Ver orden'], absent: ['Continuar', 'Confirmar…', 'Cancelar…', 'Descartar borrador'], confirmed: ['Ver orden'] },
      }
      const listChrome = async role => {
        const expected = MENUS[role]
        const draft = await rowMenu(role === 'reader' ? found.incompleteCost : cancelProbe, `${role} ⋮ menu on a draft`)
        const closed = await rowMenu(found.confirmed, `${role} ⋮ menu on a confirmed order`)
        report.observed[`${role}ListChrome`] = { create: await page.getByTestId('create-order').count(), draft: draft.labels, confirmed: closed.labels }
        check(expected.draft.every(label => draft.labels.includes(label)) && expected.absent.every(label => !draft.labels.includes(label)) && (role !== 'reader' || sameLabels(draft, expected.draft)), `${role}: draft ⋮ menu offers ${expected.draft.join(', ')} and none of ${expected.absent.join(', ')}`)
        check(sameLabels(closed, expected.confirmed), `${role}: confirmed order ⋮ menu is ${expected.confirmed.join(', ')}`)
        check(!draft.labels.includes('Descartar borrador') || (draft.dangerLast && draft.separatorBeforeDanger), `${role}: Descartar borrador, when offered, is last, separated and destructive`)
        check(await rows().evaluateAll(trs => trs.every(tr => tr.matches('article') || tr.querySelectorAll('td:last-child button').length === 1)), `${role}: Acciones holds only the ⋮ on every row`)
        if (role === 'reader') check(report.observed.readerListChrome.create === 0, 'reader: no Nueva orden')
        await applySearch('')
      }
      await logout()
      for (const role of ['editor', 'confirmer', 'canceller', 'reader', 'noaccess']) {
        const route = await login(role)
        await setView(1440, 'light')
        if (role === 'noaccess') {
          const viewMessage = await page.getByText('No tienes acceso a las órdenes de compra', { exact: false }).count()
          check(route === '/403' || (route === ORDERS && viewMessage > 0), 'noaccess: forbidden route or the no-access message')
          report.observed.noaccessSurface = route === '/403' ? 'forbidden-route' : 'view-message'
          check(await rows().count() === 0 && await page.getByTestId('create-order').count() === 0, 'noaccess: no order rows or actions')
          check((await call('GET', ORDERS)).status === 403, 'noaccess: direct list is 403')
          await shot('noaccess-1440-light')
          await logout()
          continue
        }
        check(route === ORDERS, `${role}: route admitted`)
        await badges(`${role} list`)
        if (role === 'editor') {
          await listChrome(role)
          await openOrder(cancelProbe, 'editor opens a ready draft')
          check(await slide().locator('form.order-form').count() === 1, 'editor: draft opens in the editor')
          report.observed.editorFormEnabled = await slide().getByRole('button', { name: 'Guardar borrador', exact: true }).isEnabled()
          check(await slide().locator('ol[aria-label="Pasos para confirmar"]').count() === 1 && await slide().locator('.order-header .hf-primary-control').count() === 0, 'editor: step strip but no Confirmar orden primary')
          await noTransitionUi('editor on a draft')
          await snap('editor-draft-1440-light'); await closeEditor()
          await openOrder(found.confirmed, 'editor opens a confirmed order')
          await slide().getByTestId('order-readonly').waitFor()
          await noTransitionUi('editor on a confirmed order')
          await snap('editor-confirmed-1440-light'); await closeEditor()
          await forbidden(role, cancelProbe, ['confirm', 'cancel'])
        } else if (role === 'confirmer') {
          await listChrome(role)
          await openOrder(cancelProbe, 'confirmer opens a draft')
          await readOnlyDraft('confirmer')
          check(await confirmState() === 'ready' && !(await cancelAvailable()), 'confirmer: Confirmar orden available, no Cancelar orden…')
          await snap('confirmer-draft-1440-light'); await closeEditor()
          await forbidden(role, cancelProbe, ['cancel'])
          await openOrder(confirmProbe, 'confirmer confirms a probe draft')
          await readOnlyDraft('confirmer before confirming')
          await transition('confirm', 'confirmer')
          await expectClosed('CONFIRMED', NAMES.confirmer, 'confirmer result')
          await noTransitionUi('confirmer after confirming (no Cancelar)')
          await snap('confirmer-result-1440-light'); await closeEditor()
          check(await rowStatus(confirmProbe, 'confirmer row', LABEL.CONFIRMED) === LABEL.CONFIRMED, 'confirmer: list row shows Confirmada')
        } else if (role === 'canceller') {
          await listChrome(role)
          await openOrder(cancelProbe, 'canceller cancels a probe draft')
          await readOnlyDraft('canceller')
          check(await cancelAvailable() && !(await present('confirm-order')), 'canceller: Cancelar orden… available, no Confirmar orden')
          await snap('canceller-draft-1440-light')
          await transition('cancel', 'canceller')
          await expectClosed('CANCELLED', NAMES.canceller, 'canceller result')
          await snap('canceller-result-1440-light'); await closeEditor()
          check(await rowStatus(cancelProbe, 'canceller row', LABEL.CANCELLED) === LABEL.CANCELLED, 'canceller: list row shows Cancelada')
          await forbidden(role, confirmProbe, ['confirm'])
        } else {
          await listChrome(role)
          await openOrder(found.incompleteCost, 'reader opens a draft')
          await readOnlyDraft('reader'); await noTransitionUi('reader on a draft')
          check(await headerTrigger().count() === 0 && await slide().locator('.hf-primary-control').count() === 0, 'reader: no ⋮ and no primary in the header')
          await moneyCells('reader draft')
          const warned = (await slide().getByTestId('order-readonly-warnings').innerText()).trim()
          check(warned.length > 0 && !/[A-Z]{3,}_[A-Z_]{2,}/.test(await slide().getByTestId('order-readonly').innerText()), 'reader draft shows readable pending items in the checklist and no raw issue codes')
          await snap('reader-draft-1440-light'); await closeEditor()
          await openOrder(found.confirmed, 'reader opens a confirmed order')
          await slide().getByTestId('order-readonly').waitFor(); await noTransitionUi('reader on a confirmed order')
          await snap('reader-confirmed-1440-light'); await closeEditor()
          await openOrder(found.cancelledFromConfirmed, 'reader opens a cancelled order')
          await slide().getByTestId('order-readonly').waitFor(); await noTransitionUi('reader on a cancelled order')
          await snap('reader-cancelled-1440-light'); await closeEditor()
          await forbidden(role, confirmProbe, ['confirm', 'cancel'])
        }
        await logout()
      }
      report.retainedSyntheticOrders = 'two "Pedido de prueba de permisos" orders (one CONFIRMED, one CANCELLED) remain; the harness performs no cleanup'
    }
    await Promise.all(pending)
    check(report.outsideScope.length === 0, 'no outsideScope requests')
    check(report.runtimeErrorCount === 0, 'zero uncaught browser runtime errors')
    report.verdict = report.findings.length ? 'script assertions passed with findings; parent must review findings and screenshots' : 'script assertions passed; parent must visually inspect screenshots'
  } catch (error) {
    report.verdict = 'stopped'
    report.blocker = `Failed step: ${step}. No raw exception retained; inspect sanitized requests and the last passed check.`
    report.failureSummary = String(error?.message ?? error).split('\n')[0].replace(/[^\s@]+@[^\s@]+/g, '[email]').slice(0, 200)
  } finally {
    const counts = new Map()
    for (const r of log) { const key = `${r.method} ${r.path} ${r.status}${r.error ? ` ${r.error}` : ''}${r.statusParam ? ` status=${r.statusParam}` : ''}`; counts.set(key, (counts.get(key) ?? 0) + 1) }
    report.requests = [...counts].map(([request, count]) => ({ request, count }))
    if (context) await context.close().catch(() => {})
  }
  return report
}
