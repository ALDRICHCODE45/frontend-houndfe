import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the Sales entry checkout / support-window composition
 * (T3 / S1-S5).
 *
 * This adapter composes the reached checkout surfaces only: it is imported
 * exclusively from `PaymentModal.vue` (which `SalesView` imports statically),
 * every rule is scoped to the owned `.sales-pos-checkout` marker that the
 * checkout callers APPEND to their existing opt-in portal class, and it reuses
 * the already-accepted `.sales-entry-portal` colour paint instead of repeating
 * palette work. It must never repaint another module, the shared variants /
 * price / product consumers, or the protected entry stylesheet.
 *
 * These are source/CSSOM contracts. They do not prove browser fidelity,
 * measured contrast, media-query rendering or touch ergonomics. Visual smoke
 * remains user-owned.
 */
const path = 'src/features/POS/sales/styles/sales-pos-checkout.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
/** Declarations only: comments must not satisfy or defeat textual assertions. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

const OWNER = 'PaymentModal.vue'
const ownerSource = readFileSync(`src/features/POS/sales/components/${OWNER}`, 'utf8')

const OTHER_COMPONENTS = [
  'PaymentSuccessModal',
  'PromotionCapacityRequoteModal',
  'GlobalDiscountModal',
  'ItemDiscountModal',
  'PriceOverrideModal',
  'ProductDetailModal',
  'VariantPickerModal',
  'PriceListSelector',
  'CashSaleSessionPicker',
]
const componentSources = OTHER_COMPONENTS.map((name) => ({
  name,
  source: readFileSync(`src/features/POS/sales/components/${name}.vue`, 'utf8'),
}))

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

// ── CSS-R1 — one feature-owned adapter, owned marker only ───────────────────

describe('CSS-R1 — the checkout adapter owns its boundary', () => {
  it('imports the shared foundation, is imported only from PaymentModal, and scopes every rule', () => {
    expect(css).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    expect(declarations).not.toContain(':root')
    expect(css.length).toBeGreaterThan(0)

    // Imported exclusively from PaymentModal (the statically imported checkout
    // entry); every other checkout surface receives the marker as a class.
    expect(ownerSource).toContain("import '../styles/sales-pos-checkout.css'")
    for (const { name, source } of componentSources) {
      expect(source, `${name} must not import the checkout stylesheet`).not.toContain(
        'sales-pos-checkout.css',
      )
    }

    const selectors = selectorsOf(css)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toMatch(/sales-pos-checkout/)
      expect(selector).not.toMatch(/^(?:\*|html|body|button|input|select|textarea|a|table)\b/)
      expect(selector.trim()).not.toBe('*')
    }
  })

  it('never repaints the protected entry adapter or another module', () => {
    for (const foreign of [
      'sales-entry-visual',
      'sales-entry-portal',
      'sales-pos-workspace',
      'sales-pos-cart',
      'sales-detail',
      'sales-list',
      'quotations',
      'cash-visual',
      'products-visual',
      'clients-visual',
    ]) {
      expect(declarations, `must not target ${foreign}`).not.toContain(foreign)
    }
  })
})

// ── CSS-R2 — semantic roles only, no palette literals, no wildcard ──────────

describe('CSS-R2 — colour resolves through the foundation roles', () => {
  it('declares no raw colour literal and no global wildcard', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    for (const { property, value } of allDeclarations(css)) {
      expect(`${property}:${value}`).not.toMatch(/\brgba?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\bhsla?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\boklch\(/i)
      expect(`${property}:${value}`).not.toMatch(/\b(?:white|black)\b/i)
    }
    expect(declarations).not.toMatch(/(^|[{};\s,])\*\s*(?:[,{])/)
    expect(selectorsOf(css).some((selector) => selector.includes('*'))).toBe(false)
  })

  it('paints the reached surfaces with hf roles', () => {
    const painted = allDeclarations(css).filter(({ property }) =>
      /(background-color|border-color|border-top-color|color|box-shadow)$/.test(property),
    )
    expect(painted.length).toBeGreaterThan(0)
    for (const { value } of painted) {
      const semantic = value === 'transparent' || value.includes('var(--hf-')
      expect(semantic, `unexpected colour value: ${value}`).toBe(true)
    }
  })
})

// ── CSS-R3 — compact readable total header, scrollable body, fixed footer ───

describe('CSS-R3 — the sheet keeps a compact header, scrollable body and reachable footer', () => {
  it('keeps the total header compact and readable', () => {
    const amount = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-total > p:last-child',
      'font-size',
    )!
    expect(amount).toBeDefined()
    const size = remValue(amount.style.getPropertyValue('font-size').trim())
    expect(size).toBeGreaterThanOrEqual(2)
    expect(size).toBeLessThanOrEqual(2.5)

    const label = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-total > p:first-child',
      'font-size',
    )!
    expect(label).toBeDefined()
    expect(remValue(label.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.75)
  })

  it('scrolls the body and anchors the footer outside it', () => {
    const body = exactRule(css, '.sales-pos-checkout .sales-pos-checkout-body', 'overflow-y')!
    expect(body).toBeDefined()
    expect(body.style.getPropertyValue('overflow-y').trim()).toBe('auto')
    // CSSOM normalizes the authored `0` to `0px`; assert the numeric value.
    expect(Number.parseFloat(body.style.getPropertyValue('min-height').trim())).toBe(0)

    const footer = exactRule(css, '.sales-pos-checkout .sales-pos-checkout-footer', 'flex-shrink')!
    expect(footer).toBeDefined()
    expect(footer.style.getPropertyValue('flex-shrink').trim()).toBe('0')
  })
})

// ── CSS-R4 — method tiles: touch target and distinct selection ──────────────

describe('CSS-R4 — method tiles are touch-sized and use the action selection pair', () => {
  it('sizes the tiles on the shared control height', () => {
    const tile = exactRule(css, '.sales-pos-checkout .sales-pos-checkout-method-tile', 'min-height')!
    expect(tile).toBeDefined()
    expect(tile.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
  })

  it('pairs the selected tile with the action/active roles, not a status colour', () => {
    const selected = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-method-tile[data-sales-pos-checkout-state=selected]',
      'background-color',
    )!
    expect(selected).toBeDefined()
    expect(selected.style.getPropertyValue('background-color').trim()).toBe('var(--hf-active-soft)')
    expect(selected.style.getPropertyValue('border-color').trim()).toBe('var(--hf-action)')
  })
})

// ── CSS-R5 — stacked payment fields stay readable ───────────────────────────

describe('CSS-R5 — payment entries keep readable stacked fields', () => {
  it('uses the card radius/surface and a readable field size', () => {
    const entry = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-payment-entry',
      'border-radius',
    )!
    expect(entry).toBeDefined()
    expect(entry.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-card)')
    expect(entry.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface-muted)')

    const field = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-payment-entry input',
      'font-size',
    )!
    expect(field).toBeDefined()
    expect(remValue(field.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.875)
  })
})

// ── CSS-R6 — Caja session, lost binding and accessible pagination ───────────

describe('CSS-R6 — the Caja session choice stays readable and paginated', () => {
  it('keeps the pagination controls touch-sized', () => {
    const prev = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-cash-session [data-testid=cash-session-prev-page]',
      'min-height',
    )!
    const next = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-cash-session [data-testid=cash-session-next-page]',
      'min-height',
    )!
    expect(prev).toBeDefined()
    expect(next).toBeDefined()
    expect(prev.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
    expect(next.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
  })

  it('keeps the lost-binding decision on the warning role', () => {
    const lost = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-binding-lost',
      'background-color',
    )!
    expect(lost).toBeDefined()
    expect(lost.style.getPropertyValue('background-color').trim()).toBe('var(--hf-warning-soft)')
  })
})

// ── CSS-R7 — due date and delivery grouped without new nesting ──────────────

describe('CSS-R7 — due date and delivery are separated by a quiet rule', () => {
  it('separates both optional groups with a semantic divider', () => {
    for (const selector of [
      '.sales-pos-checkout .sales-pos-checkout-due-date',
      '.sales-pos-checkout .sales-pos-checkout-delivery',
    ]) {
      const rule = exactRule(css, selector)!
      expect(rule, selector).toBeDefined()
      expect(rule.style.getPropertyValue('border-top').trim()).toBe('1px solid var(--hf-border)')
    }
  })
})

// ── CSS-R8 — supporting windows keep one consistent surface ─────────────────

describe('CSS-R8 — discount/price/product/variant windows share one surface', () => {
  it('borders the shared window hook with the foundation border', () => {
    const window = exactRule(css, '.sales-pos-checkout .sales-pos-checkout-window', 'border-color')!
    expect(window).toBeDefined()
    expect(window.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
  })

  it('keeps variant rows touch-sized and internally scrollable', () => {
    const row = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-variant-row',
      'min-height',
    )!
    expect(row).toBeDefined()
    expect(row.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')

    const list = exactRule(
      css,
      '.sales-pos-checkout .sales-pos-checkout-variant-list',
      'overflow-y',
    )!
    expect(list).toBeDefined()
    expect(list.style.getPropertyValue('overflow-y').trim()).toBe('auto')
  })
})

// ── CSS-R9 — success and re-quote decision surfaces ─────────────────────────

describe('CSS-R9 — success and re-quote windows resolve through the foundation', () => {
  it('gives both decision surfaces an owned border role', () => {
    for (const selector of [
      '.sales-pos-checkout .sales-pos-checkout-success',
      '.sales-pos-checkout .sales-pos-checkout-requote',
    ]) {
      const rule = exactRule(css, selector, 'border-color')!
      expect(rule, selector).toBeDefined()
      expect(rule.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    }
  })
})
