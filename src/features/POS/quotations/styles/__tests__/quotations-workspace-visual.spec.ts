import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the Quotations workspace visual adapter.
 *
 * Creation and detail share `QuotationDetailView.vue`, so one owned stylesheet
 * covers both. These tests inspect the real local CSS and the real consumer
 * sources with a CSS/DOM parser. They prove scoping, token aliasing and
 * portal-boundary wiring at the source level. They are NOT rendered visual
 * proof and cannot establish light/dark fidelity or touch ergonomics; visual
 * smoke remains user-owned.
 */
const path = 'src/features/POS/quotations/styles/quotations-workspace-visual.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const shared = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const view = readFileSync('src/features/POS/quotations/views/QuotationDetailView.vue', 'utf8')
const stepper = readFileSync(
  'src/features/POS/quotations/components/QuotationProgressStepper.vue',
  'utf8',
)
const expiry = readFileSync(
  'src/features/POS/quotations/components/QuotationExpiryPicker.vue',
  'utf8',
)
const itemRow = readFileSync('src/features/POS/quotations/components/QuotationItemRow.vue', 'utf8')
const totalsFooter = readFileSync(
  'src/features/POS/quotations/components/QuotationTotalsFooter.vue',
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

function selectorsOf(source: string): string[] {
  return styleRules(source).flatMap((rule) => splitTopLevel(rule.selectorText))
}

function exactRule(source: string, selector: string): CSSStyleRule | undefined {
  const normalized = selector.replace(/\s+/g, ' ').trim()
  return styleRules(source).find(
    (rule) => rule.selectorText.replace(/\s+/g, ' ').trim() === normalized,
  )
}

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

describe('Quotations workspace visual adapter', () => {
  it('imports the shared adapter and scopes every rule to the owned boundary', () => {
    expect(css).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    expect(css).not.toContain('!important')
    expect(css).not.toContain(':root')
    // No new palette literals: the workspace aliases the foundation instead.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    for (const selector of selectorsOf(css)) {
      expect(selector).toMatch(/quotations-workspace-(?:visual|portal)/)
      expect(selector).not.toMatch(/^(?:\*|html|body|:root|button|input|select|textarea|a|table)\b/)
    }
    expect(selectorsOf(css).some((selector) => /^(?:\*|html|body|:root)$/.test(selector))).toBe(
      false,
    )
  })

  it('themes only the quotation-owned product header rather than the legacy page palette', () => {
    const header = exactRule(
      css,
      '.hf-theme.quotations-workspace-portal .quotations-product-search > .sticky',
    )
    expect(header).toBeDefined()
    expect(header!.style.getPropertyValue('background-color')).toContain('var(--hf-surface)')
    expect(header!.style.getPropertyValue('background-color')).not.toContain('--light-surface-page')
  })

  it('pairs active product categories and their child counts with the action foreground', () => {
    const category = exactRule(
      css,
      '.hf-theme.quotations-workspace-portal .quotations-product-search [data-testid^="category-chip-"].bg-primary',
    )
    const count = exactRule(
      css,
      '.hf-theme.quotations-workspace-portal .quotations-product-search [data-testid^="category-chip-"].bg-primary > span',
    )
    expect(category).toBeDefined()
    expect(count).toBeDefined()
    expect(category!.style.getPropertyValue('color')).toBe('var(--hf-on-action)')
    expect(count!.style.getPropertyValue('color')).toBe('var(--hf-on-action)')
    expect(count!.style.getPropertyValue('background-color')).toContain('var(--hf-on-action)')
  })

  it('uses operational and supporting ink for product prices and variant counts', () => {
    const price = exactRule(
      css,
      '.hf-theme.quotations-workspace-portal .quotations-product-search p.tabular-nums',
    )
    const variants = exactRule(
      css,
      '.hf-theme.quotations-workspace-portal .quotations-product-search p[class~="text-(--brand-primary)"]',
    )
    expect(price).toBeDefined()
    expect(variants).toBeDefined()
    expect(price!.style.getPropertyValue('color')).toBe('var(--hf-ink)')
    expect(variants!.style.getPropertyValue('color')).toBe('var(--hf-muted)')
  })

  it('preserves the mobile add-action soft/solid distinction with the dark foreground pair', () => {
    const light = exactRule(
      css,
      '.hf-theme.quotations-workspace-portal .quotations-product-search [data-testid="add-action"]',
    )
    const dark = exactRule(
      css,
      '.dark .hf-theme.quotations-workspace-portal .quotations-product-search [data-testid="add-action"]',
    )
    expect(light).toBeDefined()
    expect(dark).toBeDefined()
    expect(light!.style.getPropertyValue('background-color')).toBe('var(--hf-active-soft)')
    expect(light!.style.getPropertyValue('color')).toBe('var(--hf-action)')
    expect(dark!.style.getPropertyValue('background-color')).toBe('var(--hf-action)')
    expect(dark!.style.getPropertyValue('color')).toBe('var(--hf-on-action)')
  })

  it('rejects unowned product panels and never recolors stock-danger badges', () => {
    const host = document.createElement('div')
    host.className = 'dark'
    host.innerHTML = `<div class="hf-theme hf-ui quotations-workspace-portal">
      <div class="quotations-product-search">
        <button class="bg-primary text-white" data-testid="category-chip-todo"><span>3</span></button>
        <p class="tabular-nums">$10.00</p>
        <p class="text-(--brand-primary)">2 variantes</p>
        <button data-testid="add-action">Agregar</button>
        <span class="text-(--brand-danger)" data-testid="stock-badge">#1</span>
      </div>
    </div>
    <div class="hf-theme hf-ui"><div class="quotations-product-search">
      <button data-testid="add-action">Agregar</button>
    </div></div>`
    document.body.append(host)
    try {
      const selectors = selectorsOf(css).filter((selector) =>
        selector.includes('quotations-product-search'),
      )
      expect(selectors.length).toBeGreaterThan(0)
      const optedAction = host.querySelector(
        '.quotations-workspace-portal [data-testid="add-action"]',
      )!
      const inertAction = host.querySelector(
        '.hf-ui:not(.quotations-workspace-portal) [data-testid="add-action"]',
      )!
      const stock = host.querySelector('[data-testid="stock-badge"]')!
      expect(selectors.some((selector) => optedAction.matches(selector))).toBe(true)
      expect(selectors.some((selector) => inertAction.matches(selector))).toBe(false)
      expect(selectors.some((selector) => stock.matches(selector))).toBe(false)
    } finally {
      host.remove()
    }
  })

  it('aliases the legacy Coco roles to foundation semantics inside the boundary only', () => {
    const scope = exactRule(css, '.quotations-workspace-visual')!
    expect(scope).toBeDefined()

    const expected: Record<string, string> = {
      '--coco-primary': 'var(--hf-action)',
      '--coco-accent': 'var(--hf-gold)',
      '--coco-accent-50': 'var(--hf-gold-soft)',
      '--coco-card': 'var(--hf-surface)',
      '--coco-border': 'var(--hf-border)',
      '--coco-text': 'var(--hf-ink)',
      '--coco-text-tertiary': 'var(--hf-muted)',
      '--coco-success': 'var(--hf-success)',
    }
    for (const [property, value] of Object.entries(expected)) {
      expect(scope.style.getPropertyValue(property).trim()).toBe(value)
    }

    // Every legacy alias declared here must resolve through a foundation role;
    // a raw color value would fork the palette.
    const customProperties = Array.from({ length: scope.style.length }, (_, index) =>
      scope.style.item(index),
    ).filter((property) => property.startsWith('--coco-'))
    expect(customProperties.length).toBeGreaterThan(0)
    for (const property of customProperties) {
      expect(scope.style.getPropertyValue(property).trim()).toMatch(/^var\(--hf-[a-z-]+\)$/)
    }

    // Info and destructive roles stay on their existing semantic values.
    expect(css).not.toMatch(/--(?:coco|ui|color)-(?:info|danger|error|warning)\s*:/)
  })

  it('restrains the legacy radius ramp without flattening circles', () => {
    const scope = exactRule(css, '.quotations-workspace-visual')!
    expect(scope.style.getPropertyValue('--radius-md').trim()).toBe('var(--hf-radius-control)')
    expect(scope.style.getPropertyValue('--radius-lg').trim()).toBe('var(--hf-radius-control)')
    expect(scope.style.getPropertyValue('--radius-xl').trim()).toBe('var(--hf-radius-card)')
    expect(css).not.toContain('--radius-full')
  })

  it('pairs the workspace primary actions with the action foreground role', () => {
    const primary = exactRule(css, '.quotations-workspace-visual .quotations-primary-action')!
    expect(primary).toBeDefined()
    expect(primary.style.getPropertyValue('color').trim()).toBe('var(--hf-on-action)')
    expect(primary.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')

    // The two in-scope CTAs opt into the pairing.
    expect(view).toContain('quotations-primary-action')
    expect(totalsFooter).toContain('quotations-primary-action')
  })

  it('keeps gold-family text readable in both modes through foundation roles', () => {
    const ink = exactRule(css, '.quotations-workspace-visual .quotations-gold-ink')!
    expect(ink).toBeDefined()
    expect(ink.style.getPropertyValue('color').trim()).toBe('var(--hf-gold-ink)')

    const fill = exactRule(css, '.quotations-workspace-visual .quotations-gold-fill')!
    expect(fill).toBeDefined()
    const darkFill = exactRule(css, '.dark .quotations-workspace-visual .quotations-gold-fill')!
    expect(darkFill).toBeDefined()
    expect([fill, darkFill].map((rule) => rule.style.getPropertyValue('color').trim())).toEqual([
      'var(--hf-gold-ink)',
      'var(--hf-gold-soft)',
    ])
  })

  it('paints the feature portal on the foundation surface and rejects unmarked portals', () => {
    const portal = exactRule(css, '.hf-theme.quotations-workspace-portal')!
    expect(portal).toBeDefined()
    expect(portal.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(portal.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    expect(portal.style.getPropertyValue('color').trim()).toBe('var(--hf-ink)')

    // Teleported overlays put `hf-theme hf-ui ... quotations-workspace-portal`
    // on one element, so the self-root selector is the one that matches.
    const fixture = document.createElement('div')
    fixture.className = 'hf-theme hf-ui hf-form-overlay quotations-workspace-portal'
    document.body.append(fixture)
    expect(fixture.matches(portal.selectorText)).toBe(true)

    // The shared `hf-ui` adapter already maps the semantic aliases on that
    // same element, so the native header/body/footer inherit them.
    const adapter = styleRules(shared).find((rule) => rule.selectorText.trim() === '.hf-ui')!
    expect(fixture.matches(adapter.selectorText)).toBe(true)

    // Negative control: a shared boundary without the feature marker must not
    // inherit the feature portal paint.
    const unmarked = document.createElement('div')
    unmarked.className = 'hf-theme hf-ui'
    document.body.append(unmarked)
    expect(unmarked.matches(portal.selectorText)).toBe(false)

    // A nested select listbox carries the same marker without the overlay.
    const listbox = document.createElement('div')
    listbox.className = 'hf-theme hf-ui quotations-workspace-portal'
    document.body.append(listbox)
    expect(listbox.matches(portal.selectorText)).toBe(true)

    fixture.remove()
    unmarked.remove()
    listbox.remove()
  })

  it('exposes the workspace marker for a runtime opt-in fixture', () => {
    const scope = exactRule(css, '.quotations-workspace-visual')!
    const fixture = document.createElement('div')
    fixture.className = 'hf-theme hf-ui quotations-workspace-visual'
    document.body.append(fixture)
    expect(fixture.matches(scope.selectorText)).toBe(true)

    const adapter = styleRules(shared).find((rule) => rule.selectorText.trim() === '.hf-ui')!
    expect(fixture.matches(adapter.selectorText)).toBe(true)
    fixture.remove()
  })
})

describe('Quotations visual wiring', () => {
  it('imports the adapter only from the shared creation/detail view', () => {
    expect(view).toContain("import '../styles/quotations-workspace-visual.css'")
    // The legacy Coco tokens stay untouched and read-only.
    expect(view).toContain("import '../styles/coco-tokens.css'")
    expect(css).toContain('.quotations-workspace-visual')
    expect(css).not.toContain('.quotations-list-view')
    expect(css).not.toContain('products-visual')
    expect(css).not.toContain('clients-visual')
  })

  it('marks the workspace root and every feature-owned form portal', () => {
    expect(view).toMatch(/class="quotation-detail-view hf-theme hf-ui quotations-workspace-visual/)
    expect(view).toContain('hf-theme hf-ui hf-form-overlay quotations-workspace-portal')
    expect(view).toContain('hf-theme hf-ui quotations-workspace-portal')
    expect(view).not.toContain('hf-shell-products-portal')
    expect(view).not.toContain('clients-form-portal')
  })

  it('routes the progress and shortcut renderer hooks through the foundation roles', () => {
    expect(stepper).toContain('quotations-gold-fill')
    expect(stepper).toContain('quotations-gold-ink')
    expect(expiry).toContain('quotations-gold-ink')
    expect(itemRow).toContain('hf-theme hf-ui quotations-workspace-portal')
    expect(totalsFooter).toContain('hf-theme hf-ui quotations-workspace-portal')
  })
})
