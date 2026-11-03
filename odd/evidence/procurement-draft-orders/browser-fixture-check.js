async (page) => {
  // Fixture-only browser check of the built app (vite preview 4173). Every API
  // call is answered here; no backend, no credentials, nothing persisted.
  const out = 'odd/evidence/procurement-draft-orders/';
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await context.newPage();
  const tenant = { id: 'po-test-branch', name: 'Centro de prueba', slug: 'centro-prueba' };
  const user = { id: 'po-test-user', email: 'po@example.test', name: 'Prueba Compras', isActive: true, createdAt: '2026-01-01T00:00:00Z' };
  const grants = ['read:ProcurementPurchaseOrder', 'create:ProcurementPurchaseOrder', 'update:ProcurementPurchaseOrder', 'delete:ProcurementPurchaseOrder', 'read:ProcurementSupplier', 'read:Product'];
  const suppliers = [
    { id: '11111111-1111-4111-8111-111111111111', displayName: 'Distribuidora Veterinaria del Centro', termsText: null, status: 'ACTIVE', version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    { id: '11111111-1111-4111-8111-222222222222', displayName: 'Alimentos Balanceados del Norte', termsText: null, status: 'ACTIVE', version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ];
  const products = [
    { id: '55555555-5555-4555-8555-000000000001', name: 'Croquetas adulto razas medianas', type: 'PRODUCT', unit: 'KILOGRAMO', hasVariants: false, useStock: true },
    { id: '55555555-5555-4555-8555-000000000002', name: 'Collar ajustable de nylon', type: 'PRODUCT', unit: 'UNIDAD', hasVariants: true, useStock: true },
  ];
  const variants = { [products[1].id]: [{ id: '66666666-6666-4666-8666-000000000001', name: 'Chico · Azul' }, { id: '66666666-6666-4666-8666-000000000002', name: 'Mediano · Rojo' }] };
  const now = '2026-11-03T10:00:00.000Z';
  const toOrder = (id, version, input) => {
    const supplier = suppliers.find(s => s.id === input.supplierId) || (input.supplierId ? { id: input.supplierId, displayName: 'Proveedor Archivado SA', status: 'ARCHIVED' } : null);
    const issues = [];
    if (!input.supplierId) issues.push({ path: '/supplierId', code: 'SUPPLIER_REQUIRED' });
    else if (supplier.status === 'ARCHIVED') issues.push({ path: '/supplierId', code: 'SUPPLIER_ARCHIVED' });
    if (!input.lines.length) issues.push({ path: '/lines', code: 'LINES_REQUIRED' });
    input.lines.forEach((line, i) => {
      if (!line.productId) issues.push({ path: `/lines/${i}/productId`, code: 'PRODUCT_REQUIRED' });
      const product = products.find(x => x.id === line.productId);
      if (product?.hasVariants && !line.variantId) issues.push({ path: `/lines/${i}/variantId`, code: 'VARIANT_REQUIRED' });
      if (!line.orderedQuantity) issues.push({ path: `/lines/${i}/orderedQuantity`, code: 'QUANTITY_REQUIRED' });
      if (!line.informedUnitCost?.taxBasis) issues.push({ path: `/lines/${i}/informedUnitCost/taxBasis`, code: 'COST_TAX_BASIS_REQUIRED' });
    });
    return {
      ...input, id, version, status: 'DRAFT', createdAt: now, updatedAt: now,
      supplierDisplaySnapshot: supplier ? { id: supplier.id, displayName: supplier.displayName, status: supplier.status } : null,
      lineDisplaySnapshots: input.lines.map(line => {
        const product = products.find(x => x.id === line.productId)
        return { lineId: line.lineId, productName: product?.name ?? null, variantName: (variants[line.productId] || []).find(v => v.id === line.variantId)?.name ?? null, unit: product?.unit ?? null }
      }),
      lineSubtotals: input.lines.map(line => {
        const c = line.informedUnitCost
        const ok = line.orderedQuantity && c?.amount && c?.currency && c?.taxBasis
        return { lineId: line.lineId, subtotal: ok ? { amount: String(Number(line.orderedQuantity) * Number(c.amount)), currency: c.currency, taxBasis: c.taxBasis } : null }
      }),
      locationSnapshot: { tenantId: tenant.id, tenantName: tenant.name, detail: input.location.detail },
      validation: { issues },
    };
  };
  const orders = [
    toOrder('77777777-7777-4777-8777-000000000001', 3, { supplierId: suppliers[0].id, note: 'Pedido quincenal de alimento y accesorios para la sucursal centro, revisar precios antes de confirmar.', location: { detail: 'Bodega trasera' }, lines: [
      { lineId: '88888888-8888-4888-8888-000000000001', productId: products[0].id, variantId: null, orderedQuantity: '12.5', informedUnitCost: { amount: '48.9', currency: 'MXN', unit: 'KILOGRAMO', taxBasis: 'INCLUDES_TAX' } },
      { lineId: '88888888-8888-4888-8888-000000000002', productId: products[1].id, variantId: null, orderedQuantity: null, informedUnitCost: null },
    ] }),
    toOrder('77777777-7777-4777-8777-000000000002', 1, { supplierId: '11111111-1111-4111-8111-999999999999', note: null, location: { detail: null }, lines: [] }),
  ];
  const summary = o => ({ id: o.id, version: o.version, status: o.status, supplierDisplaySnapshot: o.supplierDisplaySnapshot, lineCount: o.lines.length, issueCount: o.validation.issues.length, note: o.note, locationDetail: o.location.detail, createdAt: o.createdAt, updatedAt: o.updatedAt });
  const writes = []; const errors = []; const blocked = []; const checks = []; const searches = [];
  const pick = async (dialog, trigger, option) => {
    await dialog.getByText(trigger, { exact: true }).last().click();
    await p.getByRole('option', { name: option, exact: true }).click();
  };
  const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(({ tenant, user, grants }) => {
    const payload = { sub: user.id, email: user.email, tenantId: tenant.id, tenantSlug: tenant.slug, isSuperAdmin: false, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
    const enc = x => btoa(JSON.stringify(x)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const values = { accessToken: enc({ alg: 'none', typ: 'JWT' }) + '.' + enc(payload) + '.fixture', refreshToken: 'po-fixture-refresh', user: JSON.stringify(user), permissionCodes: JSON.stringify(grants), currentTenant: JSON.stringify(tenant), memberships: JSON.stringify([tenant]), isSuperAdmin: 'false' };
    for (const [key, value] of Object.entries(values)) localStorage.setItem('hound.auth.' + key, value);
  }, { tenant, user, grants });
  await context.route('**/*', async route => {
    const request = route.request();
    let url;
    try { url = new URL(request.url()); } catch { return route.abort(); }
    if (url.origin === 'http://127.0.0.1:4173') return route.continue();
    const publicAssets = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'];
    if (request.method() === 'GET' && url.protocol === 'https:' && publicAssets.includes(url.hostname)) return route.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    const send = (body, status = 200) => route.fulfill({ status, headers, body: status === 204 ? '' : JSON.stringify(body) });
    const path = url.pathname;
    if (path === '/auth/me') return send({ ...user, tenant, memberships: [tenant] });
    if (path === '/auth/me/permissions') return send({ permissionCodes: grants });
    if (path === '/procurement/suppliers' && request.method() === 'GET') {
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      return send({ items: suppliers.filter(s => s.status === url.searchParams.get('status') && (!search || s.displayName.toLowerCase().includes(search))), nextCursor: null });
    }
    if (path === '/products' && request.method() === 'GET') {
      const search = (url.searchParams.get('search') || '').toLowerCase();
      check('product search uses server type filter', url.searchParams.get('type') === 'PRODUCT');
      return send(products.filter(x => !search || x.name.toLowerCase().includes(search)));
    }
    const variantMatch = path.match(/^\/products\/([^/]+)\/variants$/);
    if (variantMatch && request.method() === 'GET') return send(variants[variantMatch[1]] || []);
    if (path === '/procurement/purchase-orders' && request.method() === 'GET') {
      const search = url.searchParams.get('search');
      if (search !== null) searches.push(search);
      const term = (search || '').trim().toLowerCase();
      return send({ items: orders.filter(o => !term || (o.supplierDisplaySnapshot?.displayName || '').toLowerCase().includes(term) || (o.note || '').toLowerCase().includes(term)).map(summary), nextCursor: null });
    }
    if (path === '/procurement/purchase-orders' && request.method() === 'POST') {
      const body = request.postDataJSON();
      writes.push({ method: 'POST', body, key: Boolean(request.headers()['idempotency-key']) });
      const order = toOrder('77777777-7777-4777-8777-' + String(orders.length + 1).padStart(12, '0'), 1, body);
      orders.unshift(order);
      return send(order, 201);
    }
    const orderMatch = path.match(/^\/procurement\/purchase-orders\/([^/]+)(\/draft)?$/);
    const order = orderMatch && orders.find(o => o.id === orderMatch[1]);
    if (order && !orderMatch[2] && request.method() === 'GET') return send(order);
    if (order && orderMatch[2] && request.method() === 'PUT') {
      const body = request.postDataJSON();
      writes.push({ method: 'PUT', body, key: Boolean(request.headers()['idempotency-key']) });
      if (body.expectedVersion !== order.version) return send({ statusCode: 409, error: 'ORDER_VERSION_CONFLICT' }, 409);
      Object.assign(order, toOrder(order.id, order.version + 1, body.order));
      return send(order);
    }
    if (order && !orderMatch[2] && request.method() === 'DELETE') {
      const body = request.postDataJSON();
      writes.push({ method: 'DELETE', body, key: Boolean(request.headers()['idempotency-key']) });
      orders.splice(orders.indexOf(order), 1);
      return send(null, 204);
    }
    blocked.push(request.method() + ' ' + path);
    return route.abort();
  });
  const theme = async t => p.evaluate(t => { document.documentElement.classList.toggle('dark', t === 'dark'); document.documentElement.style.colorScheme = t; }, t);
  const settle = async () => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(350); };
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  try {
    await p.goto('http://127.0.0.1:4173/procurement/purchase-orders');
    await p.getByRole('heading', { name: 'Órdenes de compra', exact: true }).waitFor();
    for (const width of [390, 1440]) for (const t of ['light', 'dark']) {
      await p.setViewportSize({ width, height: 900 }); await theme(t);
      await p.getByText('Distribuidora Veterinaria del Centro').first().waitFor(); await settle();
      check(`list ${width} ${t} no horizontal overflow`, (await overflow()) <= 1, await overflow());
      await p.screenshot({ path: `${out}list-${width}-${t}.png`, fullPage: true, animations: 'disabled' });
    }
    check('archived badge visible', await p.getByText('Archivado').first().isVisible());
    // Server-side search by supplier name or note.
    await p.getByPlaceholder(/Buscar/).first().fill('quincenal');
    await p.waitForTimeout(800);
    check('table search sent to server', searches.includes('quincenal'), searches);
    check('search narrows rows', await p.getByText('Proveedor Archivado SA').count() === 0);
    await p.screenshot({ path: `${out}list-search-1440-dark.png`, fullPage: true, animations: 'disabled' });
    await p.getByPlaceholder(/Buscar/).first().fill('');
    await p.waitForTimeout(800);
    await p.getByText('Proveedor Archivado SA').first().waitFor();
    // Resume an existing draft with diagnostics.
    await p.setViewportSize({ width: 1440, height: 900 }); await theme('light');
    await p.getByRole('button', { name: 'Continuar', exact: true }).first().click();
    const dialog = p.getByRole('dialog'); await dialog.waitFor(); await settle();
    check('server subtotal shown verbatim', await dialog.getByText('Último subtotal guardado: 611.25 MXN').isVisible().catch(() => false));
    check('variant pending diagnostic shown', await dialog.getByText('Selecciona una variante del producto.').isVisible().catch(() => false));
    check('currency fixed MXN', await dialog.getByText(/Solo MXN/).first().isVisible());
    await p.screenshot({ path: `${out}editor-resume-1440-light.png`, fullPage: true, animations: 'disabled' });
    await theme('dark'); await settle();
    await p.screenshot({ path: `${out}editor-resume-1440-dark.png`, fullPage: true, animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await dialog.waitFor({ state: 'hidden' });
    // Create a new draft on mobile.
    await p.setViewportSize({ width: 390, height: 900 }); await theme('light');
    await p.getByRole('button', { name: 'Nueva orden', exact: true }).click();
    await dialog.waitFor(); await settle();
    await pick(dialog, 'Sin proveedor', suppliers[1].displayName);
    await dialog.getByRole('button', { name: 'Agregar renglón', exact: true }).click();
    await settle();
    await p.screenshot({ path: `${out}editor-product-picker-390-light.png`, fullPage: true, animations: 'disabled' });
    await pick(dialog, 'Seleccionar producto', products[0].name);
    await dialog.getByTestId('line-quantity').fill('2.5');
    await dialog.getByTestId('line-amount').fill('10.5');
    await dialog.getByTestId('line-tax').selectOption('EXCLUDES_TAX');
    await settle();
    check('editor 390 no overflow inside dialog', await dialog.evaluate(el => el.scrollWidth - el.clientWidth <= 1));
    await p.screenshot({ path: `${out}editor-new-390-light.png`, fullPage: true, animations: 'disabled' });
    await theme('dark'); await settle();
    await p.screenshot({ path: `${out}editor-new-390-dark.png`, fullPage: true, animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await p.getByText('Borrador guardado correctamente.').waitFor();
    const post = writes.find(w => w.method === 'POST');
    check('POST closed body with MXN and canonical strings', post && JSON.stringify(Object.keys(post.body).sort()) === '["lines","location","note","supplierId"]'
      && post.body.lines[0].orderedQuantity === '2.5' && post.body.lines[0].informedUnitCost.amount === '10.5'
      && post.body.lines[0].informedUnitCost.currency === 'MXN' && post.body.lines[0].informedUnitCost.unit === 'KILOGRAMO' && post.key, post?.body);
    check('subtotal after save shown', await dialog.getByText('Último subtotal guardado: 26.25 MXN').isVisible().catch(() => false));
    // Integer unit rejects a fraction locally, before sending.
    await dialog.getByRole('button', { name: 'Agregar renglón', exact: true }).click();
    await pick(dialog, 'Seleccionar producto', products[1].name);
    await dialog.getByTestId('line-quantity').last().fill('1.5');
    const before = writes.length;
    await dialog.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await settle();
    check('fraction in UNIDAD blocked locally', writes.length === before && await dialog.getByText('Escribe una cantidad positiva con el formato de esta unidad.').isVisible());
    await p.screenshot({ path: `${out}editor-local-error-390-dark.png`, fullPage: true, animations: 'disabled' });
    await dialog.getByTestId('line-quantity').last().fill('3');
    await dialog.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await settle();
    const put = writes.filter(w => w.method === 'PUT').at(-1);
    check('PUT /draft with expectedVersion 1 and new line', put && put.body.expectedVersion === 1 && put.body.order.lines.length === 2 && put.body.order.lines[1].orderedQuantity === '3', put?.body);
    p.once('dialog', d => d.accept());
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await dialog.waitFor({ state: 'hidden' }).catch(() => {});
    // Discard with confirmation.
    await p.setViewportSize({ width: 1440, height: 900 }); await theme('light'); await settle();
    await p.getByTestId('discard-order').first().click();
    const confirm = p.getByRole('dialog'); await confirm.waitFor(); await settle();
    await p.screenshot({ path: `${out}discard-confirm-1440-light.png`, fullPage: true, animations: 'disabled' });
    await theme('dark'); await settle();
    await p.screenshot({ path: `${out}discard-confirm-1440-dark.png`, fullPage: true, animations: 'disabled' });
    const count = orders.length;
    await p.getByTestId('confirm-discard').click();
    await p.getByText('Borrador descartado correctamente.').waitFor();
    check('DELETE with expectedVersion and one fewer order', orders.length === count - 1 && writes.at(-1).method === 'DELETE' && typeof writes.at(-1).body.expectedVersion === 'number');
  } catch (e) {
    check('flow completed', false, String(e.message).slice(0, 400));
    await p.screenshot({ path: `${out}failure.png`, fullPage: true }).catch(() => {});
  }
  await context.close();
  return JSON.stringify({ failed: checks.filter(c => !c.ok), passed: checks.filter(c => c.ok).length, errors, blocked, writes: writes.map(w => w.method) }, null, 1);
}
