async (page) => {
  // Authenticated UI check: open/cancel only; never submit product or price data.
  const results = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await page.goto('http://localhost:4173/pos/products/feedfd3f-07d9-4a77-a805-289203624c8e');
      await page.getByRole('button', { name: 'Presentaciones', exact: true }).click();
      if (!(await page.locator('html').getAttribute('class')).split(' ').includes(theme)) {
        await page.getByRole('button', { name: theme === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Agregar Lista de Precios', exact: true }).click();
      const submit = page.getByRole('button', { name: 'Crear lista', exact: true });
      await submit.waitFor();
      await page.getByRole('dialog').evaluate(async element => {
        await Promise.all(element.getAnimations().map(animation => animation.finished));
      });
      const paint = await submit.evaluate(element => {
        const style = getComputedStyle(element);
        const rgb = value => {
          const hex = value.trim().replace('#', '');
          return `rgb(${[0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
        };
        return { background: style.backgroundColor, foreground: style.color,
          expectedBackground: rgb(style.getPropertyValue('--hf-action')),
          expectedForeground: rgb(style.getPropertyValue('--hf-on-action')),
          height: element.getBoundingClientRect().height };
      });
      if (paint.background !== paint.expectedBackground || paint.foreground !== paint.expectedForeground || paint.height < 44) {
        throw new Error('Pricing action pairing mismatch: ' + JSON.stringify(paint));
      }
      await page.screenshot({ path: `odd/evidence/hf-ui-complete-audit/pricing-action-${width}-${theme}.png` });
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.goto('http://localhost:4173/pos/products');
      await page.getByRole('button', { name: 'Nuevo Producto', exact: true }).click();
      const link = page.getByRole('button', { name: 'ir al editor completo', exact: true });
      await link.waitFor();
      await link.focus();
      const focus = await link.evaluate(element => ({ height: element.getBoundingClientRect().height, outline: getComputedStyle(element).outlineWidth }));
      if (focus.height < 44 || parseFloat(focus.outline) < 2) throw new Error('Full-editor link target/focus: ' + JSON.stringify(focus));
      await link.click();
      await page.waitForURL('**/pos/products/new');
      results.push({ width, theme, paint, focus, navigation: page.url() });
    }
  }
  return results;
}
