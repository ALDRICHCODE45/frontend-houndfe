// Parent-run Playwright MCP only. Never enable tracing/video/storageState here.
const ORIGIN = 'http://127.0.0.1:43179'
const API = 'http://127.0.0.1:45581'
const DIR = '/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/odd/evidence/procurement-suppliers'
const CREDENTIALS = '/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/.tmp/procurement-suppliers-o3a/.tmp/supplier-runtime.delete.M94OVT/credentials.json'
const SUPPLIERS = '/procurement/suppliers'
const allowed = (method, path) =>
  (method === 'POST' && ['/auth/login', '/auth/logout', '/auth/refresh'].includes(path)) ||
  (method === 'GET' && ['/auth/me', '/auth/me/permissions'].includes(path)) ||
  (['GET', 'POST'].includes(method) && path === SUPPLIERS) ||
  (['GET', 'PATCH', 'DELETE'].includes(method) && /^\/procurement\/suppliers\/[a-z0-9-]+$/.test(path))
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : null

async function randomUUID(page) {
  return await page.evaluate(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 15) | 64
    bytes[8] = (bytes[8] & 63) | 128
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  })
}

export async function run(browserPage, stage) {
  const report = { stage, coverage: 'production entry/router/full shell, real auth store and HTTP transport; programmatic password login, not login-form coverage',
    prefix: `FEProbe-${Date.now()}`, checks: [], screenshots: [], requests: [], outsideScope: [], runtimeErrorCount: 0, verdict: 'incomplete' }
  let step = 'read authorized credentials in memory'
  let context
  const check = (condition, name) => { if (!condition) { report.failureCheck = name; throw new Error('Assertion failed') } report.checks.push(name) }
  try {
    check(['manager', 'permissions', 'delete'].includes(stage), 'known bounded stage')
    context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    // Documented file selection, not a Node import or sandbox escape. The blank
    // page cannot send network traffic and is closed before any screenshots.
    const credentialPage = await context.newPage()
    credentialPage.setDefaultTimeout(15000)
    let credentials
    try {
      await credentialPage.route('**/*', route => route.abort('blockedbyclient'))
      await credentialPage.setContent('<input id="fixture-credentials" type="file">')
      const input = credentialPage.locator('#fixture-credentials')
      await input.setInputFiles(CREDENTIALS)
      credentials = await input.evaluate(async element => {
        const data = JSON.parse(await element.files[0].text())
        return { apiOrigin: data.apiOrigin, password: data.password, users: {
          manager: { email: data.users.manager.email }, reader: { email: data.users.reader.email }, noaccess: { email: data.users.noaccess.email },
        } }
      })
    } finally { await credentialPage.close() }
    check(credentials.apiOrigin === API && typeof credentials.password === 'string', 'fixture origin and credential shape')
    await context.addInitScript(() => localStorage.setItem('vueuse-color-mode', 'light'))
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    report.prefix += `-${(await randomUUID(page)).slice(0, 8)}`
    page.on('pageerror', () => report.runtimeErrorCount++)
    const pendingLogs = []
    page.on('response', response => {
      const request = response.request()
      const url = new URL(response.url())
      if (url.origin !== API) return
      const row = { method: request.method(), path: url.pathname, status: response.status(), error: null }
      report.requests.push(row)
      if (row.status >= 400) pendingLogs.push(response.json().then(body => { row.error = safeCode(body.error) || safeCode(body.code) }).catch(() => {}))
    })
    await context.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin === ORIGIN) return route.continue().catch(() => {})
      if (url.origin === API && (allowed(request.method(), url.pathname) || (request.method() === 'OPTIONS' && ['GET', 'POST', 'PATCH', 'DELETE'].some(method => allowed(method, url.pathname))))) return route.continue().catch(() => {})
      if (request.method() === 'GET' && url.protocol === 'https:' && ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'].includes(url.hostname)) return route.continue().catch(() => {})
      // Never fake tenant/menu/supplier responses or call existing API ports.
      report.outsideScope.push({ method: request.method(), path: url.pathname, origin: url.origin === API ? API : 'unapproved-origin' })
      return route.abort('blockedbyclient').catch(() => {})
    })
    const settled = async () => {
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))
      })
    }
    const dialog = async () => { const d = page.getByRole('dialog'); await d.waitFor(); await settled(); return d }
    const shot = async name => {
      await settled()
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no page overflow: ${name}`)
      const d = page.getByRole('dialog')
      if (await d.count()) check(await d.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 }), `bounded overlay: ${name}`)
      const path = `${DIR}/runtime-${stage}-${name}.png`
      await page.screenshot({ path, fullPage: true, animations: 'disabled' })
      report.screenshots.push(path)
    }
    const login = async role => {
      step = `${role}: real login and shell admission`
      await page.goto(`${ORIGIN}/login`)
      // Read-only mounted-app identity check. Never inspect/return its private state.
      await page.waitForFunction(() => {
        const globals = document.querySelector('#app')?.__vue_app__?.config.globalProperties
        return Boolean(globals?.$router && globals?.$pinia)
      })
      // Values exist only in ephemeral script/browser memory, never in tool-visible code/output.
      const result = await page.evaluate(async ({ email, password }) => {
        let identityVerified = false
        try {
          // Exact URLs emitted by this server's real /src/main.ts entry.
          const { useAuthStore } = await import('/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/features/auth/stores/useAuthStore.ts')
          const { default: router } = await import('/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/app/router/index.ts')
          const globals = document.querySelector('#app').__vue_app__.config.globalProperties
          if (router !== globals.$router) return { ok: false, identityVerified: false }
          const store = useAuthStore(globals.$pinia)
          identityVerified = true
          await store.login({ email, password })
          if (!store.isAuthenticated || store.authPhase !== 'authenticated' || !store.permissionsLoaded) return { ok: false, identityVerified }
          await store.fetchMe()
          await router.replace('/procurement/suppliers')
          return { ok: true, identityVerified, path: router.currentRoute.value.path }
        } catch (error) {
          const code = error?.response?.data?.error ?? error?.response?.data?.code
          return { ok: false, identityVerified, status: error?.response?.status ?? null, code: typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : null }
        }
      }, { email: credentials.users[role].email, password: credentials.password })
      check(result.identityVerified === true, `${role}: canonical router equals mounted router; store uses mounted Pinia`)
      check(result.ok, `${role}: authenticated via real auth store${result.status ? ` status=${result.status} error=${result.code}` : ''}`)
      check(report.outsideScope.length === 0, 'no required out-of-scope shell requests')
      if (result.path === SUPPLIERS) {
        await page.getByRole('heading', { name: 'Proveedores', exact: true }).waitFor()
        await page.getByPlaceholder('Buscar proveedor...', { exact: true }).waitFor()
        check(await page.getByRole('heading', { name: 'Proveedores', exact: true }).isVisible() && await page.getByPlaceholder('Buscar proveedor...', { exact: true }).isVisible(), `${role}: supplier UI rendered by mounted router before mutations`)
      }
      return result.path
    }
    const logout = async () => {
      const ok = await page.evaluate(async () => { try { const { useAuthStore } = await import('/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/features/auth/stores/useAuthStore.ts'); const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia; await useAuthStore(pinia).logout(); return true } catch { return false } })
      check(ok, 'real logout')
    }
    // Real feature adapter for concurrent writes and boundary probes; no token extraction.
    const apiCall = (method, args) => page.evaluate(async ({ method, args }) => {
      try {
        const { suppliersApi } = await import('/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/features/procurement/suppliers/api/suppliers.api.ts')
        const value = await suppliersApi[method](...args)
        return { ok: true, value }
      } catch (error) {
        const raw = error?.response?.data
        const code = raw?.error ?? raw?.code
        return { ok: false, status: error?.response?.status ?? null, error: typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : null }
      }
    }, { method, args })
    const search = value => page.getByPlaceholder('Buscar proveedor...', { exact: true }).fill(value)
    const row = name => page.getByRole('button', { name, exact: true })
    const saved = async () => { await page.getByRole('dialog').waitFor({ state: 'hidden' }); await page.getByText('Proveedor guardado correctamente.', { exact: true }).waitFor() }
    const create = async name => {
      await page.getByTestId('create-supplier').click(); const d = await dialog()
      await page.getByLabel('Nombre del proveedor').fill(name)
      await page.getByLabel('Condiciones acordadas').fill('Condiciones sintéticas de verificación desechable.')
      await d.getByRole('button', { name: 'Crear proveedor', exact: true }).click(); await saved(); await row(name).waitFor()
    }
    check(await login('manager') === SUPPLIERS, 'manager route admitted')
    step = 'create unique disposable record through UI'
    const name = `${report.prefix}-supplier`
    await search(report.prefix)
    await create(name)
    const found = await apiCall('list', [{ status: 'ALL', search: report.prefix, limit: 100 }])
    check(found.ok && found.value.items.length === 1 && found.value.items[0].displayName === name, 'real create/list/search uniquely scoped')
    const id = found.value.items[0].id
    report.supplierPath = `${SUPPLIERS}/${id}`

    if (stage === 'manager') {
      step = 'edit/null-clear and fresh reload persistence'
      await row(name).click(); let d = await dialog()
      await page.getByLabel('Condiciones acordadas').fill('')
      await d.getByRole('button', { name: 'Guardar cambios', exact: true }).click(); await saved()
      await page.reload(); await page.getByRole('heading', { name: 'Proveedores', exact: true }).waitFor(); await search(report.prefix); await row(name).waitFor()
      let current = await apiCall('get', [id])
      check(current.ok && current.value.termsText === null && current.value.displayName === name, 'null-clear persisted across fresh reload')
      step = 'real competing update and explicit conflict reload'
      await row(name).click(); d = await dialog()
      const local = `${report.prefix}-local`; const remote = `${report.prefix}-remote`
      await page.getByLabel('Nombre del proveedor').fill(local)
      const changed = await apiCall('update', [id, { expectedVersion: current.value.version, changes: { displayName: remote } }, await randomUUID(page)])
      check(changed.ok, 'real competing update accepted')
      await d.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
      await d.getByText('El proveedor cambió en otra sesión.', { exact: false }).waitFor()
      check(await page.getByLabel('Nombre del proveedor').inputValue() === local, '409 conflict preserves local buffer')
      await d.getByTestId('reload-supplier').click()
      await page.waitForFunction(expected => document.querySelector('#supplier-name')?.value === expected, remote)
      check(await d.getByText('El proveedor cambió en otra sesión.', { exact: false }).count() === 0, 'explicit reload replaces buffer and clears conflict')
      await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); await d.waitFor({ state: 'hidden' })
      await page.getByTestId('refresh-suppliers').click(); await row(remote).waitFor()
      step = 'archive/reactivate and reload persistence'
      for (const [action, filter] of [['Archivar', 'ARCHIVED'], ['Reactivar', 'ACTIVE']]) {
        await page.getByRole('button', { name: `${action} ${remote}`, exact: true }).click(); d = await dialog()
        await d.getByRole('button', { name: action, exact: true }).click(); await saved()
        await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption(filter)
        await row(remote).waitFor()
        current = await apiCall('get', [id]); check(current.ok && current.value.status === filter, `${action}: real persisted state`)
        await page.reload(); await search(report.prefix)
        await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption(filter)
        await row(remote).waitFor()
      }
      await page.reload(); await search(report.prefix); await row(remote).waitFor()
      current = await apiCall('get', [id]); check(current.ok && current.value.status === 'ACTIVE', 'reactivation survives fresh reload')

      step = 'uncertain result: real accepted PATCH with intentionally dropped response'
      await row(remote).click(); d = await dialog()
      await page.getByLabel('Condiciones acordadas').fill('Resultado incierto sintético recuperado explícitamente.')
      let intercepted = null; let replayMatches = false; let writeCount = 0
      const pattern = `${API}${SUPPLIERS}/${id}`
      const dropOnce = async route => {
        if (route.request().method() !== 'PATCH') return route.fallback()
        writeCount++
        const req = route.request()
        if (writeCount === 1) {
          const response = await route.fetch()
          const body = await response.json()
          intercepted = { status: response.status(), version: body.version, key: req.headers()['idempotency-key'], body: req.postData() }
          return route.abort('connectionreset')
        }
        replayMatches = intercepted.key === req.headers()['idempotency-key'] && intercepted.body === req.postData()
        return route.fallback()
      }
      await page.route(pattern, dropOnce)
      await d.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
      await d.getByRole('button', { name: 'Recuperar resultado', exact: true }).waitFor()
      check(intercepted?.status >= 200 && intercepted.status < 300, 'uncertain test dropped a real successful backend response')
      check(writeCount === 1, 'no automatic uncertain mutation retry')
      await d.getByRole('button', { name: 'Recuperar resultado', exact: true }).click(); await saved()
      await page.unroute(pattern, dropOnce)
      current = await apiCall('get', [id])
      check(writeCount === 2 && replayMatches && current.ok && current.value.version === intercepted.version, 'explicit uncertain retry reuses payload/key without second version increment')
      report.uncertainResult = { method: 'PATCH', path: report.supplierPath, committedStatus: intercepted.status, intentionallyDroppedResponse: true, explicitReplayCount: 1, samePayloadAndKey: replayMatches, versionAdvancedOnce: true }
      intercepted = null

      step = 'four-mode settled visual and keyboard evidence'
      for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(theme => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.colorScheme = theme }, theme)
        await row(remote).waitFor()
        check(await (width === 390 ? page.getByTestId('mobile-cards-list') : page.locator('table')).isVisible(), `canonical ${width === 390 ? 'mobile cards' : 'desktop table'} ${theme}`)
        await shot(`list-${width}-${theme}`)
        if (width === 390) {
          await page.getByRole('button', { name: 'Filtros', exact: true }).click(); d = await dialog()
          await shot(`filters-${width}-${theme}`)
          await d.getByRole('button', { name: 'Cerrar', exact: true }).click(); await d.waitFor({ state: 'hidden' })
        }
        await row(remote).focus(); await page.keyboard.press('Enter'); d = await dialog()
        for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); check(await d.evaluate(el => el.contains(document.activeElement)), `focus trapped ${width}/${theme}/${i}`) }
        await shot(`form-${width}-${theme}`)
        await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' })
        check(await row(remote).evaluate(el => el === document.activeElement), `Escape restores trigger focus ${width}/${theme}`)
        await page.getByRole('button', { name: `Archivar ${remote}`, exact: true }).click(); d = await dialog()
        await shot(`archive-${width}-${theme}`)
        await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); await d.waitFor({ state: 'hidden' })
      }
      step = 'real delayed GET loading presentation'
      let releaseRead
      const readGate = new Promise(resolve => { releaseRead = resolve })
      // Requests held here may be cancelled by the app (query refresh); a late
      // resolution must not surface as an unhandled rejection outside the report.
      const delayRead = async route => { try { if (route.request().method() === 'GET') await readGate; await route.fallback() } catch {} }
      await page.route(`${API}${SUPPLIERS}?**`, delayRead)
      try {
        await page.getByTestId('refresh-suppliers').click()
        await page.getByTestId('mobile-cards-loading').waitFor()
        await shot('loading-390-dark')
      } finally { releaseRead(); await page.unroute(`${API}${SUPPLIERS}?**`, delayRead) }
      await row(remote).waitFor()
      step = 'meaningful empty and induced transport-error recovery'
      await search(`${report.prefix}-no-match`)
      await page.getByText('No hay proveedores para esta búsqueda.', { exact: true }).waitFor(); await shot('empty-390-dark')
      await search(report.prefix); await row(remote).waitFor()
      let droppedRead = false
      const failRead = async route => { try { if (route.request().method() === 'GET') { droppedRead = true; await route.abort('connectionreset') } else await route.fallback() } catch {} }
      await page.route(`${API}${SUPPLIERS}?**`, failRead)
      await page.getByTestId('refresh-suppliers').click()
      await page.getByText('No se pudieron cargar los proveedores. Puedes volver a actualizar.', { exact: true }).waitFor(); await shot('transport-error-390-dark')
      await page.unroute(`${API}${SUPPLIERS}?**`, failRead)
      await page.getByTestId('refresh-suppliers').click(); await row(remote).waitFor()
      check(droppedRead, 'induced real GET transport failure recovers on explicit refresh; not a server-500 test')
      await Promise.all(pendingLogs)
      check(report.requests.some(r => r.method === 'PATCH' && r.path === report.supplierPath && r.status === 409 && r.error === 'SUPPLIER_VERSION_CONFLICT'), 'observed exact backend conflict status/code')
    } else if (stage === 'permissions') {
      await logout()
      for (const role of ['reader', 'noaccess']) {
        step = `${role}: UI permission and real backend denial boundaries`
        const path = await login(role)
        if (role === 'reader') {
          check(path === SUPPLIERS, 'reader route admitted')
          await search(report.prefix); await row(name).waitFor()
          check(await page.getByTestId('create-supplier').count() === 0 && await page.getByTestId('supplier-status').count() === 0, 'reader has no mutation controls')
          await row(name).click(); const d = await dialog()
          await page.getByTestId('supplier-readonly').waitFor(); await shot('reader-readonly-1440-light')
          check(await page.getByLabel('Nombre del proveedor').count() === 0, 'reader details are read-only')
          await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' })
          const read = await apiCall('get', [id]); check(read.ok, 'reader real GET allowed')
        } else {
          check(path === '/403', 'noaccess route denied by real router')
          check(await page.getByTestId('create-supplier').count() === 0 && await page.getByTestId('supplier-detail').count() === 0, 'noaccess sees no supplier data/control')
          await shot('noaccess-403-1440-light')
          for (const [method, args] of [['get', [id]], ['list', [{ status: 'ALL', search: report.prefix, limit: 100 }]]]) {
            const denied = await apiCall(method, args)
            check(!denied.ok && denied.status === 403 && denied.error === 'FORBIDDEN', `noaccess ${method}: 403 FORBIDDEN`)
          }
        }
        for (const [method, args] of [
          ['create', [{ displayName: `${report.prefix}-${role}-denied`, termsText: null, status: 'ACTIVE' }, await randomUUID(page)]],
          ['update', [id, { expectedVersion: found.value.items[0].version, changes: { termsText: 'must be forbidden' } }, await randomUUID(page)]],
        ]) {
          const denied = await apiCall(method, args)
          check(!denied.ok && denied.status === 403 && denied.error === 'FORBIDDEN', `${role} ${method}: 403 FORBIDDEN`)
        }
        await logout()
      }
    } else if (stage === 'delete') {
      const action = target => page.getByRole('button', { name: `Eliminar ${target}`, exact: true })
      const deletes = () => report.requests.filter(r => r.method === 'DELETE')
      step = 'delete action, confirmation and cancel in four modes'
      let d
      for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(theme => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.colorScheme = theme }, theme)
        await row(name).waitFor()
        await shot(`list-${width}-${theme}`)
        await action(name).focus(); await page.keyboard.press('Enter'); d = await dialog()
        check(await d.getByRole('button', { name: 'Sí, eliminar', exact: true }).isVisible(), `destructive confirmation ${width}/${theme}`)
        await shot(`confirm-${width}-${theme}`)
        await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); await d.waitFor({ state: 'hidden' })
        await settled()
        check(await action(name).evaluate(el => el === document.activeElement), `cancel restores trigger focus ${width}/${theme}`)
      }
      check(deletes().length === 0, 'cancel sends no DELETE')
      step = 'stale-version deletion is rejected and keeps the supplier'
      let current = await apiCall('get', [id])
      await action(name).click(); d = await dialog()
      const changed = await apiCall('update', [id, { expectedVersion: current.value.version, changes: { termsText: 'Cambio concurrente sintético.' } }, await randomUUID(page)])
      check(changed.ok, 'real competing update accepted')
      await d.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
      await d.getByText('El proveedor cambió en otra sesión.', { exact: false }).waitFor()
      await Promise.all(pendingLogs)
      check(deletes().some(r => r.status === 409 && r.error === 'SUPPLIER_VERSION_CONFLICT'), 'DELETE 409 SUPPLIER_VERSION_CONFLICT observed')
      check((await apiCall('get', [id])).ok, 'supplier still exists after rejected deletion')
      await shot('conflict-390-dark')
      await d.getByRole('button', { name: 'Cancelar', exact: true }).click(); await d.waitFor({ state: 'hidden' })
      step = 'real deletion'
      await page.getByTestId('refresh-suppliers').click(); await row(name).waitFor()
      await action(name).click(); d = await dialog()
      await d.getByRole('button', { name: 'Sí, eliminar', exact: true }).click()
      await d.waitFor({ state: 'hidden' })
      await page.getByText('Proveedor eliminado correctamente.', { exact: true }).waitFor()
      check(await row(name).count() === 0, 'deleted row removed after refresh')
      await settled()
      check(await page.evaluate(() => document.activeElement?.getAttribute('placeholder') === 'Buscar proveedor...'), 'focus moves to supplier search after deletion')
      await shot('deleted-390-dark')
      check(deletes().some(r => r.path === report.supplierPath && r.status === 204), 'DELETE 204 observed')
      const gone = await apiCall('get', [id])
      check(!gone.ok && gone.status === 404, 'deleted supplier GET 404')
      step = 'restricted users cannot delete'
      const name2 = `${report.prefix}-protected`
      await create(name2)
      const found2 = await apiCall('list', [{ status: 'ALL', search: name2, limit: 100 }])
      check(found2.ok && found2.value.items.length === 1, 'second synthetic supplier created')
      const target = found2.value.items[0]
      await logout()
      for (const role of ['reader', 'noaccess']) {
        await login(role)
        if (role === 'reader') {
          await search(report.prefix); await row(name2).waitFor()
          check(await page.getByTestId('supplier-delete').count() === 0, 'reader sees no Eliminar action')
        }
        const denied = await apiCall('delete', [target.id, { expectedVersion: target.version }, await randomUUID(page)])
        check(!denied.ok && denied.status === 403 && denied.error === 'FORBIDDEN', `${role} DELETE: 403 FORBIDDEN`)
        await logout()
      }
    } else throw new Error('Unknown stage')
    await Promise.all(pendingLogs)
    check(report.outsideScope.length === 0, 'no blocked shell dependency or unauthorized origin')
    check(report.runtimeErrorCount === 0, 'no uncaught browser runtime errors')
    report.verdict = 'script assertions passed; parent must visually inspect screenshots'
  } catch {
    // Never return raw exceptions: Axios/Playwright errors may include secrets.
    report.verdict = 'stopped'
    report.blocker = `Failed step: ${step}. Inspect sanitized requests and last passed check; no raw exception retained.`
  } finally {
    if (context) await context.close()
  }
  return report
}
