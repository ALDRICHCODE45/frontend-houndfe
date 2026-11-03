async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  const p = await context.newPage();
  const tenant = { id: 'supplier-test-branch', name: 'Centro de prueba', slug: 'centro-prueba' };
  const user = { id: 'supplier-test-user', email: 'supplier@example.test', name: 'Prueba Proveedores', isActive: true, createdAt: '2026-01-01T00:00:00Z' };
  const grants = ['read:ProcurementSupplier', 'create:ProcurementSupplier', 'update:ProcurementSupplier'];
  let rows = [{ id: '11111111-1111-4111-8111-111111111111', displayName: 'Distribuidora Veterinaria del Centro', termsText: 'Entrega de lunes a viernes. Condiciones sujetas al acuerdo de cada compra.', status: 'ACTIVE', version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }];
  const writes = []; const errors = []; const blockedAssets = [];
  let listFailure = false;
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(({ tenant, user, grants }) => {
    const payload = { sub: user.id, email: user.email, tenantId: tenant.id, tenantSlug: tenant.slug, isSuperAdmin: false, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
    const enc = x => btoa(JSON.stringify(x)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const values = { accessToken: enc({ alg: 'none', typ: 'JWT' }) + '.' + enc(payload) + '.fixture', refreshToken: 'supplier-fixture-refresh', user: JSON.stringify(user), permissionCodes: JSON.stringify(grants), currentTenant: JSON.stringify(tenant), memberships: JSON.stringify([tenant]), isSuperAdmin: 'false' };
    for (const [key, value] of Object.entries(values)) localStorage.setItem('hound.auth.' + key, value);
  }, { tenant, user, grants });
  await context.route('**/*', async route => {
    const request = route.request();
    let url;
    try { url = new URL(request.url()); } catch { return route.abort(); }
    if (url.origin === 'http://127.0.0.1:4173') return route.continue();
    const publicAssets = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'];
    if (request.method() === 'GET' && url.protocol === 'https:' && publicAssets.includes(url.hostname)) return route.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    const send = (body, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    if (url.pathname === '/auth/me') return send({ ...user, tenant, memberships: [tenant] });
    if (url.pathname === '/auth/me/permissions') return send({ permissionCodes: grants });
    if (url.pathname === '/procurement/suppliers' && request.method() === 'GET') {
      if (listFailure) return send({ statusCode: 500, error: 'INTERNAL_ERROR' }, 500);
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const status = url.searchParams.get('status');
      return send({ items: rows.filter(row => (!search || row.displayName.toLowerCase().includes(search)) && (status === 'ALL' || row.status === status)), nextCursor: null });
    }
    if (url.pathname === '/procurement/suppliers' && request.method() === 'POST') {
      const body = request.postDataJSON();
      const row = { ...body, id: '22222222-2222-4222-8222-' + String(rows.length).padStart(12, '0'), version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
      writes.push({ method: 'POST', body, keyPresent: Boolean(request.headers()['idempotency-key']) }); rows.push(row);
      return send(row, 201);
    }
    const row = rows.find(item => url.pathname === '/procurement/suppliers/' + item.id);
    if (row && request.method() === 'GET') return send(row);
    if (row && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      if (body.expectedVersion !== row.version) return send({ statusCode: 409, error: 'SUPPLIER_VERSION_CONFLICT' }, 409);
      Object.assign(row, body.changes, { version: row.version + 1 });
      writes.push({ method: 'PATCH', body, keyPresent: Boolean(request.headers()['idempotency-key']) });
      return send(row);
    }
    blockedAssets.push(url.pathname);
    return route.abort();
  });
  async function settleDialog() {
    const dialog = p.getByRole('dialog');
    await dialog.waitFor();
    await dialog.evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))); });
    await p.waitForFunction(() => { const element = document.querySelector('[role="dialog"]'); if (!element) return false; const r = element.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; });
    return dialog;
  }
  const results = [];
  try {
    await p.goto('http://127.0.0.1:4173/procurement/suppliers');
    await p.getByRole('heading', { name: 'Proveedores', exact: true }).waitFor();
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      await p.setViewportSize({ width, height: 900 });
      await p.evaluate(theme => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.colorScheme = theme; }, theme);
      await p.getByRole('button', { name: rows[0].displayName, exact: true }).waitFor();
      await p.evaluate(() => document.fonts.ready);
      if (width === 390) {
        await p.getByRole('button', { name: 'Filtros', exact: true }).click();
        const filters = await settleDialog();
        await filters.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('ALL');
        await p.screenshot({ path: 'odd/evidence/procurement-suppliers/filters-' + width + '-' + theme + '.png', fullPage: true, animations: 'disabled' });
        await filters.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('ACTIVE');
        await filters.getByRole('button', { name: 'Cerrar', exact: true }).click();
        await filters.waitFor({ state: 'hidden' });
        await p.getByRole('button', { name: rows[0].displayName, exact: true }).waitFor();
      }
      await p.screenshot({ path: 'odd/evidence/procurement-suppliers/list-' + width + '-' + theme + '.png', fullPage: true, animations: 'disabled' });
      const beforeCancel = writes.length;
      await p.getByRole('button', { name: 'Crear proveedor', exact: true }).click();
      let dialog = await settleDialog();
      await p.getByLabel('Nombre del proveedor').fill('Proveedor de prueba ' + width + ' ' + theme);
      await p.getByLabel('Condiciones acordadas').fill('Cotización declarada, sin movimientos de inventario.');
      await p.screenshot({ path: 'odd/evidence/procurement-suppliers/form-' + width + '-' + theme + '.png', fullPage: true, animations: 'disabled' });
      const bounds = await dialog.boundingBox();
      const geometry = await p.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
      if (geometry.scroll > width || !bounds || bounds.x < -1 || bounds.x + bounds.width > width + 1) throw new Error('Overflow ' + width + ' ' + theme);
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      if (writes.length !== beforeCancel) throw new Error('Cancel wrote');
      await p.getByRole('button', { name: 'Crear proveedor', exact: true }).click();
      dialog = await settleDialog();
      if (await p.getByLabel('Nombre del proveedor').inputValue() !== '') throw new Error('Reopen retained abandoned buffer');
      await p.getByLabel('Nombre del proveedor').fill('Proveedor ' + width + ' ' + theme);
      await dialog.getByRole('button', { name: 'Crear proveedor', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await p.getByText('Proveedor guardado correctamente.', { exact: true }).waitFor();
      await p.getByRole('button', { name: 'Archivar ' + rows[0].displayName, exact: true }).click();
      dialog = await settleDialog();
      await p.screenshot({ path: 'odd/evidence/procurement-suppliers/archive-' + width + '-' + theme + '.png', fullPage: true, animations: 'disabled' });
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      results.push({ width, theme, bounds, geometry, cancelPreserved: true, reopenCleared: true, fixtureCreate: true });
    }
    // Exercise actual overlays with keyboard focus, CAS recovery and state changes.
    await p.getByRole('button', { name: rows[0].displayName, exact: true }).focus();
    await p.keyboard.press('Enter');
    let dialog = await settleDialog();
    for (let tab = 0; tab < 8; tab++) {
      await p.keyboard.press('Tab');
      if (!await dialog.evaluate(element => element.contains(document.activeElement))) throw new Error('Focus escaped dialog');
    }
    await p.getByLabel('Nombre del proveedor').fill('Cambio local preservado');
    rows[0].version++;
    const beforeConflict = writes.length;
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await p.getByText('El proveedor cambió en otra sesión.', { exact: false }).waitFor();
    if (await p.getByLabel('Nombre del proveedor').inputValue() !== 'Cambio local preservado' || writes.length !== beforeConflict) throw new Error('Conflict lost local buffer or mutated fixture');
    await dialog.getByRole('button', { name: 'Descartar cambios locales y cargar versión actual', exact: true }).click();
    await p.waitForFunction(name => document.querySelector('#supplier-name')?.value === name, rows[0].displayName);
    if (await p.getByText('El proveedor cambió en otra sesión.', { exact: false }).count()) throw new Error('Conflict feedback remained after explicit reload');
    await p.getByLabel('Condiciones acordadas').fill('');
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await p.getByText('Proveedor guardado correctamente.', { exact: true }).waitFor();
    if (rows[0].termsText !== null) throw new Error('Explicit clear did not send null');
    await p.getByRole('button', { name: 'Archivar ' + rows[0].displayName, exact: true }).click();
    dialog = await settleDialog();
    await dialog.getByRole('button', { name: 'Archivar', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await p.getByRole('button', { name: rows[0].displayName, exact: true }).waitFor({ state: 'hidden' });
    await p.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('ARCHIVED');
    await p.getByRole('button', { name: 'Reactivar ' + rows[0].displayName, exact: true }).click();
    dialog = await settleDialog();
    await dialog.getByRole('button', { name: 'Reactivar', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await p.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('ACTIVE');
    await p.getByRole('button', { name: rows[0].displayName, exact: true }).waitFor();
    await p.getByPlaceholder('Buscar proveedor...', { exact: true }).fill('ninguna-coincidencia');
    await p.getByText('No hay proveedores para esta búsqueda.', { exact: true }).waitFor();
    await p.getByPlaceholder('Buscar proveedor...', { exact: true }).fill('');
    await p.getByRole('button', { name: rows[0].displayName, exact: true }).waitFor();
    listFailure = true;
    await p.getByTestId('refresh-suppliers').click();
    await p.getByText('No se pudieron cargar los proveedores. Puedes volver a actualizar.', { exact: true }).waitFor();
    listFailure = false;
    await p.getByTestId('refresh-suppliers').click();
    await p.getByRole('button', { name: rows[0].displayName, exact: true }).waitFor();
    if (writes.length !== 7 || writes.some(write => !write.keyPresent)) throw new Error('Unexpected writes or missing key');
    if (errors.length) throw new Error('Runtime errors: ' + errors.join('; '));
    return { results, keyboardFocusTrap: true, conflictPreserved: true, explicitReload: true, nullClear: true, archiveReactivate: true, emptySearch: true, failedReadRecovery: true, errors, writes, blockedAssets, realBackendRequests: 0 };
  } finally { await context.close(); }
}
