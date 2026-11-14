import { open, load, shot } from './lib.mjs'
import { installMock } from './mock.mjs'
import { snapFn } from './snap.mjs'
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const { browser, page, errors } = await open(w, h)
  await installMock(page.context())
  await load(page)
  const S = async (label) => { const s = await page.evaluate(snapFn); console.log(`${label}@${w}`, JSON.stringify({ url: s.search, pressed: s.chips.filter((c) => c.p === 'true').map((c) => c.name), heading: s.heading, active: s.activeChips, doc: s.docOverflow })) }
  const chip = (n) => page.locator('.catalog-animal-chip', { has: page.locator('.catalog-animal-name', { hasText: new RegExp(`^${n}$`) }) })
  await chip('Gato').click(); await page.waitForTimeout(700)
  await chip('Perro').click(); await page.waitForTimeout(700)
  await S('a-gato+perro'); await shot(page, `s5-two-groups-${w}.png`)
  await page.getByRole('button', { name: 'Quitar filtro: Gato' }).click(); await page.waitForTimeout(700)
  await S('b-quitar-gato')
  // sidebar category
  if (w >= 1000) await page.getByText('Alimento para perro', { exact: true }).first().click()
  else { await page.getByRole('button', { name: /Filtros/ }).first().click(); await page.waitForTimeout(600); await page.getByText('Alimento para perro', { exact: true }).last().click(); await page.waitForTimeout(300); await page.getByRole('button', { name: /^Ver \d+ producto/ }).click() }
  await page.waitForTimeout(800); await S('c-sidebar-category'); await shot(page, `s5-sidebar-category-${w}.png`)
  const limpiar = page.getByRole('button', { name: /Limpiar todo/ }); console.log('limpiar count', await limpiar.count())
  await limpiar.first().click(); await page.waitForTimeout(800)
  await S('d-limpiar-todo'); await shot(page, `s5-limpiar-${w}.png`)
  // sidebar category toggle off
  console.log('errors', errors.filter((e) => !e.includes('/branch') && !e.includes('404 (Not Found)')))
  await browser.close()
}
