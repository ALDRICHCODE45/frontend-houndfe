async (page) => {
// Expanded from runtime-checks.mjs; no VM modules.
// Canonical parent-run MCP harness for O3c. No execution during preparation.
// The three placeholders below are replaced by generate-runtime-mcp.mjs only.
const API = "http://127.0.0.1:42271"
const CREDENTIALS = "/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/.tmp/procurement-suppliers-o3a/.tmp/po-runtime.N2VBXY/credentials.json"
const DIR = "/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-order-confirmation"
// Git HEAD at generation time, and whether src/docs had uncommitted changes then (traceability, L19).
const COMMIT = "3d98c48c27a0104c813a79892dfd66d3b062dbbe"
const TREE_DIRTY = false
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

async function run(browserPage, stage, part = null) {
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

    await login('manager')
    await page.waitForSelector('button.hf-row-primary')
    const res = {}
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500)
      res[w] = await page.evaluate(() => { const n = document.querySelector('.hf-shell-breadcrumb'); const items = [...n.querySelectorAll('.hf-shell-breadcrumb-item')].filter(e => getComputedStyle(e).display !== 'none'); return { visible: items.map(e => e.textContent.trim()), height: Math.round(n.getBoundingClientRect().height), lines: items.map(e => Math.round(e.getBoundingClientRect().height)) } })
      await page.screenshot({ path: `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/ui-clarity-pass/breadcrumb-${w}.png`, clip: { x: 0, y: 0, width: w, height: 70 } })
    }
    report.res = res
  } catch (e) { report.blocker = step + ': ' + String(e?.message ?? e).split('\n')[0].slice(0, 200) } finally { await context?.close() }
  return { res: report.res, blocker: report.blocker ?? null }
}
return await run(page, 'manager', null)
}
