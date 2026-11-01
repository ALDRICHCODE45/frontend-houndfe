async (page) => {
  // Run with Playwright MCP against an already authenticated development page.
  // This check opens controls only: no date selection or persisted mutations.
  await page.goto('http://localhost:4173/pos/cotizaciones');
  const results = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      if (!(await page.locator('html').getAttribute('class')).split(' ').includes(theme)) {
        await page.getByRole('button', {
          name: theme === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', exact: true,
        }).click();
      }
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await page.locator('[data-testid=date-range-trigger]').first().click();
      const popup = page.getByRole('dialog', { name: 'Seleccionar fechas', exact: true });
      await popup.waitFor();
      await popup.evaluate(async element => {
        await Promise.all(element.getAnimations().map(animation => animation.finished));
      });
      const bounds = await popup.boundingBox();
      if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width + 1) {
        throw new Error('Date popup exceeds viewport: ' + JSON.stringify({ width, theme, bounds }));
      }
      const calendar = await popup.locator('[data-testid=date-range-calendar]').boundingBox();
      if (!calendar || calendar.x < bounds.x || calendar.x + calendar.width > bounds.x + bounds.width + 1) {
        throw new Error('Calendar escapes popup: ' + JSON.stringify({ bounds, calendar }));
      }
      const screenshot = `odd/evidence/hf-ui-complete-audit/date-fixed-${width}-${theme}.png`;
      await page.screenshot({ path: screenshot });
      await page.keyboard.press('Escape');
      await popup.waitFor({ state: 'hidden' });
      if (!(await page.getByRole('dialog').isVisible())) throw new Error('Nested Escape closed the parent');
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      results.push({ width, theme, bounds, calendar, screenshot });
    }
  }
  return results;
}
