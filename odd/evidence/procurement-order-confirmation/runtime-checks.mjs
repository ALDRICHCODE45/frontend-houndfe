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
const MONEY = /\$[\d,]+\.\d{2}/
const STALE_COPY = {
  ORDER_STATE_CONFLICT: 'La orden ya no está en un estado que permita esta acción. Revisa su estado actual.',
  // After a transition the order is already re-read (bb1ba884), so the copy no longer promises kept local edits.
  ORDER_VERSION_CONFLICT: 'La orden cambió en otra sesión. Ya se cargó su versión actual; revísala antes de continuar.',
}
const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const OPEN_BUTTON = /^(Continuar|Ver orden)$/
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

export async function run(browserPage, stage) {
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
    // Editor design (S8/S9 V2, V3). Measures the open order editor, if any: its width against the readable cap,
    // the transition action bar, and the label-to-value distance of the read-only line figures.
    const EDITOR_CAP_REM = 56
    const editorDesign = async name => {
      const m = await page.evaluate(() => {
        const dialog = [...document.querySelectorAll('[role="dialog"]')].find(d => d.querySelector('form.order-form, [data-testid="order-readonly"]'))
        if (!dialog) return null
        const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
        const content = box(dialog)
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
        const body = dialog.querySelector('[data-slot="body"]')
        const bar = dialog.querySelector('[data-testid="order-transition-bar"]')
        const main = dialog.querySelector('form.order-form, [data-testid="order-readonly"]')
        const figures = [...dialog.querySelectorAll('.order-readonly-figures > div')].map(row => { const dt = row.querySelector('dt'), dd = row.querySelector('dd'); return { gap: box(dd).x - box(dt).right, ddWidth: box(dd).width, ddRight: box(dd).right, dtRight: box(dt).right } })
        const hint = bar?.querySelector('p')
        const buttons = bar ? [...bar.querySelectorAll('button')].map(box) : []
        return { content, rem, bodyWidth: body ? box(body).width : null, innerWidth, figures,
          bar: bar ? { ...box(bar), buttons, hint: hint ? box(hint) : null, hintText: hint?.textContent?.trim() ?? '', buttonCount: buttons.length } : null,
          mainTop: box(main).y, formWidth: main.getBoundingClientRect().width }
      })
      if (!m) return
      const cap = EDITOR_CAP_REM * m.rem
      if (vw >= 768) {
        check(m.content.width <= cap + 1, `editor slideover is at most ${EDITOR_CAP_REM}rem wide (${Math.round(m.content.width)}px of ${Math.round(cap)}px): ${name}`)
        check(m.content.width < m.innerWidth - 100, `editor slideover does not stretch to the viewport: ${name}`)
        check(m.formWidth <= cap + 1, `editor content is at most ${EDITOR_CAP_REM}rem wide: ${name}`)
      }
      for (const [i, f] of m.figures.entries()) {
        check(f.gap >= 0 && f.gap < 600, `read-only line figure ${i + 1}: label-to-value distance is ${Math.round(f.gap)}px, under 600px: ${name}`)
        check(f.ddWidth <= 14 * m.rem + 1, `read-only line figure ${i + 1}: the value column is bounded (${Math.round(f.ddWidth)}px): ${name}`)
      }
      if (m.bar) {
        const last = m.bar.buttons.at(-1)
        check(m.bar.buttonCount >= 1 && m.bar.hint && m.bar.hintText.length > 0, `transition bar holds its buttons and an explanation: ${name}`)
        check(m.bar.hint.y >= Math.min(...m.bar.buttons.map(b => b.bottom)) - 1 || m.bar.hint.x >= last.right - 1, `the explanation sits under or beside the buttons in the same bar: ${name}`)
        check(m.bar.bottom <= m.mainTop + 1, `transition bar comes before the form or read-only block: ${name}`)
        check(m.bar.buttons.every(b => b.x >= m.bar.x && b.right <= m.bar.right && b.y >= m.bar.y && b.bottom <= m.bar.bottom) && m.bar.hint.right <= m.bar.right + 1, `transition buttons and hint sit inside the bar: ${name}`)
        check(m.bar.right - m.bar.x <= m.formWidth + 1, `transition bar is as wide as the editor content, not wider: ${name}`)
      }
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
      await editorDesign(name)
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
    const rows = () => page.locator(vw < 768 ? 'article.order-card' : 'tbody tr').filter({ has: page.getByRole('button', { name: OPEN_BUTTON }) })
    const applySearch = async term => {
      const response = waitRes(r => isList(r, statusNow, term))
      if (searchNow === term) await page.getByTestId('refresh-orders').click()
      else await page.getByPlaceholder('Buscar por proveedor o nota...', { exact: true }).fill(term)
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
          // The refresh and create actions share the search row, ordered search, filter, refresh, create, and sit at the card's right edge.
          const refresh = await page.getByTestId('refresh-orders').boundingBox()
          const create = await page.getByTestId('create-order').boundingBox()
          const mid = b => b.y + b.height / 2
          check(Boolean(refresh) && Boolean(create) && Math.abs(mid(refresh) - mid(search)) <= 6 && Math.abs(mid(create) - mid(search)) <= 6, `refresh and Nueva orden are on the search row at ${vw}: ${tag}`)
          check(search.x < box.x && box.x + box.width <= refresh.x + 1 && refresh.x + refresh.width <= create.x + 1, `toolbar order is search, Estado, refresh, Nueva orden at ${vw}: ${tag}`)
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
    const openOrder = async (order, name) => {
      const term = termOf(order)
      check(Boolean(term), `${name}: order has a readable note or supplier name`)
      await setStatus('ALL')
      await applySearch(term)
      const found = await call('GET', `${ORDERS}?search=${encodeURIComponent(term)}&limit=25`)
      const index = found.status === 200 ? found.value.items.findIndex(item => item.id === order.id) : -1
      check(index >= 0, `${name}: located through the readable search term`)
      await until(async () => (await rows().count()) === found.value.items.length && (await rows().nth(index).innerText()).includes(order.supplierName ?? term), `${name}: rendered rows match the query result`)
      await rows().nth(index).getByRole('button', { name: OPEN_BUTTON }).click()
      await slide().waitFor({ state: 'visible' })
    }
    const closeEditor = async () => { await page.keyboard.press('Escape'); await slide().waitFor({ state: 'hidden' }) }
    const rowStatus = async (order, name) => {
      const term = termOf(order)
      await applySearch(term)
      const found = await call('GET', `${ORDERS}?search=${encodeURIComponent(term)}&limit=25`)
      const index = found.value.items.findIndex(item => item.id === order.id)
      check(index >= 0, `${name}: row still located`)
      await until(async () => (await rows().count()) === found.value.items.length && (await rows().nth(index).innerText()).includes(order.supplierName ?? term), `${name}: rows settled`)
      return (await rows().nth(index).locator('[data-testid="order-status"]').innerText()).trim()
    }

    // ---- editor / transition helpers ----
    const present = id => slide().getByTestId(id).count().then(n => n > 0)
    const enabled = id => slide().getByTestId(id).isEnabled()
    const openTransition = async kind => {
      await slide().getByTestId(kind === 'confirm' ? 'confirm-order' : 'cancel-order').click()
      await modal().waitFor({ state: 'visible' })
    }
    const noTransitionUi = async name => {
      check(!(await present('confirm-order')) && !(await present('cancel-order')) && await slide().getByRole('button', { name: /^(Confirmar|Cancelar) orden$/ }).count() === 0, `no Confirmar/Cancelar order UI: ${name}`)
    }
    // A draft without update permission renders the read-only block (D3): no form, no disabled edit controls.
    const readOnlyDraft = async name => {
      const block = slide().getByTestId('order-readonly')
      await block.waitFor()
      check(await slide().locator('form.order-form').count() === 0 && await slide().getByRole('button', { name: /^(Guardar borrador|Agregar renglón|Cambiar producto|Quitar)/ }).count() === 0, `read-only draft has no form or edit controls: ${name}`)
      check(await block.locator('button:disabled, [disabled], [aria-disabled="true"]').count() === 0, `read-only draft has no disabled buttons: ${name}`)
      check((await block.locator('dd').first().innerText()).trim() === LABEL.DRAFT, `read-only draft shows the Borrador status: ${name}`)
    }
    // Money in read-only views is es-MX currency in tabular right-aligned cells; absent amounts read a dash.
    const moneyCells = async name => {
      const cells = slide().locator('[data-testid="line-cost"], [data-testid="line-subtotal"]')
      const texts = (await cells.allInnerTexts()).map(t => t.trim())
      check(texts.length > 0 && texts.every(text => text === '—' || MONEY.test(text)), `read-only money matches $1,234.00: ${name}`)
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
      const id = kind === 'confirm' ? 'confirm-order' : 'cancel-order'
      await until(() => page.evaluate(id => document.activeElement?.getAttribute('data-testid') === id, id), `focus returns to the invoker after Escape: ${name}`)
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
      await until(async () => (await s.getByTestId('order-readonly').locator('dd').first().innerText()).trim() === LABEL[state], `read-only block status is ${LABEL[state]}: ${name}`)
      await s.getByText(`${LABEL[state]} por ${actor}`, { exact: false }).first().waitFor()
      report.checks.push(`read-only block shows "${LABEL[state]} por ${actor}": ${name}`)
    }
    const subtotalsMatch = async (order, name) => {
      const texts = (await slide().locator('[data-testid="line-subtotal"]').allInnerTexts()).map(t => t.trim())
      const costs = (await slide().locator('[data-testid="line-cost"]').allInnerTexts()).map(t => t.trim())
      // Formatting must neither recalculate nor round: the digits equal the server decimal string.
      const same = (text, amount) => MONEY.test(text) && Number(text.replace(/[^\d.]/g, '')) === Number(amount)
      const subtotals = order.lines.map(line => order.subtotals.find(item => item.lineId === line.lineId)?.subtotal ?? null)
      check(texts.length > 0 && texts.length === subtotals.length && texts.every((text, i) => subtotals[i] ? same(text, subtotals[i].amount) : text === '—'), `line subtotals are the server values formatted as currency (dash when none): ${name}`)
      check(costs.length === order.lines.length && costs.every((text, i) => order.lines[i].informedUnitCost?.amount ? same(text, order.lines[i].informedUnitCost.amount) : text === '—'), `unit costs are the server values formatted as currency: ${name}`)
      await moneyCells(name)
    }

    // ---- fixtures: read-only classification of the showcase orders by readable attributes ----
    const brief = d => ({
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
        all.push(brief(res.value))
      }
      // Probe orders created by earlier runs of this harness are never showcase candidates.
      const seeds = all.filter(d => !(d.note ?? '').startsWith('Pedido de prueba de permisos')).sort((a, b) => a.createdAt < b.createdAt ? -1 : 1)
      const drafts = seeds.filter(d => d.status === 'DRAFT'), confirmed = seeds.filter(d => d.status === 'CONFIRMED'), cancelled = seeds.filter(d => d.status === 'CANCELLED')
      const ready = drafts.filter(d => d.canConfirm && d.supplierStatus === 'ACTIVE')
      const found = {
        readyToConfirm: ready[0], readyToConfirmSpare: ready[1],
        incompleteCost: drafts.find(d => !d.canConfirm && d.supplierStatus === 'ACTIVE' && d.issueCodes.some(code => code.startsWith('COST_'))),
        archivedSupplierDraft: drafts.find(d => d.supplierStatus === 'ARCHIVED'),
        confirmed: confirmed.find(d => d.confirmedBy), confirmedSpare: confirmed.at(-1),
        cancelledFromDraft: cancelled.find(d => !d.confirmedAt && d.lines.length > 0),
        cancelledFromConfirmed: cancelled.find(d => d.confirmedAt && d.cancelledAt && d.confirmedBy && d.cancelledBy),
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
    await page.getByTestId('refresh-orders').waitFor()
    await until(async () => (await rows().count()) > 0, 'list renders rows')
    check(report.outsideScope.length === 0, 'no out-of-scope shell dependencies before mutations')

    if (stage === 'manager') {
      const found = await resolveShowcase(['readyToConfirm', 'readyToConfirmSpare', 'incompleteCost', 'archivedSupplierDraft', 'confirmed', 'cancelledFromDraft', 'cancelledFromConfirmed'])
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
        await snap(`list-${tag}`)

        await openOrder(found.readyToConfirm, `ready draft ${tag}`)
        check(await slide().locator('form.order-form').count() === 1 && await enabled('confirm-order') && await enabled('cancel-order'), `ready draft: Confirmar and Cancelar enabled: ${tag}`)
        const saved = (await slide().locator('.order-subtotal .order-money').allInnerTexts()).map(t => t.trim())
        finding(saved.length > 0 && saved.every(text => MONEY.test(text)), `saved line subtotals in the editor are currency formatted: ${tag}`)
        await snap(`draft-ready-${tag}`)
        await openTransition('confirm'); await modalCopy('confirm', tag, found.readyToConfirm); await snap(`confirm-dialog-${tag}`)
        await page.keyboard.press('Escape'); await modal().waitFor({ state: 'hidden' })
        await openTransition('cancel'); await modalCopy('cancel', tag, found.readyToConfirm); await snap(`cancel-dialog-${tag}`)
        await modal().getByTestId('cancel-transition').click(); await modal().waitFor({ state: 'hidden' })
        await escapeReturnsFocus('confirm', tag)
        await escapeReturnsFocus('cancel', tag)
        // Unsaved edit blocks both transitions and explains why.
        const original = await slide().locator('textarea').inputValue()
        await slide().locator('textarea').fill(`${original} edición local`)
        await until(async () => !(await enabled('confirm-order')) && !(await enabled('cancel-order')), `unsaved edit blocks Confirmar and Cancelar: ${tag}`)
        await slide().getByText('Guarda tus cambios antes de confirmar o cancelar.', { exact: true }).waitFor()
        await disabledPrimaryLegible(`unsaved edit ${tag}`)
        report.checks.push(`unsaved edit shows "Guarda tus cambios antes de confirmar o cancelar.": ${tag}`)
        await snap(`draft-unsaved-${tag}`)
        const dialogsBefore = report.nativeDialogs.length
        await closeEditor()
        check(report.nativeDialogs.length === dialogsBefore + 1, `closing an unsaved editor asks once before discarding: ${tag}`)

        await openOrder(found.incompleteCost, `incompleteCost ${tag}`)
        check(!(await enabled('confirm-order')), `incompleteCost: Confirmar disabled: ${tag}`)
        await slide().getByText('Completa los avisos del borrador para poder confirmarla.', { exact: true }).waitFor()
        report.checks.push(`incompleteCost: hint is visible: ${tag}`)
        await disabledPrimaryLegible(`incompleteCost ${tag}`)
        await snap(`draft-incomplete-${tag}`); await closeEditor()

        await openOrder(found.archivedSupplierDraft, `archivedSupplierDraft ${tag}`)
        check(!(await enabled('confirm-order')), `archivedSupplierDraft: Confirmar disabled: ${tag}`)
        await snap(`draft-archived-supplier-${tag}`); await closeEditor()

        await openOrder(found.confirmed, `confirmed ${tag}`)
        await expectClosed('CONFIRMED', found.confirmed.confirmedBy, `confirmed ${tag}`)
        await subtotalsMatch(found.confirmed, `confirmed ${tag}`)
        check(!(await present('confirm-order')) && await enabled('cancel-order'), `confirmed: no Confirmar, Cancelar available: ${tag}`)
        await snap(`confirmed-${tag}`); await closeEditor()

        const both = found.cancelledFromConfirmed
        check(both.confirmedBy === NAMES.confirmer && both.cancelledBy === NAMES.canceller, `cancelledFromConfirmed actors are ${NAMES.confirmer} and ${NAMES.canceller}: ${tag}`)
        await openOrder(both, `cancelledFromConfirmed ${tag}`)
        await expectClosed('CANCELLED', NAMES.canceller, `cancelledFromConfirmed ${tag}`)
        const closure = await slide().getByTestId('order-readonly').innerText()
        // A cancelled order that was confirmed first keeps both closure records (bb1ba884).
        check(closure.includes(`Confirmada por ${NAMES.confirmer}`) && closure.includes(`Cancelada por ${NAMES.canceller}`), `cancelledFromConfirmed shows both Confirmada por ${NAMES.confirmer} and Cancelada por ${NAMES.canceller}: ${tag}`)
        check(!(await present('confirm-order')) && !(await present('cancel-order')), `cancelled: no transition buttons: ${tag}`)
        await snap(`cancelled-from-confirmed-${tag}`); await closeEditor()

        await openOrder(found.cancelledFromDraft, `cancelledFromDraft ${tag}`)
        await expectClosed('CANCELLED', found.cancelledFromDraft.cancelledBy, `cancelledFromDraft ${tag}`)
        await subtotalsMatch(found.cancelledFromDraft, `cancelledFromDraft ${tag}`)
        check((await slide().locator('[data-testid="line-subtotal"]').allInnerTexts()).every(t => t.trim() === '—'), `never-confirmed cancelled order shows the subtotal dash: ${tag}`)
        await snap(`cancelled-from-draft-${tag}`); await closeEditor()
      }

      for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
        await setView(width, theme)
        if (theme === 'light') await filterChecks(String(width))
        await readOnlyTour(`${width}-${theme}`)
      }

      // Mutations: the confirm is exercised at 1440/light, the cancel at 390/dark (both on the designated spares).
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
      check(await rowStatus(found.readyToConfirm, 'confirmed row') === LABEL.CONFIRMED, 'list row now shows Confirmada')

      step = 'cancel readyToConfirmSpare through the dialog'
      await setView(390, 'dark')
      await openOrder(found.readyToConfirmSpare, 'cancel flow')
      await transition('cancel', 'readyToConfirmSpare')
      await expectClosed('CANCELLED', NAMES.manager, 'readyToConfirmSpare after cancel')
      await page.getByText('Orden cancelada correctamente.', { exact: true }).waitFor()
      check(!(await present('confirm-order')) && !(await present('cancel-order')), 'cancelled order offers no transitions')
      await snap('result-cancelled-390-dark')
      const cancelledRead = await call('GET', `${ORDERS}/${found.readyToConfirmSpare.id}`)
      check(cancelledRead.status === 200 && cancelledRead.value.status === 'CANCELLED' && cancelledRead.value.confirmedAt === null, 'API agrees: CANCELLED, never confirmed')
      await closeEditor()
      check(await rowStatus(found.readyToConfirmSpare, 'cancelled row') === LABEL.CANCELLED, 'list row now shows Cancelada')
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
        check(await enabled('cancel-order'), `Cancelar order is available before the order goes stale: ${tag}`)
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
        check(!(await present('confirm-order')) && !(await present('cancel-order')), `re-read order offers no transitions: ${tag}`)
        await snap(`stale-after-${tag}`)
        await closeEditor()
        check(await rowStatus(target, `stale order ${tag}`) === LABEL.CANCELLED, `list row shows Cancelada: ${tag}`)
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
      // Strict roles (reader) must show no mutation chrome at all; the others only never offer edit.
      const listChrome = async (role, strict) => {
        report.observed[`${role}ListChrome`] = { create: await page.getByTestId('create-order').count(), discard: await page.getByTestId('discard-order').count(), edit: await page.getByRole('button', { name: 'Continuar', exact: true }).count() }
        const chrome = report.observed[`${role}ListChrome`]
        check(role === 'editor' || chrome.edit === 0, `${role}: no Continuar (edit) action`)
        check(!strict || (chrome.create === 0 && chrome.discard === 0 && chrome.edit === 0), `${role}: no Nueva orden, Descartar or Continuar`)
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
          await listChrome(role, false)
          await openOrder(cancelProbe, 'editor opens a ready draft')
          check(await slide().locator('form.order-form').count() === 1, 'editor: draft opens in the editor')
          report.observed.editorFormEnabled = await slide().getByRole('button', { name: 'Guardar borrador', exact: true }).isEnabled()
          await noTransitionUi('editor on a draft')
          await snap('editor-draft-1440-light'); await closeEditor()
          await openOrder(found.confirmed, 'editor opens a confirmed order')
          await slide().getByTestId('order-readonly').waitFor()
          await noTransitionUi('editor on a confirmed order')
          await snap('editor-confirmed-1440-light'); await closeEditor()
          await forbidden(role, cancelProbe, ['confirm', 'cancel'])
        } else if (role === 'confirmer') {
          await listChrome(role, false)
          await openOrder(cancelProbe, 'confirmer opens a draft')
          await readOnlyDraft('confirmer')
          check(await enabled('confirm-order') && !(await present('cancel-order')), 'confirmer: Confirmar available, no Cancelar')
          await snap('confirmer-draft-1440-light'); await closeEditor()
          await forbidden(role, cancelProbe, ['cancel'])
          await openOrder(confirmProbe, 'confirmer confirms a probe draft')
          await readOnlyDraft('confirmer before confirming')
          await transition('confirm', 'confirmer')
          await expectClosed('CONFIRMED', NAMES.confirmer, 'confirmer result')
          await noTransitionUi('confirmer after confirming (no Cancelar)')
          await snap('confirmer-result-1440-light'); await closeEditor()
          check(await rowStatus(confirmProbe, 'confirmer row') === LABEL.CONFIRMED, 'confirmer: list row shows Confirmada')
        } else if (role === 'canceller') {
          await listChrome(role, false)
          await openOrder(cancelProbe, 'canceller cancels a probe draft')
          await readOnlyDraft('canceller')
          check(await enabled('cancel-order') && !(await present('confirm-order')), 'canceller: Cancelar available, no Confirmar')
          await snap('canceller-draft-1440-light')
          await transition('cancel', 'canceller')
          await expectClosed('CANCELLED', NAMES.canceller, 'canceller result')
          await snap('canceller-result-1440-light'); await closeEditor()
          check(await rowStatus(cancelProbe, 'canceller row') === LABEL.CANCELLED, 'canceller: list row shows Cancelada')
          await forbidden(role, confirmProbe, ['confirm'])
        } else {
          await listChrome(role, true)
          await openOrder(found.incompleteCost, 'reader opens a draft')
          await readOnlyDraft('reader'); await noTransitionUi('reader on a draft')
          await moneyCells('reader draft')
          const warned = (await slide().locator('.order-warning').allInnerTexts()).join(' ')
          check(warned.length > 0 && !/[A-Z]{3,}_[A-Z_]{2,}/.test(await slide().getByTestId('order-readonly').innerText()), 'reader draft shows readable warnings and no raw issue codes')
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
