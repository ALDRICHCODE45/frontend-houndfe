async (page) => {
  // Read identity metadata only. Never read, copy or serialize authentication tokens.
  const identity = await page.evaluate(() => {
    try {
      return {
        userId: JSON.parse(localStorage.getItem('hound.auth.user') || 'null')?.id,
        tenantId: JSON.parse(localStorage.getItem('hound.auth.currentTenant') || 'null')?.id,
      };
    } catch {
      throw new Error('Invalid current user/tenant metadata; fixture not started');
    }
  });
  if (!identity.userId || !identity.tenantId) throw new Error('Current user/tenant metadata required');
  const fixture = await page.context().newPage();
  const session = {
    id: '55555555-5555-4555-8555-555555555555',
    tenantId: identity.tenantId, registerId: '44444444-4444-4444-8444-444444444444',
    status: 'SUBMITTED', cashierUserId: identity.userId, openingCents: 0,
    frozenAt: '2026-10-07T18:30:00.000Z', drawerReleasedAt: null, blind: false,
  };
  let mutationAttempts = 0;
  const results = [];
  try {
    await fixture.route('http://localhost:3000/**', async route => {
      const request = route.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !request.url().endsWith('/auth/refresh')) {
        mutationAttempts++;
        return route.abort();
      }
      const url = new URL(request.url());
      let json;
      if (url.pathname === '/cash-sessions') json = { items: [session], page: 1, limit: 25, total: 1 };
      else if (url.pathname === '/cash-sessions/' + session.id) json = {
        session, register: null, movements: [], counts: [], handovers: [], closing: null, channelSnapshot: null,
      };
      else if (url.pathname === '/users/assignable') json = [{ id: '66666666-6666-4666-8666-666666666666', name: 'Persona de prueba' }];
      if (json !== undefined) return route.fulfill({ status: 200, contentType: 'application/json', json });
      await route.continue();
    });
    await fixture.goto('http://localhost:4173/pos/caja');
    await fixture.locator('[data-testid=cash-workspace-task-historial]').click();
    await fixture.locator('[data-testid="cash-session-open-' + session.id + '"]').click();
    await fixture.locator('[data-testid=cash-workspace-task-custodia]').click();
    for (const width of [390, 1440]) {
      await fixture.setViewportSize({ width, height: 1000 });
      for (const theme of ['light', 'dark']) {
        if (!(await fixture.locator('html').getAttribute('class')).split(' ').includes(theme)) {
          await fixture.getByRole('button', { name: theme === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', exact: true }).click();
        }
        const trigger = fixture.locator('[data-testid=cash-handover-recipient-select]');
        if (await fixture.getByRole('button', { name: 'Persona destinataria', exact: true }).count() !== 1) {
          throw new Error('Recipient control has no field-associated accessible name');
        }
        await trigger.click();
        const option = fixture.getByRole('option', { name: 'Persona de prueba', exact: true });
        await option.waitFor();
        const list = fixture.getByRole('listbox');
        await list.evaluate(async element => {
          await Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished));
          await Promise.allSettled(element.parentElement.getAnimations().map(animation => animation.finished));
        });
        const evidence = await list.evaluate(e => ({
          background: getComputedStyle(e).backgroundColor,
          surface: getComputedStyle(e).getPropertyValue('--hf-surface').trim(),
          width: e.getBoundingClientRect().width,
          x: e.getBoundingClientRect().x,
        }));
        if (evidence.x < 0 || evidence.x + evidence.width > width + 1) throw new Error('Recipient popup exceeds viewport');
        await fixture.screenshot({ path: `odd/evidence/hf-ui-complete-audit/cash-recipient-fixture-${width}-${theme}.png` });
        await fixture.keyboard.press('ArrowDown');
        await fixture.keyboard.press('Enter');
        await list.waitFor({ state: 'hidden' });
        if (!(await trigger.innerText()).includes('Persona de prueba')) throw new Error('Keyboard selection failed');
        await trigger.click();
        await list.waitFor();
        await fixture.keyboard.press('Escape');
        await list.waitFor({ state: 'hidden' });
        if (!(await trigger.evaluate(element => document.activeElement === element))) throw new Error('Escape did not restore trigger focus');
        results.push({ width, theme, evidence });
      }
    }
    if (mutationAttempts) throw new Error('Unexpected blocked mutation');
    return { fixture: true, mutationAttempts, results };
  } finally { await fixture.close(); }
}
