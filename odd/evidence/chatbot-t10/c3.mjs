// Mobile (390) reschedule flows for S-000020/21/22 + client-side validation. Nothing is confirmed.
import { open, shot, BASE, blocked, IDS } from './lib.mjs'
const { browser, page, log } = await open({ width: 390, height: 844 })
for (const key of ['s20', 's21', 's22']) {
  await page.goto(`${BASE}/chatbot/solicitudes/${IDS[key]}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await shot(page, `c3-${key}-detail-390`); await shot(page, `c3-${key}-detail-390-full`, true)
  console.log(key, 'overflow-x:', await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
  await page.getByRole('button', { name: /Acciones \(/ }).click(); await page.waitForTimeout(800)
  await shot(page, `c3-${key}-actions-390`)
  const names = ['Cancelar solicitud…', 'Reagendar…', 'Atender']
  for (const nm of names) { const b = page.getByRole('button', { name: nm, exact: true }).last(); console.log(key, 'ACTION', nm, 'count', await page.getByRole('button', { name: nm, exact: true }).count(), 'disabled', await b.isDisabled().catch(() => 'n/a')) }
  console.log(key, 'HINT', await page.getByText(/Disponible desde/).allInnerTexts())
  await page.getByRole('button', { name: 'Reagendar…', exact: true }).last().click(); await page.waitForTimeout(2000)
  await shot(page, `c3-${key}-resched-390`)
  // submit without a choice → client-side validation only
  const before = blocked.length
  await page.getByRole('button', { name: 'Reagendar', exact: true }).last().click(); await page.waitForTimeout(600)
  console.log(key, 'VALIDATION', (await page.locator('[role=dialog]').last().innerText()).match(/Elige la nueva hora\./)?.[0] ?? 'NO MESSAGE', '| POST attempts:', blocked.length - before)
  await shot(page, `c3-${key}-resched-validation-390`)
  const radios = page.getByRole('radio'); const n = await radios.count()
  await radios.nth(n - 1).click({ force: true }); await page.waitForTimeout(500)
  await page.getByRole('radio').last().scrollIntoViewIfNeeded()
  await page.locator('[data-testid=reschedule-notice]').scrollIntoViewIfNeeded()
  await shot(page, `c3-${key}-resched-picked-390`)
  console.log(key, 'NOTICE', await page.locator('[data-testid=reschedule-notice]').innerText())
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  console.log(key, 'dialogs left', await page.locator('[role=dialog]').count())
}
console.log('REQ non-GET attempted:', blocked)
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
