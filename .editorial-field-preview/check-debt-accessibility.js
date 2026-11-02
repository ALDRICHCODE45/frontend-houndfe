async (page) => {
  // UI-only debt fixture: no persisted debt or payment is created.
  const fixture = await page.context().newPage();
  const blocked = [];
  const results = [];
  let mockedReads = 0;
  try {
    await fixture.route('http://localhost:3000/**', async route => {
      const request = route.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !request.url().endsWith('/auth/refresh')) {
        blocked.push(request.method());
        return route.abort();
      }
      await route.continue();
    });
    await fixture.route('http://localhost:3000/sales/84949bb3-3819-4d01-a24b-f5d9b464b9a0', async route => {
      if (route.request().method() !== 'GET') {
        blocked.push(route.request().method());
        return route.abort();
      }
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      const sale = await response.json();
      mockedReads++;
      await route.fulfill({ response, json: { ...sale, paymentStatus: 'PARTIAL', paidCents: 0, debtCents: sale.totalCents } });
    });
    await fixture.goto('http://localhost:4173/pos/ventas/84949bb3-3819-4d01-a24b-f5d9b464b9a0');
    for (const width of [390, 1440]) {
      await fixture.setViewportSize({ width, height: 1000 });
      for (const theme of ['light', 'dark']) {
        if (!(await fixture.locator('html').getAttribute('class')).split(' ').includes(theme)) {
          await fixture.getByRole('button', { name: theme === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', exact: true }).click();
        }
        await fixture.getByRole('button', { name: /Registrar pago/i }).last().click();
        const dialog = fixture.getByRole('dialog', { name: 'Cobrar deuda', exact: true });
        await dialog.waitFor();
        const description = await dialog.evaluate(e => document.getElementById(e.getAttribute('aria-describedby'))?.textContent.trim());
        if (description !== 'Selecciona los métodos de pago') throw new Error('Description association missing');
        const cash = dialog.locator('[data-testid=payment-method-tile-cash]');
        if (await cash.getAttribute('aria-pressed') !== 'false') throw new Error('Incorrect initial tile state');
        await cash.click();
        if (await cash.getAttribute('aria-pressed') !== 'true') throw new Error('Selection not announced');
        await dialog.getByRole('button', { name: 'Eliminar pago 1', exact: true }).click();
        if (await cash.getAttribute('aria-pressed') !== 'false') throw new Error('Removal not announced');
        await dialog.evaluate(async e => await Promise.allSettled(e.getAnimations().map(a => a.finished)));
        const bounds = await dialog.boundingBox();
        if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width + 1) throw new Error('Dialog overflow');
        await fixture.screenshot({ path: `odd/evidence/hf-ui-complete-audit/debt-fixture-${width}-${theme}.png` });
        await dialog.getByRole('button', { name: 'Cerrar cobro de deuda', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        results.push({ width, theme, description, bounds });
      }
    }
    if (!mockedReads || blocked.length) throw new Error('Unexpected fixture reads or mutation attempt');
    return { fixture: true, mockedReads, mutationAttempts: blocked.length, results };
  } finally {
    await fixture.close();
  }
}
