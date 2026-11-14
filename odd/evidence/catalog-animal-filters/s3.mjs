import { open, load, shot } from './lib.mjs'
import { installMock, CONTROL } from './mock.mjs'
import { snapFn } from './snap.mjs'
const patch = process.env.PATCH === '1'
const sfx = patch ? '-patched' : ''
for (const [w, h] of (process.env.ONLY === '390' ? [[390, 844]] : [[1440, 900], [390, 844]])) {
  const { browser, page, errors } = await open(w, h)
  await installMock(page.context())
  await load(page)
  if (patch) await page.addStyleTag({ content: `body .catalog-animal{grid-template-columns:minmax(0,1fr)!important}` })
  const S = async (label) => { const s = await page.evaluate(snapFn); console.log(`${label}@${w}`, JSON.stringify({ url: s.search, allPressed: s.chips.find((c) => c.name === 'Todos')?.p, pressedChips: s.chips.filter((c) => c.p === 'true').map((c) => c.name), heading: s.heading, activeChips: s.activeChips, doc: s.docOverflow })); return s }
  await S('0-default')
  // category via sidebar (desktop) or filter sheet (phone)
  if (w >= 1000) {
    await page.getByRole('button', { name: /Ver más \(\d+\)/ }).first().click()
    await page.waitForTimeout(300)
    await page.getByText('Control de desechos', { exact: true }).first().click()
  } else {
    await page.getByRole('button', { name: /Filtros/ }).first().click(); await page.waitForTimeout(600)
    await shot(page, `s3-sheet-open-${w}.png`)
    const more = page.getByRole('button', { name: /Ver más \(\d+\)/ }); if (await more.count()) await more.first().click()
    await page.getByText('Control de desechos', { exact: true }).last().click(); await page.waitForTimeout(400)
    const close = page.getByRole('button', { name: /^Ver \d+ producto/ }); console.log('sheet buttons', await close.allInnerTexts())
    if (await close.count()) await close.first().click()
  }
  await page.waitForTimeout(900)
  await S('1-category-only'); await shot(page, `s3-category-only-${w}${sfx}.png`)
  // with animal filter
  await page.locator('.catalog-animal-chip', { has: page.locator('.catalog-animal-name', { hasText: /^Gato$/ }) }).click(); await page.waitForTimeout(900)
  await S('2-category+gato'); await shot(page, `s3-category-gato-${w}${sfx}.png`)
  await page.locator('.catalog-animal-chip', { has: page.locator('.catalog-animal-name', { hasText: /^Todos$/ }) }).click(); await page.waitForTimeout(900)
  await S('3-click-todos'); await shot(page, `s3-todos-clears-${w}${sfx}.png`)
  console.log('errors', errors.filter((e) => !e.includes('/branch') && !e.includes('404 (Not Found)')))
  await browser.close()
}
