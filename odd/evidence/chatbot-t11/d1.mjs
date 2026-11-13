// T11 items 1, 2, 4, 8 + part of 3 (S-000020/21/22 detail + reschedule sheet). Read-only: opens/closes sheets, never confirms.
import { open, shot, BASE, blocked, IDS, settle, iconSizes } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const mobile = w < 500
const { browser, page, log } = await open({ width: w, height: mobile ? 844 : 900 })
for (const key of ['s20', 's21', 's22']) {
  await page.goto(`${BASE}/chatbot/solicitudes/${IDS[key]}`, { waitUntil: 'domcontentloaded' }); await settle(page)
  console.log(`\n=== ${key} @${w}`)
  console.log('BODY', (await page.locator('main').first().innerText().catch(() => page.locator('body').innerText())).replace(/\n+/g, ' | ').slice(0, 1800))
  await shot(page, `d1-${key}-detail-${w}`); await shot(page, `d1-${key}-detail-${w}-full`, true)
  // Atender buttons (all, incl. the mobile bar)
  const at = await page.getByRole('button', { name: /Atender/ }).evaluateAll((els) => els.map((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return { t: e.innerText.trim().replace(/\s+/g, ' '), vis: b.width > 0, disabled: e.disabled, aria: e.getAttribute('aria-disabled'), opacity: cs.opacity, cursor: cs.cursor, bg: cs.backgroundColor, color: cs.color, filter: cs.filter, pe: cs.pointerEvents } }))
  console.log('ATENDER', JSON.stringify(at))
  const dd = page.getByText(/Disponible desde/)
  console.log('DISPONIBLE', JSON.stringify(await dd.evaluateAll((els) => els.map((e) => ({ t: e.innerText.trim().replace(/\s+/g, ' '), vis: e.getBoundingClientRect().width > 0 })))))
  const chip = page.getByTestId('schedule-chip')
  if (await chip.count()) { console.log('CHIP', await chip.evaluate((e) => { const cs = getComputedStyle(e); return { t: e.innerText.trim(), fs: cs.fontSize, color: cs.color, bg: cs.backgroundColor, w: e.getBoundingClientRect().width } })); await chip.scrollIntoViewIfNeeded(); await chip.screenshot({ path: `${process.cwd()}/shots/d1-${key}-chip-${w}.png` }) }
  const rn = page.getByTestId('reschedule-needed')
  console.log('rd-alert count', await page.locator('.rd-alert').count(), 'icons', JSON.stringify(await iconSizes(page, '.rd-alert')))
  const rs = page.getByRole('button', { name: /Reagendar/ })
  console.log('reagendar btns', await rs.count())
  if (await rs.count()) {
    await rs.first().click(); await settle(page, 2500)
    await shot(page, `d1-${key}-resched-open-${w}`)
    const dlg = page.locator('[role=dialog]').last()
    console.log('SHEET', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 1500))
    const hint = page.locator('.rc-hint--warn, .rc-hint--info')
    console.log('HINT', JSON.stringify(await hint.evaluateAll((els) => els.map((e) => { const cs = getComputedStyle(e); const ic = e.querySelector('svg, [class*="i-"]'); const ib = ic?.getBoundingClientRect(); const tb = (e.querySelector('span:not([class*="i-"]), p') ?? e).getBoundingClientRect(); return { cls: e.className, t: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 200), bg: cs.backgroundColor, color: cs.color, border: cs.borderColor, display: cs.display, icon: ib && { w: ib.width, h: ib.height, top: ib.top, left: ib.left }, hint: e.getBoundingClientRect().toJSON?.() ?? null, lines: Math.round(e.getBoundingClientRect().height / parseFloat(cs.lineHeight || 20)) } }))))
    console.log('sheet icons', JSON.stringify(await iconSizes(page, '[role=dialog] .rc-hint--warn, [role=dialog] .rc-hint--info, [role=dialog] .rc-note')))
    const radios = page.getByRole('radio'); const n = await radios.count(); console.log('radios', n)
    if (n) { await radios.nth(n - 1).click({ force: true }); await page.waitForTimeout(700); await shot(page, `d1-${key}-resched-pickN-${w}`); console.log('PICK LAST', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(-900))
      console.log('HINT after pick', JSON.stringify(await page.locator('.rc-hint--warn, .rc-hint--info').evaluateAll((els) => els.map((e) => ({ cls: e.className, t: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 220) }))))) }
    await radios.first().click({ force: true }).catch(() => {}); await page.waitForTimeout(500)
    await shot(page, `d1-${key}-resched-pick1-${w}`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(700)
    console.log('dialogs left', await page.locator('[role=dialog]').count())
  }
}
console.log('\nBLOCKED non-GET (must be empty):', blocked)
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
