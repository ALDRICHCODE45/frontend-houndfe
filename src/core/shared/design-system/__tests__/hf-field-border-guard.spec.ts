import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// S16 guard: a field rests on --hf-border; --hf-field-border is the hover and
// emphasis boundary only. A stylesheet or SFC <style> that paints a rest state
// with --hf-field-border brings back the strong border the user asked to drop.
const ROOTS = ['src/features', 'src/core', 'src/app']

// Deliberate non-text-field uses, keyed `file :: selector`.
const ALLOWED = new Set([
  // Checkbox indicator: a non-text control boundary keeps 3:1 (WCAG 1.4.11).
  'src/core/shared/components/form/hf-form.css :: .hf-ui .hf-combobox__box',
  // Round radio mark of the catalog settings pills and stock cards (Selección sin checkboxes): the
  // empty ring identifies a non-text control, so it keeps 3:1 (WCAG 1.4.11).
  'src/features/system/catalog-settings/styles/catalog-settings-visual.css :: .catalog-settings-visual .cs-mark',
  // Step marker in the purchase-order stepper, a graphic, not a field.
  'src/features/procurement/purchase-orders/styles/purchase-orders-visual.css :: .purchase-orders-portal .order-step-mark',
  // Secondary buttons.
  'src/features/procurement/suppliers/views/SupplierView.vue :: .supplier-button',
  'src/features/POS/sales/styles/sales-pos-customer.css :: .sales-pos-customer .sales-pos-customer-new-customer',
  'src/features/POS/sales/styles/sales-pos-customer.css :: .sales-pos-customer-summary .sales-pos-customer-trigger',
  // Timeline dot in the history drawer.
  'src/features/POS/products/components/editorial/EditorialHistoryDrawer.vue :: .timeline__dot',
])

// States where the stronger boundary is the point: hover, focus, open.
const STATE = /:hover|:focus|\[aria-expanded=|\[data-state=['"]?open/

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : files(path)
    return /\.(css|vue)$/.test(entry.name) ? [path] : []
  })
}

function styleOf(path: string) {
  const source = readFileSync(path, 'utf8')
  if (!path.endsWith('.vue')) return source
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')
}

// Top-level selector branches only: commas inside :is()/:not()/:has() stay put.
function branches(selector: string) {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of selector) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else current += char
  }
  return [...parts, current].map(part => part.replace(/\s+/g, ' ').trim())
}

function restBoundaryOffenders() {
  const offenders: string[] = []
  for (const path of ROOTS.flatMap(files)) {
    const css = styleOf(path).replace(/\/\*[\s\S]*?\*\//g, '')
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const paints = /(?:^|;|\s)(?:border(?:-[a-z-]+)?|--tw-ring-color|box-shadow|outline-color)\s*:[^;]*--hf-field-border/.test(body!)
      if (!paints) continue
      for (const name of branches(selector!)) {
        if (STATE.test(name) || ALLOWED.has(`${path} :: ${name}`)) continue
        offenders.push(`${path} :: ${name}`)
      }
    }
  }
  return offenders
}

describe('field rest-border guard (S16)', () => {
  it('no stylesheet rests a field on --hf-field-border', () => {
    expect(restBoundaryOffenders()).toEqual([])
  })

  it('every allowlisted exception still exists, so the list cannot rot', () => {
    const live = new Set<string>()
    for (const path of ROOTS.flatMap(files)) {
      const css = styleOf(path).replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!body!.includes('--hf-field-border')) continue
        for (const name of branches(selector!)) live.add(`${path} :: ${name}`)
      }
    }
    for (const entry of ALLOWED) expect(live.has(entry), entry).toBe(true)
  })
})
