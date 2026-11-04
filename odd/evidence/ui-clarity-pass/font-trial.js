async (page) => {
// Expanded from runtime-checks.mjs; no VM modules.
// Canonical parent-run MCP harness for O3c. No execution during preparation.
// The three placeholders below are replaced by generate-runtime-mcp.mjs only.
const API = "http://127.0.0.1:33855"
const CREDENTIALS = "/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/.tmp/procurement-suppliers-o3a/.tmp/po-runtime.fXEKWW/credentials.json"
const DIR = "/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-order-confirmation"
// Git HEAD at generation time, and whether src/docs had uncommitted changes then (traceability, L19).
const COMMIT = "40638c44fab7da0970af5a546c6e50b1a91e3899"
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

async function run(browserPage, stage) {
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

    const OUT = '/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/ui-clarity-pass'
    const GEIST = ':root,html,body,.hf-theme,.hf-ui{--hf-font:"Geist",ui-sans-serif,system-ui,sans-serif !important;--font-sans:"Geist",system-ui,sans-serif !important;--shell-font:"Geist",ui-sans-serif,system-ui,sans-serif !important}'
    const fonts = {}
    const capture = async (font, theme) => {
      await login('manager')
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.evaluate(t => { document.documentElement.classList.toggle('dark', t === 'dark'); document.documentElement.style.colorScheme = t }, theme)
      await page.waitForSelector('tbody tr')
      if (font === 'geist') {
        await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap' })
        await page.addStyleTag({ content: GEIST })
      }
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(600)
      fonts[font + '-' + theme] = await page.evaluate(() => ({ body: getComputedStyle(document.querySelector('.purchase-orders-page') ?? document.body).fontFamily.slice(0, 60), loaded: document.fonts.check('16px Geist'), manrope: document.fonts.check('16px Manrope') }))
      const mask = [page.getByText(/[^\s@]+@[^\s@]+\.[^\s@]+/)]
      await page.screenshot({ path: `${OUT}/font-${font}-list-1440-${theme}.png`, animations: 'disabled', mask })
      await page.getByRole('button', { name: 'Continuar' }).first().click()
      await page.locator('[role="dialog"]').first().waitFor()
      await page.waitForTimeout(700)
      await page.screenshot({ path: `${OUT}/font-${font}-order-1440-${theme}.png`, animations: 'disabled', mask })
      await page.keyboard.press('Escape')
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${OUT}/font-${font}-list-390-${theme}.png`, animations: 'disabled', mask })
      await logout()
    }
    for (const font of ['manrope', 'geist']) await capture(font, 'light')
    await capture('geist', 'dark')
    report.fonts = fonts
    report.verdict = 'captured'
  } catch (e) { report.blocker = step + ': ' + String(e?.message ?? e).split('\n')[0].slice(0, 200) } finally { await context?.close() }
  return { verdict: report.verdict, fonts: report.fonts, blocker: report.blocker ?? null, failureCheck: report.failureCheck ?? null, runtimeErrors: report.runtimeErrorCount }
}
return await run(page, 'manager')
}
