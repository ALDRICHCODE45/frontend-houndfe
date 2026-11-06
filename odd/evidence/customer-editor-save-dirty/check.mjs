// Live check: «Guardar cambios» disabled on open → enabled after typing → disabled after undo.
// Never saves. Password read from the backend seed at runtime and never printed.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const OUT = new URL('.', import.meta.url).pathname
const BASE = 'http://127.0.0.1:5173'
const seed = readFileSync(new URL('../../../../houndfe-backend/prisma/seed.ts', import.meta.url), 'utf8')
const manager = seed.slice(seed.indexOf("email: 'manager@houndfe.com'"))
const password = manager.match(/password:\s*'([^']+)'/)[1]
const NAMES = ['Carmen Prueba Ubicación', 'Irene Domínguez Ochoa']

const browser = await chromium.launch()
const nonGet = []
const results = []
for (const theme of ['light', 'dark']) {
  for (const width of [1440, 390]) {
    const view = `${theme}-${width}`
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } })
    await ctx.addInitScript((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
    const page = await ctx.newPage()
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.method() !== 'OPTIONS') {
        const path = URL.canParse(r.url()) ? new URL(r.url()).pathname : r.url()
        if (!path.includes('/auth/')) nonGet.push(`${view} ${r.method()} ${path}`)
      }
    })
    try {
      await page.goto(`${BASE}/login`)
      await page.fill('#email', 'manager@houndfe.com')
      await page.fill('#password', password)
      await page.locator('button[type="submit"]').click()
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })
      if (page.url().includes('/select-tenant')) {
        await page.getByText('Sucursal Centro').first().click()
        await page.waitForURL((u) => !u.pathname.includes('/select-tenant'), { timeout: 15000 })
      }
      await page.goto(`${BASE}/pos/customers`)
      const search = page.getByPlaceholder('Buscar clientes...').first()
      let name = null
      for (const candidate of NAMES) {
        await search.fill(candidate)
        const hit = page.getByText(candidate, { exact: true }).first()
        if (await hit.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
          name = candidate
          await hit.click()
          break
        }
      }
      if (!name) throw new Error('no candidate customer found')
      const dialog = page.getByRole('dialog').filter({ hasText: 'Editar cliente' })
      const save = dialog.getByRole('button', { name: 'Guardar cambios' })
      await save.waitFor()
      const lastName = dialog.getByPlaceholder('Ej: Pérez')
      await page.waitForTimeout(400)
      const s1 = await save.isDisabled()
      await page.screenshot({ path: `${OUT}${view}-1-open-disabled.png` })
      const original = await lastName.inputValue()
      await lastName.click()
      await lastName.press('End')
      await lastName.pressSequentially(' X')
      const s2 = await save.isDisabled()
      await page.waitForTimeout(400)
      const enabledStyle = await save.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { bg: cs.backgroundColor, color: cs.color, cursor: cs.cursor }
      })
      await page.screenshot({ path: `${OUT}${view}-2-edited-enabled.png` })
      await lastName.press('Backspace')
      await lastName.press('Backspace')
      const s3 = await save.isDisabled()
      await page.waitForTimeout(400)
      const restored = (await lastName.inputValue()) === original
      await page.screenshot({ path: `${OUT}${view}-3-undone-disabled.png` })
      const style = await save.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor, opacity: cs.opacity, cursor: cs.cursor }
      })
      results.push({ view, name, openDisabled: s1, editedEnabled: !s2, undoneDisabled: s3, restored, style, enabledStyle })
      await dialog.getByRole('button', { name: 'Cancelar' }).click()
    } catch (error) {
      results.push({ view, error: String(error).slice(0, 300) })
      await page.screenshot({ path: `${OUT}${view}-error.png` }).catch(() => {})
    }
    await ctx.close()
  }
}
await browser.close()
console.log(JSON.stringify({ results, nonGet }, null, 2))
