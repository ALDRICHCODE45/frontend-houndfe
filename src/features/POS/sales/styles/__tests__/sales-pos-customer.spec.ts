import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the Venta customer / address adapter (T7 / S1-S7).
 *
 * The adapter is composition-only: it is imported exclusively from the
 * sale-owned `AssignCustomerSlideover.vue` (never from `SalesView.vue`), and
 * every rule is governed by one of three owned markers —
 *   `.sales-pos-customer`        the assignment sheet (portal token),
 *   `.sales-pos-customer-form`   the nested Nuevo cliente / Añadir dirección
 *                                roots that the sheet explicitly opts in,
 *   `.sales-pos-customer-summary` the in-cart trigger + assigned summary.
 *
 * Shared consumers keep `clients-form-portal` untouched: this file never
 * targets a foreign marker, never repaints the protected entry/workspace/
 * checkout adapters, and carries no palette literal, no `:root`, no wildcard
 * and no blanket `!important`.
 *
 * These are source/CSSOM contracts. They do not prove browser fidelity,
 * measured contrast or touch ergonomics; visual smoke stays user-owned.
 */
const path = 'src/features/POS/sales/styles/sales-pos-customer.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
/** Declarations only: comments must not satisfy or defeat textual assertions. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

const sheetSource = readFileSync(
  'src/features/POS/sales/components/AssignCustomerSlideover.vue',
  'utf8',
)
const viewSource = readFileSync('src/features/POS/sales/views/SalesView.vue', 'utf8')
const customerFormSource = readFileSync(
  'src/features/POS/customers/components/CustomerUpsertSlideover.vue',
  'utf8',
)
const addressFormSource = readFileSync(
  'src/features/POS/customers/components/AddressModal.vue',
  'utf8',
)
const panelSource = readFileSync(
  'src/features/POS/sales/components/ActiveSalePanel.vue',
  'utf8',
)

const styles: HTMLStyleElement[] = []

function styleRules(source: string): CSSStyleRule[] {
  const style = document.createElement('style')
  // Local rules only: `@import` must not trigger network requests in jsdom.
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)

  const collected: CSSStyleRule[] = []
  const walk = (list: CSSRuleList | undefined) => {
    if (!list) return
    Array.from(list).forEach((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) {
        collected.push(rule as CSSStyleRule)
      } else {
        walk((rule as CSSGroupingRule).cssRules)
      }
    })
  }
  walk(style.sheet?.cssRules)
  return collected
}

function splitTopLevel(selectorText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of selectorText) {
    if (char === '(' || char === '[') depth += 1
    if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/** CSSOM may normalize attribute-selector quoting, so compare without quotes. */
function normalize(selector: string): string {
  return selector.replace(/\s+/g, ' ').replace(/["']/g, '').trim()
}

function selectorsOf(source: string): string[] {
  return styleRules(source).flatMap((rule) => splitTopLevel(rule.selectorText))
}

function exactRule(source: string, selector: string, property?: string): CSSStyleRule | undefined {
  const expected = normalize(selector)
  const candidates = styleRules(source).filter((rule) =>
    splitTopLevel(rule.selectorText).some((part) => normalize(part) === expected),
  )
  if (!property) return candidates[0]
  return candidates.find((rule) => rule.style.getPropertyValue(property).trim() !== '')
}

function allDeclarations(source: string): Array<{ property: string; value: string }> {
  return styleRules(source).flatMap((rule) =>
    Array.from({ length: rule.style.length }, (_, index) => {
      const property = rule.style.item(index)
      return { property, value: rule.style.getPropertyValue(property).trim() }
    }),
  )
}

function remValue(value: string): number {
  const match = value.match(/^([\d.]+)rem$/)
  return match ? Number(match[1]) : Number.NaN
}

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

// ── CSS-R1 — one owned adapter, three owned markers ─────────────────────────

describe('CSS-R1 — the venta customer adapter owns its boundary', () => {
  it('exists, imports the shared foundation and declares no global scope', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    expect(declarations).not.toContain(':root')
    expect(declarations).not.toContain('::backdrop')
  })

  it('is imported from the sale sheet and never from SalesView', () => {
    expect(sheetSource).toContain("import '../styles/sales-pos-customer.css'")
    expect(viewSource).not.toContain('sales-pos-customer.css')
    // The nested wrappers must not import it either: the marker is opt-in, the
    // stylesheet belongs to the venta sheet that forwards it.
    expect(customerFormSource).not.toContain('sales-pos-customer.css')
    expect(addressFormSource).not.toContain('sales-pos-customer.css')
  })

  it('scopes every selector to an owned marker', () => {
    const selectors = selectorsOf(css)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector, selector).toMatch(/sales-pos-customer/)
      expect(selector).not.toMatch(/^(?:\*|html|body|button|input|select|textarea|a|table)\b/)
      expect(selector.trim()).not.toBe('*')
    }
    // all three surfaces are actually styled
    for (const marker of ['sales-pos-customer', 'sales-pos-customer-form', 'sales-pos-customer-summary']) {
      expect(
        selectors.some((selector) => selector.includes(`.${marker}`)),
        marker,
      ).toBe(true)
    }
  })

  it('never targets another module marker', () => {
    for (const foreign of [
      'sales-entry-visual',
      'sales-entry-portal',
      'sales-pos-workspace',
      'sales-pos-cart',
      'sales-pos-checkout',
      'sales-detail',
      'sales-list',
      'quotations',
      'cash-visual',
      'products-visual',
      'clients-visual',
      'clients-form-portal',
      'clients-form-section',
      'clients-form-link',
      'hf-form-overlay',
      'hf-shell',
    ]) {
      expect(declarations, `must not target ${foreign}`).not.toContain(foreign)
    }
  })
})

// ── CSS-R2 — semantic roles only, no palette literal, no blanket override ───

describe('CSS-R2 — colour resolves through the foundation roles', () => {
  it('declares no raw colour literal, no wildcard and no !important', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    for (const { property, value } of allDeclarations(css)) {
      expect(`${property}:${value}`).not.toMatch(/\brgba?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\bhsla?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\boklch\(/i)
      expect(`${property}:${value}`).not.toMatch(/\b(?:white|black)\b/i)
      expect(`${property}:${value}`, property).not.toContain('!important')
    }
    expect(declarations).not.toMatch(/(^|[{};\s,])\*\s*(?:[,{])/)
    expect(selectorsOf(css).some((selector) => selector.includes('*'))).toBe(false)
  })

  it('paints the reached surfaces with hf roles', () => {
    const painted = allDeclarations(css).filter(({ property }) =>
      /(background-color|border-color|border-top-color|color|outline-color|box-shadow)$/.test(property),
    )
    expect(painted.length).toBeGreaterThan(0)
    for (const { value } of painted) {
      const semantic = value === 'transparent' || value.includes('var(--hf-')
      expect(semantic, `unexpected colour value: ${value}`).toBe(true)
    }
  })

  it('keeps the framework error colour on destructive summary actions', () => {
    const summary = document.createElement('section')
    summary.className = 'sales-pos-customer-summary'
    const change = document.createElement('button')
    change.className = 'sales-pos-customer-action'
    const remove = document.createElement('button')
    remove.className = 'sales-pos-customer-action sales-pos-customer-action-destructive text-error'
    summary.append(change, remove)

    // Selector matching pins the cascade boundary without pretending jsdom
    // measures rendered contrast or browser fidelity.
    const colourRules = styleRules(css).filter((rule) => rule.style.getPropertyValue('color'))
    expect(colourRules.filter((rule) => change.matches(rule.selectorText)).map((rule) =>
      rule.style.getPropertyValue('color').trim(),
    )).toEqual(['var(--hf-action)'])
    expect(colourRules.filter((rule) => remove.matches(rule.selectorText))).toHaveLength(0)
    expect(panelSource).toMatch(/data-testid="unassign-customer-trigger"[\s\S]*?color="error"/)
  })

  it('wins the legacy literals by specificity, not by force', () => {
    // the gold literal the sheet still carries for other consumers is replaced
    // under the venta marker by the action role
    const change = exactRule(
      css,
      '.sales-pos-customer .sales-pos-customer-change',
      'color',
    )!
    expect(change, 'venta change-customer link must resolve to the action role').toBeDefined()
    expect(change.style.getPropertyValue('color').trim()).toBe('var(--hf-action)')

    const badge = exactRule(
      css,
      '.sales-pos-customer .sales-pos-customer-selected-badge',
      'color',
    )!
    expect(badge.style.getPropertyValue('color').trim()).toBe('var(--hf-action)')
    expect(badge.style.getPropertyValue('background-color').trim()).toBe('var(--hf-active-soft)')
  })
})

// ── CSS-R3 — 44px touch targets on every reached control ────────────────────

describe('CSS-R3 — controls meet the shared touch height', () => {
  const targets = [
    '.sales-pos-customer .sales-pos-customer-card',
    '.sales-pos-customer .sales-pos-customer-new-customer',
    '.sales-pos-customer .sales-pos-customer-action',
    '.sales-pos-customer .sales-pos-customer-change',
    '.sales-pos-customer .sales-pos-customer-close',
    '.sales-pos-customer-summary .sales-pos-customer-trigger',
    '.sales-pos-customer-summary .sales-pos-customer-action',
    '.sales-pos-customer-form .sales-pos-customer-form-action',
  ]

  it('sizes each reached affordance on the shared control height', () => {
    for (const selector of targets) {
      const rule = exactRule(css, selector, 'min-height')!
      expect(rule, selector).toBeDefined()
      expect(rule.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
    }
  })

  it('gives the nested select popups touch-sized options', () => {
    const option = exactRule(
      css,
      '.sales-pos-customer-form [role=option]',
      'min-height',
    )!
    expect(option).toBeDefined()
    expect(option.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
  })
})

// ── CSS-R4 — readable hierarchy, no tiny text ───────────────────────────────

describe('CSS-R4 — the contact hierarchy stays readable', () => {
  it('sizes the labelled search above the readable floor', () => {
    const label = exactRule(css, '.sales-pos-customer .sales-pos-customer-search-label', 'font-size')!
    expect(label).toBeDefined()
    expect(remValue(label.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.875)

    const input = exactRule(css, '.sales-pos-customer .sales-pos-customer-search-field input', 'font-size')!
    expect(remValue(input.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(1)
  })

  it('keeps every declared font size at or above the 12px floor', () => {
    const sizes = allDeclarations(css)
      .filter(({ property }) => property === 'font-size')
      .map(({ value }) => remValue(value))
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) {
      expect(Number.isNaN(size), `${size}`).toBe(false)
      expect(size).toBeGreaterThanOrEqual(0.75)
      expect(size).toBeLessThanOrEqual(2)
    }
  })

  it('lifts the contact card name/meta pair to a readable hierarchy', () => {
    const name = exactRule(css, '.sales-pos-customer .sales-pos-customer-card-name', 'font-size')!
    const meta = exactRule(css, '.sales-pos-customer .sales-pos-customer-card-meta', 'font-size')!
    const nameSize = remValue(name.style.getPropertyValue('font-size').trim())
    const metaSize = remValue(meta.style.getPropertyValue('font-size').trim())
    expect(nameSize).toBeGreaterThanOrEqual(0.9375)
    expect(metaSize).toBeGreaterThanOrEqual(0.8125)
    expect(nameSize).toBeGreaterThan(metaSize)
  })

  it('keeps the in-cart summary readable in both states', () => {
    const value = exactRule(css, '.sales-pos-customer-summary .sales-pos-customer-value', 'font-size')!
    expect(remValue(value.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.875)
    const address = exactRule(css, '.sales-pos-customer-summary .sales-pos-customer-address', 'font-size')!
    expect(remValue(address.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.8125)
  })
})

// ── CSS-R5 — selection, hover and focus roles are distinct ──────────────────

describe('CSS-R5 — interactive states resolve through the foundation roles', () => {
  it('separates hover from selection from focus', () => {
    const hover = exactRule(css, '.sales-pos-customer .sales-pos-customer-card:hover', 'background-color')!
    expect(hover.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface-muted)')

    const focus = exactRule(css, '.sales-pos-customer .sales-pos-customer-card:focus-visible')!
    expect(focus.style.getPropertyValue('outline-color').trim()).toBe('var(--hf-focus)')
    expect(focus.style.getPropertyValue('outline-width').trim()).not.toBe('0px')

    const active = exactRule(
      css,
      '.sales-pos-customer-form [role=option][data-highlighted]',
      'background-color',
    )!
    expect(active.style.getPropertyValue('background-color').trim()).toBe('var(--hf-active-soft)')
  })

  it('bounds the sheet and the nested forms with the card role', () => {
    const sheet = exactRule(css, '.sales-pos-customer', 'background-color')!
    expect(sheet.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    const form = exactRule(css, '.sales-pos-customer-form', 'background-color')!
    expect(form.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')

    const section = exactRule(css, '.sales-pos-customer-form .sales-pos-customer-form-section', 'border-color')!
    expect(section.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    expect(section.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-card)')
  })

  it('gives the optional map block its own quiet frame in both modes', () => {
    const map = exactRule(css, '.sales-pos-customer-form .sales-pos-customer-form-map', 'border-color')!
    expect(map.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    const title = exactRule(css, '.sales-pos-customer-form .sales-pos-customer-form-map-title', 'color')!
    expect(title.style.getPropertyValue('color').trim()).toBe('var(--hf-heading)')
  })
})

// ── CSS-R6 — the marker is forwarded by the token, not by truthiness ────────

describe('CSS-R6 — the sale token is the only gate', () => {
  it('splits the token into a dedicated marker before forwarding it', () => {
    expect(sheetSource).toContain('sales-pos-customer-form')
    // the nested wrappers accept an optional class and append it to their own
    // default; they never receive the whole portal string
    expect(customerFormSource).toMatch(/portalClass\?: string/)
    expect(addressFormSource).toMatch(/portalClass\?: string/)
    expect(customerFormSource).toContain('hf-theme hf-ui hf-form-overlay clients-form-portal')
    expect(addressFormSource).toContain('hf-theme hf-ui hf-form-overlay clients-form-portal')
  })

  it('keeps the sheet hooks in the venta template and the summary hooks in the panel', () => {
    for (const hook of [
      'sales-pos-customer-search-label',
      'sales-pos-customer-new-customer',
      'sales-pos-customer-card',
      'sales-pos-customer-card-name',
      'sales-pos-customer-card-meta',
      'sales-pos-customer-selected',
      'sales-pos-customer-selected-badge',
      'sales-pos-customer-change',
      'sales-pos-customer-action',
    ]) {
      expect(sheetSource, hook).toContain(hook)
    }
    for (const hook of [
      'sales-pos-customer-summary',
      'sales-pos-customer-trigger',
      'sales-pos-customer-label',
      'sales-pos-customer-value',
      'sales-pos-customer-name',
      'sales-pos-customer-address',
      'sales-pos-customer-action',
    ]) {
      expect(panelSource, hook).toContain(hook)
    }
  })
})
