async (page) => {
  // Existing authenticated development session; change local fields, cancel, never save.
  if (await page.getByRole('combobox').count()) await page.getByRole('combobox').press('Escape');
  if (await page.getByRole('dialog').count()) await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  const results = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      if (!(await page.locator('html').getAttribute('class')).split(' ').includes(theme)) {
        await page.getByRole('button', { name: theme === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Nuevo Producto', exact: true }).click();
      const dialog = page.getByRole('dialog');
      for (const family of ['category-select', 'sat-select']) {
        const root = dialog.locator('.' + family).first();
        const trigger = root.locator('button[aria-haspopup=listbox]');
        await trigger.click();
        const input = root.getByRole('combobox');
        await input.fill(family === 'category-select' ? 'Acuario' : 'alimento');
        const options = root.getByRole('option');
        if (family === 'category-select') await options.filter({ hasText: 'Acuario' }).waitFor();
        else await options.first().waitFor();
        await input.press('ArrowDown');
        // The create action intentionally stays first after category filtering.
        if (family === 'category-select') await input.press('ArrowDown');
        const id = await input.getAttribute('aria-activedescendant');
        const active = await page.locator('[id="' + id + '"]').innerText();
        if (active.includes('Crear')) throw new Error('Harness selected create action');
        // Vue can cancel animation objects during reactive updates; wait for rendered opacity instead.
        await page.waitForFunction(() => {
          const menu = document.querySelector('.hf-select-menu');
          return menu && getComputedStyle(menu).opacity === '1';
        });
        const box = await root.locator('.hf-select-menu').boundingBox();
        if (!box || box.x < 0 || box.x + box.width > width + 1) throw new Error('Menu overflow');
        if (family === 'sat-select' && box.width < (width === 390 ? 300 : 350)) {
          throw new Error('SAT descriptions remain confined to a half-width field');
        }
        await page.screenshot({ path: `odd/evidence/hf-ui-complete-audit/slideover-${family}-${width}-${theme}.png` });
        await input.press('Enter');
        if (await trigger.getAttribute('aria-expanded') !== 'false' || !(await trigger.evaluate(e => document.activeElement === e))) {
          throw new Error('Selection/focus failed');
        }
        await trigger.click();
        await root.getByRole('combobox').press('Escape');
        if (!(await dialog.isVisible())) throw new Error('Nested Escape closed parent');
        if (family === 'sat-select') {
          await root.getByRole('button', { name: 'Limpiar', exact: true }).click();
          if ((await trigger.innerText()).trim() !== 'Buscar clave SAT...') throw new Error('Clear failed');
        }
        results.push({ width, theme, family, active, box });
      }
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
  }
  return results;
}
