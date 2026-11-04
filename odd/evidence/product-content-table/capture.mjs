#!/usr/bin/env node
// Runtime check of the product content table (T8, S11): the Contenido task of
// «Alimento Premium para Perro Adulto 15 kg», admin and manager, 1440x900 and 390x844,
// light and dark. The dev password is read from the backend seed at runtime and is never
// printed or written. It mutates the disposable dev DB (S8): it starts and saves an editorial draft.
// Run: node odd/evidence/product-content-table/capture.mjs [--user admin|manager] [--only a,b]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const AUTH = join(HERE, '.auth')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3000'
const SEED = process.env.CAPTURE_SEED ?? join(HERE, '../../../../houndfe-backend/prisma/seed.ts')
const USERS = { manager: { email: 'manager@houndfe.com', seedKey: 'manager' }, admin: { email: 'admin@houndfe.com', seedKey: 'superAdmin' } }
const TENANT = 'Sucursal Centro'
const PRODUCT = 'Alimento Premium para Perro Adulto 15 kg'
const VIEWPORTS = [{ name: '1440', size: { width: 1440, height: 900 } }, { name: '390', size: { width: 390, height: 844 } }]
const THEMES = ['light', 'dark']

const argv = process.argv.slice(2)
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined }
const WHO = opt('user') ?? 'admin'
if (!USERS[WHO]) throw new Error(`unknown --user ${WHO}`)
const only = opt('only')?.split(',')

mkdirSync(SHOTS, { recursive: true })
mkdirSync(AUTH, { recursive: true })
const STATE_FILE = join(AUTH, `state-${WHO}.json`)

function devPassword() {
  const re = new RegExp(`${USERS[WHO].seedKey}:\\s*\\{[^}]*?password:\\s*'([^']+)'`, 's')
  const pw = existsSync(SEED) ? readFileSync(SEED, 'utf8').match(re)?.[1] : undefined
  if (!pw) throw new Error(`${WHO} dev password not found in the backend seed`)
  return pw
}

const report = { user: WHO, product: PRODUCT, checks: {}, shots: [], consoleErrors: [], overflow: [], notes: [] }
const check = (name, pass, evidence) => { report.checks[name] = { pass: Boolean(pass), evidence }; console.log(pass ? 'PASS' : 'FAIL', name, evidence ?? '') }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: VIEWPORTS[0].size, reducedMotion: 'reduce', locale: 'es-MX', storageState: existsSync(STATE_FILE) ? STATE_FILE : undefined })
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(`${WHO}: ${m.text().slice(0, 300)}`) })
page.on('response', (r) => { if (r.status() === 401) report.unauthorized = [...(report.unauthorized ?? []), `${r.request().method()} ${pathOf(r.url())}`] })
page.on('pageerror', (e) => report.consoleErrors.push(`${WHO} pageerror: ${String(e).slice(0, 300)}`))

/** Path of a URL, '' when it does not parse. */
function pathOf(url) {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', USERS[WHO].email)
  await page.fill('#password', devPassword())
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (pathOf(page.url()) === '/select-tenant') {
    await page.getByText(TENANT, { exact: false }).first().click()
    await page.getByRole('button', { name: /continuar/i }).click()
    await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await ctx.storageState({ path: STATE_FILE })
}


let token = ''
page.on('request', (r) => { const a = r.headers()['authorization']; if (a && r.url().startsWith(API)) token = a })
async function findProductId() {
  await page.goto(`${BASE}/pos/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  const res = await fetch(`${API}/products?search=${encodeURIComponent('Alimento Premium')}&limit=50`, { headers: { authorization: token } })
  const body = await res.json()
  const list = Array.isArray(body) ? body : (body.data ?? body.items ?? [])
  const hit = list.find((p) => p.name === PRODUCT) ?? list.find((p) => String(p.name).includes('Alimento Premium para Perro Adulto'))
  if (!hit) throw new Error(`product not found (${res.status}, ${list.length} items)`)
  return hit.id
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
async function setTheme(theme) {
  await page.evaluate(([t]) => document.documentElement.classList.toggle('dark', t === 'dark'), [theme])
}
// One shot per viewport x theme of the current screen (the layout reflows live, no reload).
async function shoot(name, { fullPage = false, prep = null } = {}) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp.size)
    if (prep) await prep(vp)
    await page.waitForTimeout(250)
    for (const theme of THEMES) {
      await setTheme(theme)
      await page.waitForTimeout(150)
      const file = `${WHO}__${slug(name)}__${vp.name}__${theme}.png`
      await page.screenshot({ path: join(SHOTS, file), fullPage })
      const over = await page.evaluate(() => {
        const el = document.scrollingElement
        return el.scrollWidth > innerWidth ? { scrollWidth: el.scrollWidth, innerWidth } : null
      })
      if (over) report.overflow.push({ shot: file, ...over })
      report.shots.push(file)
    }
  }
  await page.setViewportSize(VIEWPORTS[0].size)
  await setTheme('light')
}

// The product page scrolls inside its own container; scrollIntoView would also move the overflow-hidden app shell.
const scrollInPage = (selector, offset = 8) => page.evaluate(([sel, off]) => {
  const target = document.querySelector(sel)
  const box = document.querySelector('.product-workspace > .overflow-y-auto')
  if (target && box) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top - off
}, [selector, offset])

async function openContent(id) {
  await page.goto(`${BASE}/pos/products/${id}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.product-task-button[data-task="content"]').waitFor({ timeout: 20000 })
  await page.locator('.product-task-button[data-task="content"]').click()
  await page.locator('.editorial-workspace').waitFor({ timeout: 20000 })
  await page.waitForFunction(() => !document.querySelector('[data-testid="editorial-skeleton"]'), null, { timeout: 20000 }).catch(() => {})
  // The Vue devtools badge of the dev server is not part of the screen.
  await page.addStyleTag({ content: '#vue-devtools-anchor, .vue-devtools__anchor { display: none !important }' })
  await page.waitForTimeout(500)
}

const step = async (name, fn) => {
  if (only && !only.includes(name)) return
  try { await fn() } catch (e) { report.notes.push(`${name}: ${String(e).split('\n')[0].slice(0, 300)}`); console.log('ERR', name, String(e).split('\n')[0].slice(0, 300)) }
}
const title = () => page.locator('input[id$="-title"]').first()
const footerText = () => page.locator('[data-testid="editorial-footer"] .editorial-save-state').innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null)
const counterText = () => page.locator('.editorial-completeness').innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null)

try {
  if (!existsSync(STATE_FILE)) await login()
  let id
  try { id = await findProductId() } catch { await login(); id = await findProductId() }
  report.productId = id
  let dialogAccept = true
  page.on('dialog', async (d) => { report.notes.push(`dialog(${d.type()}): ${d.message()}`); await (dialogAccept ? d.accept() : d.dismiss()) })

  if (WHO === 'admin') {
    await step('tabs', async () => {
      await openContent(id)
      const tabs = (await page.locator('.product-task-button').allInnerTexts()).map((t) => t.trim())
      check('tabs', JSON.stringify(tabs) === JSON.stringify(['Identidad', 'Presentaciones', 'Contenido', 'Inventario']) && !tabs.includes('Revisar'), tabs.join(' · '))
    })
    await step('empty', async () => {
      await openContent(id)
      // A draft left by an earlier run is discarded through the real footer action, so the empty state can be checked again.
      if (await page.getByTestId('initialize').count() === 0) {
        report.draftExistedBeforeRun = true
        await page.getByRole('button', { name: 'Más acciones de la ficha' }).click()
        await page.getByRole('menuitem', { name: /Descartar borrador/ }).click()
        await page.getByRole('button', { name: 'Descartar borrador' }).click()
        await page.getByTestId('initialize').waitFor({ timeout: 15000 })
      }
      await shoot('empty-state')
      check('empty-state', await page.getByText('Aún no hay ficha para el catálogo').isVisible(), 'Empty state with the Empezar ficha action')
      await page.getByTestId('initialize').click()
      await page.locator('#editorial-family').waitFor({ timeout: 20000 })
    })
    await step('family', async () => {
      await page.locator('#editorial-family').selectOption({ label: await page.locator('#editorial-family option').filter({ hasText: /^Alimento$/ }).first().innerText() })
      await page.locator('[data-testid="attribute-table"]').waitFor({ timeout: 10000 })
      const heads = (await page.locator('[data-testid="attribute-table"] thead th').allInnerTexts()).map((t) => t.trim())
      const rows = await page.locator('[data-testid="attribute-table"] tbody tr').count()
      const labels = (await page.locator('[data-testid="attribute-table"] tbody th[scope="row"]').allInnerTexts()).map((t) => t.trim())
      const familyLabels = (await page.locator('#editorial-family option').allInnerTexts()).map((t) => t.trim())
      report.table = { heads, rows, counter: await counterText(), labels, familyLabels }
      const codeLike = [...labels, ...familyLabels].filter((t) => /^[a-z]+([._][a-z_]+)+$/.test(t) || ['food', 'toy', 'care', 'treat', 'habitat', 'hygiene', 'accessory'].includes(t))
      check('human-labels', codeLike.length === 0, codeLike.length ? `code-like: ${codeLike.join(', ')}` : `${labels.length} row labels, e.g. ${labels.slice(0, 3).join(' / ')}; families: ${familyLabels.join(', ')}`)
      await shoot('table-family-alimento')
      await page.locator('.hf-cell').first().getByRole('button').first().click()
      await page.waitForTimeout(300)
      await shoot('cell-menu-open')
      await page.keyboard.press('Escape')
      check('table', heads.length >= 2 && rows > 0, `${heads.join(' | ')}; ${rows} rows`)
    })

    const row = (code) => page.locator(`[data-testid="attribute-table"] tr[data-row="${code}"]`)
    const openMenu = (code) => row(code).getByRole('button', { name: /^Acciones de/ }).first().click()
    await step('edit', async () => {
      const before = await counterText()
      await row('text.ingredients').locator('input[type="text"]').fill('Pollo, arroz, cebada')
      await row('pack.form').locator('select').first().selectOption({ index: 1 })
      await row('measure.net_mass').locator('input[type="text"]').fill('15')
      const unit = row('measure.net_mass').locator('select')
      if (await unit.count()) await unit.first().selectOption({ index: 1 })
      await row('animal.target').locator('summary').click()
      await row('animal.target').locator('input[type="checkbox"]').first().check()
      await page.keyboard.press('Escape')
      report.multiClosedByEscape = !(await row('animal.target').locator('details[open]').count())
      await page.locator('[data-testid="attribute-table"] thead th').first().click()
      await row('text.protein_origin').getByRole('button', { name: /^Acciones de/ }).click()
      await page.getByRole('menuitem', { name: 'Desconocido' }).click()
      await row('food.aquatic').getByRole('button', { name: /^Acciones de/ }).click()
      await page.getByRole('menuitem', { name: 'No aplica' }).click()
      const dirty = await footerText()
      report.edit = { counterBefore: before, counterAfterEdit: await counterText(), footerDirty: dirty }
      check('dirty-footer', /Cambios sin guardar/.test(dirty ?? ''), dirty)
      await shoot('table-edited-unsaved')
      await openMenu('text.ingredients')
      await page.waitForTimeout(250)
      await shoot('cell-menu-open-edited')
      await page.keyboard.press('Escape')
    })
    await step('save-server-error', async () => {
      // "No aplica" on a definition that does not admit it: the server refuses and the message belongs next to its cell.
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.waitForFunction(() => /No se guardó/.test(document.querySelector('[data-testid="editorial-footer"] .editorial-save-state')?.textContent ?? ''), null, { timeout: 20000 })
      const message = await row('food.aquatic').locator('.hf-cell__error').allInnerTexts()
      report.serverError = { footer: await footerText(), cellMessage: message }
      check('save-error-next-to-cell', message.length > 0, `${await footerText()} | ${message.join(' | ')}`)
      await scrollInPage('tr[data-row="food.aquatic"]', 200)
      await shoot('save-error-cell')
      await openMenu('food.aquatic')
      await page.getByRole('menuitem', { name: 'Desconocido' }).click()
    })
    await step('save', async () => {
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.waitForFunction(() => /Guardado/.test(document.querySelector('[data-testid="editorial-footer"] .editorial-save-state')?.textContent ?? ''), null, { timeout: 20000 })
      await page.waitForTimeout(800)
      const saved = await footerText()
      report.save = { footerSaved: saved, counterAfterSave: await counterText() }
      check('saved-footer', /Guardado · /.test(saved ?? ''), saved)
      const [a, b] = [report.edit?.counterBefore, report.save.counterAfterSave].map((t) => Number(/(\d+) de/.exec(t ?? '')?.[1]))
      check('counter-up', b > a, `${report.edit?.counterBefore} -> ${report.save.counterAfterSave}`)
      await page.evaluate(() => window.scrollTo(0, 0))
      await shoot('sheet-top', { prep: () => scrollInPage('.editorial-band', 80) })
      await shoot('table-saved')
      // The table in view; at 390 its own container scrolls sideways and the attribute column stays.
      await shoot('table-in-view', { prep: async (vp) => {
        await page.evaluate((narrow) => { document.querySelector('[data-testid="attribute-table"]').scrollLeft = narrow ? 120 : 0 }, vp.name === '390')
        await scrollInPage('[data-testid="attribute-table"]')
      } })
    })
    await step('missing-filter', async () => {
      const all = await page.locator('[data-testid="attribute-table"] tbody tr').count()
      await page.getByTestId('only-missing').click()
      const some = await page.locator('[data-testid="attribute-table"] tbody tr').count()
      check('only-missing', some > 0 && some < all, `${all} -> ${some} rows`)
      await shoot('only-missing-on')
      await page.getByTestId('only-missing').click()
    })
    await step('history', async () => {
      await page.getByTestId('open-history').click()
      await page.getByTestId('history-timeline').waitFor({ timeout: 10000 })
      await page.waitForTimeout(600)
      report.history = (await page.locator('.editorial-history-portal').innerText()).replace(/\s+/g, ' ').slice(0, 600)
      await shoot('history-drawer')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    })
    await step('fold', async () => {
      await page.locator('[data-testid="complete-to-publish"] > summary').click()
      await page.waitForTimeout(300)
      await scrollInPage('[data-testid="complete-to-publish"]', 120)
      await shoot('complete-to-publish-open')
      await page.locator('[data-testid="complete-to-publish"] > summary').click()
    })
    await step('family-change', async () => {
      dialogAccept = false
      const n = report.notes.length
      await page.locator('#editorial-family').selectOption({ label: await page.locator('#editorial-family option').filter({ hasText: /^Premios/ }).first().innerText() })
      await page.waitForTimeout(500)
      const asked = report.notes.slice(n).filter((t) => t.startsWith('dialog(confirm)'))
      const kept = await page.locator('#editorial-family').inputValue()
      check('family-change-confirm', asked.length === 1, asked[0] ?? 'no confirmation asked')
      report.familyAfterCancel = kept
      dialogAccept = true
    })
    await step('validation-error', async () => {
      await row('measure.net_volume').locator('input[type="text"]').fill('abc')
      await page.waitForTimeout(300)
      const inline = await row('measure.net_volume').locator('.hf-cell__error').allInnerTexts()
      await shoot('cell-validation-client')
      check('cell-error-inline', inline.length > 0, inline.join(' | '))
      await row('measure.net_volume').locator('input[type="text"]').fill('')
      // A server-side problem: a title far over the limit goes through the real save.
      await title().fill('x'.repeat(400)).catch(() => {})
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.waitForTimeout(1500)
      report.titleSaveFooter = await footerText()
      await shoot('save-error-title')
      await title().fill('')
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.waitForTimeout(1500)
    })
    await step('layout-390', async () => {
      await page.setViewportSize(VIEWPORTS[1].size)
      await page.waitForTimeout(300)
      report.mobile = await page.evaluate(() => {
        const wrap = document.querySelector('[data-testid="attribute-table"]')
        const th = document.querySelector('[data-testid="attribute-table"] tbody th')
        const bar = document.querySelector('[data-testid="editorial-footer"]')
        return {
          tableScrollsInside: wrap ? wrap.scrollWidth > wrap.clientWidth : null,
          pageOverflow: document.scrollingElement.scrollWidth > innerWidth,
          stickyLabel: th ? getComputedStyle(th).position : null,
          barSticky: bar ? getComputedStyle(bar).position : null,
          barBottom: bar ? Math.round(innerHeight - bar.getBoundingClientRect().bottom) : null,
        }
      })
      await page.setViewportSize(VIEWPORTS[0].size)
    })
  }
  if (WHO === 'manager') {
    await step('manager', async () => {
      await page.goto(`${BASE}/pos/products/${id}`, { waitUntil: 'domcontentloaded' })
      await page.locator('.product-task-button').first().waitFor({ timeout: 20000 }).catch(() => {})
      const tabs = (await page.locator('.product-task-button').allInnerTexts()).map((t) => t.trim())
      report.managerTabs = tabs
      const content = page.locator('.product-task-button[data-task="content"]')
      if (await content.count()) {
        await content.click()
        await page.waitForTimeout(2500)
      }
      await page.addStyleTag({ content: '#vue-devtools-anchor, .vue-devtools__anchor { display: none !important }' })
      const unavailable = await page.getByTestId('editorial-unavailable').count()
      const body = (await page.locator('main').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
      report.managerView = { tabs, unavailableBlock: unavailable > 0, footer: await page.getByTestId('editorial-footer').count(), table: await page.getByTestId('attribute-table').count(), inputs: await page.locator('[data-testid="attribute-table"] input, [data-testid="attribute-table"] select').count(), text: body.slice(0, 400) }
      check('manager-read-only-or-forbidden', unavailable > 0 || (report.managerView.footer === 0 && report.managerView.inputs === 0), JSON.stringify(report.managerView).slice(0, 400))
      await shoot('manager-content')
    })
  }
} finally {
  writeFileSync(join(HERE, `report-${WHO}.json`), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
