// Re-shoot after the D1/D2/D3/D5 fixes. Read-only: no writes are sent. The cashier
// declaration state is shown by patching the GET detail of the selected session
// to COUNTING + blind in the browser only (route), never on the backend.
import { chromium } from '@playwright/test'
import { open, settle, shot, makeLog, BASE, overflow } from './lib.mjs'
const log = makeLog('fix-shots')
const browser = await chromium.launch({ headless: true })
const SUBMITTED = ['382d6afa', '74b91dc4']

async function measureForm(page, tag) {
  const form = page.getByTestId('cash-count-form').first()
  if (!(await form.count())) return log(`${tag}: no count form`)
  const m = await form.evaluate((e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
    return { cls: e.className, h: Math.round(r.height), sh: e.scrollHeight, bg: cs.backgroundColor, overflowsParent: e.scrollHeight > r.height + 1 }
  })
  log(`${tag}: count form ${JSON.stringify(m)}`)
}

async function heads(page, tag) {
  const rows = await page.locator('.cash-tl-title').evaluateAll((els) => els.map((e) => {
    const lh = parseFloat(getComputedStyle(e).lineHeight) || 22
    return `${e.textContent.trim()}=${Math.round(e.getBoundingClientRect().height / lh)}l`
  }))
  log(`${tag}: title lines ${rows.join(' | ')}`)
}

async function barText(page) {
  const bar = page.getByTestId('cash-workspace-bar')
  return (await bar.isVisible().catch(() => false)) ? (await bar.innerText()).replace(/\s+/g, ' ') : null
}

const ONLY = process.env.ONLY // e.g. "390-dark" to re-run one cell after a 429
for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  if (ONLY && ONLY !== `${width}-${theme}`) continue
  const height = width === 390 ? 844 : 900
  // ── Cashier: timeline heads (D3) and the declaration form (D1) ──
  {
    const { ctx, page, issues } = await open(log, { role: 'cashier', width, height, theme, browser })
    page.setDefaultTimeout(8000)
    const tag = `cashier-${width}-${theme}`
    await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
    await heads(page, tag)
    await page.getByTestId('cash-timeline').scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, `fix-${tag}-timeline`, log)
    await page.route(/\/cash-sessions\/[0-9a-f-]{36}$/, async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const res = await route.fetch(); const body = await res.json()
      body.session = { ...body.session, status: 'COUNTING', blind: true, frozenAt: body.session.frozenAt ?? new Date().toISOString() }
      body.requiredChannels = body.requiredChannels ?? [{ channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' }]
      await route.fulfill({ response: res, json: body })
    })
    await page.reload(); await settle(page, 1500)
    await page.getByTestId('cash-step-toggle-declaracion').click().catch((e) => log('declaracion toggle ' + e.message.slice(0, 80)))
    await settle(page, 600)
    await measureForm(page, tag)
    await page.getByTestId('cash-task-declaracion').scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, `fix-${tag}-declaracion`, log)
    await page.getByTestId('cash-step-verificacion').scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, `fix-${tag}-declaracion-below`, log)
    const o = await overflow(page)
    log(`${tag}: overflowX=${o.sw > o.cw} ISSUES ${JSON.stringify(issues)}`)
    await ctx.close()
  }
  // ── Manager: supervisor home (D2), verification form (D1), corte (D5) ──
  {
    const { ctx, page, issues } = await open(log, { role: 'manager', width, height, theme, browser })
    page.setDefaultTimeout(8000)
    const tag = `manager-${width}-${theme}`
    await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
    const title = await page.getByTestId('cash-head-title').innerText().catch(() => null)
    const abrir = await page.getByText('Abrir caja', { exact: false }).count()
    const forbidden = await page.getByTestId('cash-opening-forbidden').count()
    log(`${tag}: home title=${JSON.stringify(title)} home=${await page.getByTestId('cash-supervisor-home').count()} abrirCaja=${abrir} forbidden=${forbidden} bar=${JSON.stringify(await barText(page))}`)
    await shot(page, `fix-${tag}-home`, log)
    if (width === 390) {
      await page.getByTestId('cash-supervisor-sessions').click().catch((e) => log('jump ' + e.message.slice(0, 60)))
      await page.waitForTimeout(400)
      log(`${tag}: jump focus=${await page.evaluate(() => document.activeElement?.id)}`)
      await shot(page, `fix-${tag}-home-sessions`, log)
      await page.evaluate(() => window.scrollTo(0, 0))
    }
    let opened = false
    for (const prefix of SUBMITTED) {
      const btn = page.locator(`[data-testid^="cash-session-open-${prefix}"]`).first()
      if (!(await btn.count())) continue
      await btn.click(); await settle(page, 1200)
      const toggle = page.getByTestId('cash-step-toggle-verificacion')
      if (!(await toggle.count())) continue
      await toggle.click(); await settle(page, 600)
      if (await page.getByTestId('cash-count-form').count()) { opened = true; break }
    }
    log(`${tag}: verification form opened=${opened} bar=${JSON.stringify(await barText(page))}`)
    await measureForm(page, tag)
    await page.getByTestId('cash-task-verificacion').scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, `fix-${tag}-verificacion`, log)
    await page.getByTestId('cash-step-liberar').scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, `fix-${tag}-verificacion-below`, log)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByTestId('cash-closings-entry').click().catch((e) => log('cortes ' + e.message.slice(0, 60))); await settle(page, 1200)
    await page.getByTestId('cash-closing-row-open').first().click().catch((e) => log('row ' + e.message.slice(0, 60))); await settle(page, 1500)
    const tables = await page.locator('.cd-table-wrap').evaluateAll((els) => els.map((e) => `${e.scrollWidth}/${e.clientWidth}`))
    const labels = await page.locator('table.cd-table').first().locator('td').evaluateAll((els) => els.map((e) => `${getComputedStyle(e, '::before').content}:${e.innerText}`))
    log(`${tag}: corte tables scroll/client ${tables.join(' ')} cells ${labels.join(' | ')}`)
    await page.locator('.cd-table').first().evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {})
    log(`${tag}: corte bar=${JSON.stringify(await barText(page))}`)
    await shot(page, `fix-${tag}-corte`, log)
    const o = await overflow(page)
    log(`${tag}: overflowX=${o.sw > o.cw} ISSUES ${JSON.stringify(issues)}`)
    await ctx.close()
  }
}
await browser.close()
