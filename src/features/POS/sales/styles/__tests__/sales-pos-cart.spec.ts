import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the sales cart composition adapter (T11 / unit B).
 *
 * `sales-pos-cart.css` is the cart-only composition adapter: it is imported
 * exclusively from `ActiveSalePanel.vue` (never from `SalesView.vue`, the
 * catalog, or the row/footer children) and every rule is governed by the new
 * exact-token root marker `.sales-pos-cart-composition`. That marker is added
 * to the panel root only when the forwarded `portalClass` carries the exact
 * `sales-entry-portal` token, so omitted and unrelated opt-ins keep the prior
 * presentation byte for byte.
 *
 * The adapter makes the cart panel the single 12px surface (the desktop pane
 * wrapper stays neutral), turns the item rows into divider-separated rows
 * instead of nested rounded cards, and keeps the scroll body bounded with the
 * totals/charge region available.
 *
 * These are source/CSSOM contracts. They do not prove browser fidelity,
 * measured contrast, media-query rendering or touch ergonomics. Visual smoke
 * remains user-owned.
 */
const path = 'src/features/POS/sales/styles/sales-pos-cart.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
/** Declarations only: comments must not satisfy or defeat textual assertions. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
const root = 'sales-pos-cart-composition'

const components = [
  'ActiveSalePanel',
  'SaleItemRow',
  'SaleTotalsFooter',
  'PromocionesDisponiblesAccordion',
] as const
const componentSources = Object.fromEntries(
  components.map((name) => [
    name,
    readFileSync(`src/features/POS/sales/components/${name}.vue`, 'utf8'),
  ]),
) as Record<(typeof components)[number], string>
const view = readFileSync('src/features/POS/sales/views/SalesView.vue', 'utf8')

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

/** cssstyle normalizes zero lengths to `0px`/`0%`; treat them as zero. */
function isZero(value: string): boolean {
  return value === '0' || value === '0px' || value === '0%'
}

/**
 * The shorthand may be normalized into its longhands by the CSSOM, so read the
 * first non-empty declaration among the accepted spellings.
 */
function declared(rule: CSSStyleRule, ...properties: string[]): string {
  for (const property of properties) {
    const value = rule.style.getPropertyValue(property).trim()
    if (value) return value
  }
  return ''
}

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

// ── R1 — one cart-owned adapter, owned boundary only ────────────────────────

describe('R1 — the cart adapter owns its boundary', () => {
  it('exists, imports the shared foundation, and is imported from ActiveSalePanel only', () => {
    expect(existsSync(path), `${path} must exist`).toBe(true)
    expect(css.length).toBeGreaterThan(0)
    expect(css).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    // Declarations only: the prose comment may mention a token it forbids.
    expect(declarations).not.toContain(':root')

    expect(componentSources.ActiveSalePanel).toContain("import '../styles/sales-pos-cart.css'")
    for (const name of ['SaleItemRow', 'SaleTotalsFooter', 'PromocionesDisponiblesAccordion'] as const) {
      expect(componentSources[name], `${name} must not import the cart adapter`).not.toContain(
        'sales-pos-cart.css',
      )
    }
    // The workspace/catalog writer owns SalesView; unit B must not import there.
    expect(view).not.toContain("sales-pos-cart.css'")
  })

  it('scopes every rule to the new exact-token composition root', () => {
    const selectors = selectorsOf(css)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector, `unscoped selector: ${selector}`).toContain(root)
      expect(selector).not.toMatch(/^(?:\*|html|body|button|input|select|textarea|a|table)\b/)
      expect(selector.trim()).not.toBe('*')
    }
    // No universal selector and no forced declaration anywhere in the file.
    expect(declarations).not.toMatch(/(^|[{};\s,])\*\s*(?:[,{])/)
    expect(declarations).not.toContain('!important')
  })

  it('never repaints a foreign module or the protected entry/workspace adapters', () => {
    for (const foreign of [
      'sales-entry-visual',
      'sales-entry-portal',
      'sales-pos-workspace',
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

// ── R2 — semantic roles only, no palette literals ───────────────────────────

describe('R2 — colour resolves through the foundation roles', () => {
  it('declares no raw colour literal', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    for (const { property, value } of allDeclarations(css)) {
      expect(`${property}:${value}`).not.toMatch(/\brgba?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\bhsla?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\boklch\(/i)
      expect(`${property}:${value}`).not.toMatch(/\b(?:white|black)\b/i)
    }
  })

  it('paints the reached surfaces with hf roles', () => {
    const painted = allDeclarations(css).filter(({ property }) =>
      /(background-color|border-color|border-top-color|border-bottom-color|color|box-shadow|border-block|border-bottom)$/.test(
        property,
      ),
    )
    expect(painted.length).toBeGreaterThan(0)
    for (const { value } of painted) {
      // `currentcolor`/fully transparent zeros come from the CSSOM expanding a
      // border shorthand reset; they are not palette literals.
      const semantic =
        value === 'transparent' ||
        value === 'rgba(0, 0, 0, 0)' ||
        value === 'currentcolor' ||
        value === 'none' ||
        isZero(value) ||
        value.includes('var(--hf-') ||
        value.startsWith('color-mix(in srgb, var(--hf-')
      expect(semantic, `unexpected colour value: ${value}`).toBe(true)
    }
  })
})

// ── R3 — the cart panel is the single bounded 12px surface ──────────────────

describe('R3 — the composition root is the sole cart surface', () => {
  it('owns the 12px card surface and never forces a fixed min-height', () => {
    const surface = exactRule(css, `.${root}`)!
    expect(surface, 'the composition root needs an owned surface rule').toBeDefined()
    expect(surface.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(surface.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    expect(surface.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-card)')
    expect(surface.style.getPropertyValue('overflow').trim()).toBe('hidden')
    // A fixed min-height would break a short viewport; the cart fills its pane.
    for (const property of ['min-height', 'height']) {
      const value = surface.style.getPropertyValue(property).trim()
      expect(value, `the composition root must not fix ${property}`).toBe('')
    }
  })

  it('keeps the mobile drawer sheet free of a second card', () => {
    const sheet = exactRule(css, `.${root}.${root}-sheet`)!
    expect(sheet, 'the mobile sheet variant needs a reset rule').toBeDefined()
    expect(isZero(sheet.style.getPropertyValue('border-radius').trim())).toBe(true)
    expect(isZero(sheet.style.getPropertyValue('border-width').trim())).toBe(true)
  })
})

// ── R4 — rows are dividers, not nested rounded cards ────────────────────────

describe('R4 — cart rows read as divider-separated lines', () => {
  const rowSelector = `.${root} .sales-pos-cart-row`

  it('removes the nested card box and separates the rows with a divider', () => {
    const row = exactRule(css, rowSelector)!
    expect(row, 'the owned row rule is required').toBeDefined()
    expect(isZero(row.style.getPropertyValue('border-radius').trim())).toBe(true)
    expect(isZero(row.style.getPropertyValue('margin-inline').trim())).toBe(true)
    expect(declared(row, 'border-bottom', 'border-bottom-color')).toContain('var(--hf-border)')
  })

  it('keeps the row media a bounded square and the line total readable', () => {
    const media = exactRule(css, `.${root} .sales-pos-cart-row .sales-pos-cart-row-media`)!
    expect(media, 'the row media needs a bounded size').toBeDefined()
    expect(remValue(media.style.getPropertyValue('width').trim()) || 3).toBeGreaterThanOrEqual(2.5)

    const line = exactRule(css, `.${root} .sales-pos-cart-row-line`)!
    expect(line, 'the line total needs an owned rule').toBeDefined()
    expect(remValue(line.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.9375)
  })
})

// ── R5 — heading, price-list band and cart chrome ───────────────────────────

describe('R5 — heading and price-list band follow the accepted composition', () => {
  it('styles the heading, its count and the supporting line', () => {
    expect(componentSources.ActiveSalePanel).toContain('sales-pos-cart-heading')
    const heading = exactRule(css, `.${root} .sales-pos-cart-heading`)!
    expect(heading).toBeDefined()
    expect(heading.style.getPropertyValue('padding').trim()).not.toBe('')

    const title = exactRule(css, `.${root} .sales-pos-cart-title`)!
    expect(title).toBeDefined()
    expect(remValue(title.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(1)

    const count = exactRule(css, `.${root} .sales-pos-cart-count`)!
    expect(count).toBeDefined()
    expect(count.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface-muted)')

    const support = exactRule(css, `.${root} .sales-pos-cart-support`)!
    expect(support).toBeDefined()
    expect(remValue(support.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.75)
  })

  it('separates the price-list band with a border block', () => {
    expect(componentSources.ActiveSalePanel).toContain('sales-pos-price-list-band')
    const band = exactRule(css, `.${root} .sales-pos-price-list-band`)!
    expect(band).toBeDefined()
    expect(declared(band, 'border-block', 'border-top-color', 'border-bottom-color')).toContain(
      'var(--hf-border)',
    )
    expect(band.style.getPropertyValue('background-color').trim().startsWith('color-mix(in srgb,')).toBe(
      true,
    )
  })

  it('keeps the customer context a divider band, not another rounded card', () => {
    const summary = exactRule(
      css,
      `.${root} .sales-pos-cart-footer .sales-pos-customer-summary`,
    )!
    expect(summary, 'the customer summary needs an owned divider rule').toBeDefined()
    expect(isZero(summary.style.getPropertyValue('border-radius').trim())).toBe(true)
    expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(
      summary.style.getPropertyValue('background-color').trim(),
    )
  })
})

// ── R6 — bounded scroll body, available totals and full-width charge ────────

describe('R6 — the body scrolls and the actions stay available', () => {
  it('bounds the scrolling body without a fixed empty box', () => {
    const body = exactRule(css, `.sales-pos-cart-panel.${root} .sales-pos-cart-body`)!
    expect(body).toBeDefined()
    expect(isZero(body.style.getPropertyValue('min-height').trim())).toBe(true)
    expect(body.style.getPropertyValue('padding-inline').trim()).not.toBe('')

    const empty = exactRule(css, `.${root} .sales-pos-cart-empty`)!
    expect(empty, 'the empty state must not keep a full-height box').toBeDefined()
    const minHeight = empty.style.getPropertyValue('min-height').trim()
    expect(minHeight === '' || isZero(minHeight)).toBe(true)
  })

  it('keeps the totals region anchored and the charge action full width at 44px', () => {
    // S11 raised the owned totals rule to 0-3-0 so it outranks the workspace
    // adapter's divider in either stylesheet order.
    const totals = exactRule(css, `.sales-pos-cart-panel.${root} .sales-pos-totals`)!
    expect(totals).toBeDefined()

    const charge = exactRule(css, `.${root} .sales-pos-charge-button`)!
    expect(charge, 'the charge action needs an owned full-width rule').toBeDefined()
    expect(charge.style.getPropertyValue('width').trim()).toBe('100%')

    const control = allDeclarations(css).find(
      ({ property, value }) =>
        property === 'min-height' && value === 'var(--hf-control-height)',
    )
    expect(control, 'the cart must keep the shared 44px control height').toBeDefined()
  })
})
