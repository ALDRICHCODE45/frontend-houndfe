#!/usr/bin/env node
// Runtime check of the presentation cards (T10, S13) against the real BE, as admin@houndfe.com.
// Food «Alimento Premium para Perro Adulto 15 kg» (one "Producto" card), an accessory with variants
// (one card per presentation) and a care product (the "Revisión de cuidado" drawer).
// It mutates the disposable dev DB (S8): it starts and saves editorial drafts.
// Run: node odd/evidence/presentation-card/capture.mjs [--only food,accessory,care]
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HERE, SHOTS, open, openContent, scrollInPage, setTheme } from './lib.mjs'

const FOOD = 'Alimento Premium para Perro Adulto 15 kg'
const ACCESSORIES = ['Collar Ajustable de Nailon', 'Collar ajustable Ruffwear Front Range', 'Collar ajustable']
const CARE = ['Pipeta antipulgas Frontline Plus para perro', 'Shampoo de avena Bio-Groom para perro 355 ml']
const argv = process.argv.slice(2)
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null

const report = { checks: {}, shots: [], consoleErrors: [], nativeDialogs: [], overflow: [], notes: [], products: {} }
const check = (name, pass, evidence) => { report.checks[name] = { pass: Boolean(pass), evidence }; console.log(pass ? 'PASS' : 'FAIL', name, evidence ?? '') }
const { browser, page, productId } = await open(report)

const card = (i = 0) => page.getByTestId('presentation-card').nth(i)
const footerText = () => page.locator('[data-testid="editorial-footer"] .editorial-save-state').innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null)
const row = (code) => page.locator(`[data-testid="attribute-table"] tr[data-row="${code}"]`)
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }

/** Viewport shot (with the cards scrolled into view) plus a tight shot of the cards section. */
async function shoot(name, { views = [['1440', 'light']], target = '[data-testid="presentation-cards"]', offset = 96, element = true } = {}) {
  for (const [vp, theme] of views) {
    await page.setViewportSize(sizes[vp])
    await setTheme(page, theme)
    await page.mouse.move(2, 2)
    await page.waitForTimeout(300)
    await scrollInPage(page, target, offset)
    await page.waitForTimeout(200)
    const file = `${name}__${vp}__${theme}.png`
    await page.screenshot({ path: join(SHOTS, file) })
    report.shots.push(file)
    if (element && vp === '1440') {
      const el = page.locator(target).first()
      if (await el.count()) {
        // A tall section only paints inside the viewport: grow it for the crop and hide the sticky save bar.
        const height = Math.ceil((await el.boundingBox())?.height ?? 0)
        await page.setViewportSize({ width: 1440, height: Math.max(900, height + 400) })
        await page.addStyleTag({ content: '[data-testid="editorial-footer"] { visibility: hidden !important }' }).then((h) => h.evaluate((n) => n.setAttribute('data-crop', '')))
        await scrollInPage(page, target, 24)
        await page.waitForTimeout(200)
        const crop = `${name}__${vp}__${theme}__crop.png`
        await el.screenshot({ path: join(SHOTS, crop) })
        report.shots.push(crop)
        await page.evaluate(() => document.querySelectorAll('style[data-crop]').forEach((n) => n.remove()))
        await page.setViewportSize(sizes[vp])
      }
    }
    const over = await page.evaluate(() => (document.scrollingElement.scrollWidth > innerWidth ? document.scrollingElement.scrollWidth : null))
    if (over) report.overflow.push({ shot: file, scrollWidth: over })
  }
  await page.setViewportSize(sizes[1440])
  await setTheme(page, 'light')
}

async function save(expect = /Guardado/) {
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.waitForFunction((re) => new RegExp(re).test(document.querySelector('[data-testid="editorial-footer"] .editorial-save-state')?.textContent ?? ''),
    expect.source, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)
  return footerText()
}

async function ensureDraft() {
  if (await page.getByTestId('initialize').count()) {
    report.notes.push('no draft: started one with Empezar ficha')
    await page.getByTestId('initialize').click()
    await page.locator('#editorial-family').waitFor({ timeout: 20000 })
  }
}

/** Picks a family through the USelect, confirming the modal when the change clears data. */
async function family(label) {
  const current = (await page.locator('#editorial-family').innerText()).trim()
  if (current === label) return false
  await page.locator('#editorial-family').click()
  await page.getByRole('option', { name: label, exact: true }).click()
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: /cambiar|confirmar|continuar/i })
  if (await confirm.count().catch(() => 0)) await confirm.first().click()
  await page.waitForTimeout(600)
  return true
}

/** Clicks a chip of the first card by its visible text, inside the question or the source group. */
const chip = (scope, text) => scope.locator('label.pcard__chip').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) }).first()

/** A "No aplica" left by an earlier run goes back to empty ("Escribir valor"), so the menu offers it again
 * and the card holds no stored source. */
async function resetNotApplicable() {
  const already = await page.locator('[data-testid="attribute-table"] tbody tr:has(.hf-cell[data-state="not_applicable"])').evaluateAll((rows) => rows.map((r) => r.dataset.row))
  for (const code of already) {
    await row(code).getByRole('button', { name: /^Acciones de/ }).first().click()
    await page.getByRole('menuitem', { name: 'Escribir valor' }).click()
    await page.keyboard.press('Escape')
  }
  if (already.length) { report.notes.push(`reset earlier No aplica: ${already.join(', ')}`); await save() }
}

const step = async (name, group, fn) => {
  if (only && !only.includes(group)) return
  try { await fn() } catch (e) {
    await page.screenshot({ path: join(SHOTS, `_error-${name}.png`) }).catch(() => {})
    report.notes.push(`${name}: ${String(e).split('\n')[0].slice(0, 300)}`); console.log('ERR', name, String(e).split('\n')[0].slice(0, 300)) }
}

try {
  // ---- Food: one "Producto" card ----
  let foodId
  await step('food-open', 'food', async () => {
    foodId = (await productId(FOOD)).id
    report.products.food = { name: FOOD, id: foodId }
    report.food = {}
    await openContent(page, foodId)
    await ensureDraft()
    await family('Alimento')
    await resetNotApplicable()
    // A card answered by an earlier run is cleared through its own ⋯ menu, then saved, so the unanswered state shows again.
    if (await card().getByTestId('card-summary').count() || await card().locator('label.pcard__chip[data-checked="true"]').count()) {
      report.notes.push('food card was answered before the run: cleared through "Borrar respuestas…" and saved')
      await card().getByRole('button', { name: /^Acciones de/ }).first().click()
      await page.getByRole('menuitem', { name: /Borrar respuestas/ }).click()
      await page.getByRole('button', { name: 'Borrar respuestas', exact: true }).click()
      await save()
      await openContent(page, foodId)
    }
    report.food.sourcePickedWhileUnanswered = await card().getByTestId('card-source').locator('label.pcard__chip[data-checked="true"]').count()
    const title = (await card().locator('.pcard__title').innerText()).trim()
    check('food-single-producto-card', (await page.getByTestId('presentation-card').count()) === 1 && title === 'Producto', `${await page.getByTestId('presentation-card').count()} card(s), title «${title}»`)
    report.food.questions = (await card().locator('.pcard__label').allInnerTexts()).map((t) => t.trim())
    await shoot('01-food-unanswered', { views: [['1440', 'light'], ['1440', 'dark'], ['390', 'light'], ['390', 'dark']] })
  })

  await step('food-answer', 'food', async () => {
    await chip(card().getByTestId('card-question').first(), 'Peso').click()
    await chip(card().getByTestId('card-source'), 'Etiqueta del empaque').click()
    const checked = (await card().locator('label.pcard__chip[data-checked="true"]').allInnerTexts()).map((t) => t.trim())
    check('food-answer-peso-etiqueta', checked.includes('Peso') && checked.includes('Etiqueta del empaque'), checked.join(' · '))
    await shoot('02-food-answered', { views: [['1440', 'light'], ['1440', 'dark'], ['390', 'light'], ['390', 'dark']] })
    // "Revisada el" is the app's calendar field (no visible native date input), shown in es-MX.
    const nativeDates = await card().locator('input[type="date"]:not([aria-hidden="true"])').count()
    const dateText = (await card().getByTestId('card-source-date').innerText()).replace(/\s+/g, '')
    check('date-calendar-field', nativeDates === 0 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateText), `${nativeDates} native; field «${dateText}»`)
    await card().getByTestId('card-source-date').click()
    await page.waitForTimeout(500)
    const heading = await page.getByText(/^[a-záéíóú]+ de \d{4}$/).first().innerText().catch(() => null)
    check('date-calendar-popover', Boolean(heading), `calendar heading «${heading}»`)
    await scrollInPage(page, '[data-testid="card-source"]', 200)
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(SHOTS, '15-food-date-calendar__1440__light.png') }); report.shots.push('15-food-date-calendar__1440__light.png')
    await page.keyboard.press('Escape')
  })

  await step('food-save', 'food', async () => {
    const saved = await save()
    check('food-save', /Guardado/.test(saved ?? ''), saved)
    // A complete card folds as soon as the save succeeds.
    const summary = await card().getByTestId('card-summary').innerText().catch(() => null)
    report.food.collapsedRightAfterSave = Boolean(summary)
    check('food-folds-on-save', Boolean(summary), summary)
    await shoot('03-food-collapsed', { views: [['1440', 'light'], ['1440', 'dark'], ['390', 'light'], ['390', 'dark']] })
    await openContent(page, foodId)
    const reloaded = await card().getByTestId('card-summary').innerText().catch(() => null)
    check('food-collapsed-after-reload', Boolean(reloaded), reloaded)
  })

  await step('food-required', 'food', async () => {
    // The marker shows while the datum is missing (a filled cell needs no reminder): a value from an
    // earlier run is removed through the cell's own ⋯ "Quitar dato" and the empty cell is saved.
    const cellState = await row('measure.net_mass').locator('.hf-cell').first().getAttribute('data-state')
    if (cellState === 'known') {
      report.notes.push('Peso neto had a value from an earlier run: removed with "Quitar dato" and saved')
      await row('measure.net_mass').getByRole('button', { name: /^Acciones de/ }).first().click()
      await page.getByRole('menuitem', { name: 'Quitar dato' }).click()
      await save()
    }
    const text = (await row('measure.net_mass').innerText()).replace(/\s+/g, ' ')
    check('peso-neto-required-to-publish', /Requerido para publicar/.test(text), text.slice(0, 160))
    await shoot('04-food-table-required', { target: '[data-testid="attribute-table"]', offset: 24 })
    const optional = (await page.locator('[data-testid="attribute-table"] tbody tr').evaluateAll((rows) => rows.filter((r) => /Requerido para publicar/.test(r.textContent)).map((r) => r.dataset.row)))
    report.food.requiredRows = optional
  })

  await step('food-na', 'food', async () => {
    await resetNotApplicable()
    // The first optional row whose ⋯ menu offers "No aplica".
    const codes = await page.locator('[data-testid="attribute-table"] tbody tr').evaluateAll((rows) => rows.map((r) => r.dataset.row))
    let picked = null
    for (const code of codes) {
      const menu = row(code).getByRole('button', { name: /^Acciones de/ }).first()
      if (!(await menu.count())) continue
      await menu.click()
      const na = page.getByRole('menuitem', { name: 'No aplica', exact: true })
      if (await na.count()) {
        await shoot('05-food-na-menu', { target: `tr[data-row="${code}"]`, offset: 160, element: false })
        await na.click(); picked = code; break
      }
      await page.keyboard.press('Escape')
    }
    report.food.naRow = picked
    if (!picked) return check('food-na-saves', false, 'no row offers No aplica')
    const saved = await save()
    const errors = await page.locator('.hf-cell__error').allInnerTexts()
    const state = await row(picked).locator('.hf-cell').first().getAttribute('data-state')
    check('food-na-saves', /Guardado/.test(saved ?? '') && errors.length === 0 && state === 'not_applicable', `${picked}: ${saved}; cell ${state}; ${errors.length} cell errors`)
    await openContent(page, foodId)
    const after = await row(picked).locator('.hf-cell').first().getAttribute('data-state')
    check('food-na-persisted', after === 'not_applicable', `${picked} after reload: ${after}`)
    await shoot('06-food-na-saved', { target: `tr[data-row="${picked}"]`, offset: 160, element: false })
  })

  await step('food-missing-source', 'food', async () => {
    await card().getByTestId('card-edit').click()
    // "Otro" with nothing typed leaves the answer without a source.
    await chip(card().getByTestId('card-source'), 'Otro').click()
    await page.waitForTimeout(200)
    const saved = await save(/No se guardó|Guardado/)
    const error = await card().getByTestId('card-source-error').innerText().catch(() => null)
    check('missing-source-error', Boolean(error) && !/Guardado/.test(saved ?? ''), `${saved} | ${error}`)
    await shoot('07-food-missing-source', { views: [['1440', 'light'], ['1440', 'dark'], ['390', 'light']] })
    // Leave the draft with its source again.
    await chip(card().getByTestId('card-source'), 'Etiqueta del empaque').click()
    const restored = await save()
    check('missing-source-recovers', /Guardado/.test(restored ?? ''), restored)
  })

  // ---- Accessory with variants: one card per presentation ----
  await step('accessory', 'accessory', async () => {
    let product
    for (const name of ACCESSORIES) { try { product = await productId(name); break } catch { report.notes.push(`accessory not found: ${name}`) } }
    report.products.accessory = { name: product.name, id: product.id }
    await openContent(page, product.id)
    await ensureDraft()
    await family('Accesorios')
    await page.getByTestId('presentation-card').first().waitFor({ timeout: 10000 })
    // Answers from an earlier run are cleared through each card's ⋯ menu and saved, so the unanswered state shows.
    let cleared = 0
    for (let i = 0; i < await page.getByTestId('presentation-card').count(); i++) {
      await card(i).getByRole('button', { name: /^Acciones de/ }).first().click()
      const item = page.getByRole('menuitem', { name: /Borrar respuestas/ })
      if (await item.isDisabled().catch(() => true) || (await item.getAttribute('data-disabled')) !== null) { await page.keyboard.press('Escape'); continue }
      await item.click()
      await page.getByRole('button', { name: 'Borrar respuestas', exact: true }).click()
      await page.waitForTimeout(300)
      cleared++
    }
    if (cleared) { report.notes.push(`accessory: cleared ${cleared} answered card(s) from an earlier run`); await save(); await openContent(page, product.id) }
    const open = await page.locator('[data-testid="presentation-card"][data-open="true"]').count()
    const compact = (await page.locator('[data-testid="presentation-card"][data-open="false"]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
    check('accessory-only-first-open', open === 1 && compact.every((t) => /Sin responder/.test(t) && /Responder/.test(t)), `${open} open; ${compact.join(' | ')}`)
    const dims = await card().getByTestId('card-show-all').innerText().catch(() => null)
    check('accessory-dimensions-ver-todas', /^Ver todas \(\d+\)$/.test(dims ?? ''), dims)
    const titles = (await page.locator('[data-testid="presentation-card"] .pcard__title').allInnerTexts()).map((t) => t.trim())
    const questions = (await card().locator('.pcard__label').allInnerTexts()).map((t) => t.trim())
    report.accessory = { titles, questions }
    check('accessory-cards-per-presentation', titles.length >= 2, titles.join(' · '))
    await shoot('08-accessory-cards', { views: [['1440', 'light'], ['1440', 'dark'], ['390', 'light'], ['390', 'dark']], offset: 24 })
    // Answer every question of the first card: Sí where asked (the follow-up lists appear), else the first option.
    const questions1 = card().getByTestId('card-question')
    for (let i = 0; i < await questions1.count(); i++) {
      const q = questions1.nth(i)
      if (await q.locator('label.pcard__chip[data-checked="true"]').count()) continue
      const yes = chip(q, 'Sí')
      if (await yes.count()) await yes.click()
      else await q.locator('label.pcard__chip').first().click()
      await page.waitForTimeout(150)
    }
    await chip(card().getByTestId('card-source'), 'Ficha del fabricante').click()
    report.accessory.questionsAfterYes = (await card().locator('.pcard__label').allInnerTexts()).map((t) => t.trim())
    await shoot('09-accessory-first-answered', { views: [['1440', 'light'], ['390', 'light']], offset: 24 })
    const saved = await save()
    check('accessory-save', /Guardado/.test(saved ?? ''), saved)
    const folded = await card().getByTestId('card-summary').innerText().catch(() => null)
    check('accessory-folds-on-save', Boolean(folded), folded)
    await shoot('10-accessory-saved', { views: [['1440', 'light'], ['1440', 'dark']], offset: 24 })
    // "Copiar respuestas de …" on the second card copies the first one's answers and source.
    const copy = card(1).getByTestId('card-copy')
    const copyText = (await copy.innerText().catch(() => '')).trim()
    check('accessory-copy-offered', copyText === `Copiar respuestas de ${titles[0]}`, copyText)
    await copy.click()
    await page.waitForTimeout(400)
    const copied = await card(1).getByTestId('card-summary').innerText().catch(() => null)
    check('accessory-copy-folds-with-summary', Boolean(copied) && copied === folded, `${copied} vs ${folded}`)
    await shoot('14-accessory-copied', { views: [['1440', 'light'], ['1440', 'dark'], ['390', 'light']], offset: 24 })
    const savedCopy = await save()
    check('accessory-copy-save', /Guardado/.test(savedCopy ?? ''), savedCopy)
  })

  // ---- Care: the "Revisión de cuidado" drawer ----
  await step('care', 'care', async () => {
    let product
    for (const name of CARE) { try { product = await productId(name); break } catch { report.notes.push(`care product not found: ${name}`) } }
    report.products.care = { name: product.name, id: product.id }
    await openContent(page, product.id)
    await ensureDraft()
    await family('Cuidado y salud')
    await card().waitFor({ timeout: 10000 })
    report.care = { titles: (await page.locator('[data-testid="presentation-card"] .pcard__title').allInnerTexts()).map((t) => t.trim()) }
    await shoot('11-care-cards', { views: [['1440', 'light']], offset: 24 })
    if (!(await card().getByTestId('card-open-care').count())) await card().getByTestId('card-edit').click()
    await card().getByTestId('card-open-care').click()
    await page.waitForTimeout(700)
    const drawer = page.getByRole('dialog').last()
    report.care.drawer = (await drawer.innerText()).replace(/\s+/g, ' ').slice(0, 800)
    check('care-drawer-opens', /cuidado/i.test(report.care.drawer), report.care.drawer.slice(0, 120))
    for (const [vp, theme] of [['1440', 'light'], ['1440', 'dark'], ['390', 'light']]) {
      await page.setViewportSize(sizes[vp]); await setTheme(page, theme); await page.waitForTimeout(400)
      const file = `12-care-drawer__${vp}__${theme}.png`
      await page.screenshot({ path: join(SHOTS, file) }); report.shots.push(file)
    }
    await page.setViewportSize(sizes[1440]); await setTheme(page, 'light')
    // "Lista": the review's own questions show up.
    await drawer.locator('label').filter({ hasText: /^\s*Lista\s*$/ }).first().click()
    await page.waitForTimeout(500)
    report.care.drawerLista = (await drawer.innerText()).replace(/\s+/g, ' ').slice(0, 1200)
    for (const [vp, theme] of [['1440', 'light'], ['1440', 'dark'], ['390', 'light']]) {
      await page.setViewportSize(sizes[vp]); await setTheme(page, theme); await page.mouse.move(2, 2); await page.waitForTimeout(400)
      const file = `13-care-drawer-lista__${vp}__${theme}.png`
      await page.screenshot({ path: join(SHOTS, file) }); report.shots.push(file)
    }
    await page.setViewportSize(sizes[1440]); await setTheme(page, 'light')
    await page.keyboard.press('Escape')
  })
  check('no-native-dialogs', report.nativeDialogs.length === 0, report.nativeDialogs.join(' | ') || 'none')
  check('no-console-errors', report.consoleErrors.length === 0, report.consoleErrors.slice(0, 3).join(' | ') || 'none')
} finally {
  writeFileSync(join(HERE, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
