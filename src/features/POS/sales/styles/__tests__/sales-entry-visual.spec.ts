import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the Sales entry (Venta) visual adapter — T3 / S1, S3-S5.
 *
 * The workspace keeps its accepted composition: the catalog/cart split
 * (60/40 at lg, 75/25 at xl), the tab strip, the cart chrome, the F8 and
 * Ctrl/⌘+K shortcuts and the mobile drawer → payment sequencing. This spec
 * proves the presentation wiring at the source level with a CSS parser and the
 * real consumer sources:
 *
 *   - one feature-owned stylesheet, scoped to the owned boundary only;
 *   - the shared `hf-theme hf-ui` foundation roles, no new palette literals;
 *   - portal opt-ins on the real native content roots (the runtime half lives
 *     in `SalesEntryPortalTheme.spec.ts`);
 *   - the two forced legacy utilities are repaired narrowly, not blanket.
 *
 * These assertions are NOT rendered visual proof: they cannot establish light/
 * dark fidelity, contrast or touch ergonomics. Visual smoke remains user-owned.
 */
const path = 'src/features/POS/sales/styles/sales-entry-visual.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
/** Declarations only: comments must not satisfy or defeat textual assertions. */
const cssDeclarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
const shared = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const view = readFileSync('src/features/POS/sales/views/SalesView.vue', 'utf8')
const drawer = readFileSync('src/core/shared/components/AppResponsiveDrawer.vue', 'utf8')
const activePanel = readFileSync('src/features/POS/sales/components/ActiveSalePanel.vue', 'utf8')
const itemRow = readFileSync('src/features/POS/sales/components/SaleItemRow.vue', 'utf8')
const totalsFooter = readFileSync('src/features/POS/sales/components/SaleTotalsFooter.vue', 'utf8')
const paymentModal = readFileSync('src/features/POS/sales/components/PaymentModal.vue', 'utf8')
const successModal = readFileSync(
  'src/features/POS/sales/components/PaymentSuccessModal.vue',
  'utf8',
)
const requoteModal = readFileSync(
  'src/features/POS/sales/components/PromotionCapacityRequoteModal.vue',
  'utf8',
)
const sessionPicker = readFileSync(
  'src/features/POS/sales/components/CashSaleSessionPicker.vue',
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
  // A rule may group several selectors; the owned boundary is one of them.
  const candidates = styleRules(source).filter((rule) =>
    splitTopLevel(rule.selectorText).some((part) => normalize(part) === expected),
  )
  if (!property) return candidates[0]
  // Several grouped rules can name the same boundary, so pick the one that
  // actually declares the property under test.
  return candidates.find((rule) => rule.style.getPropertyValue(property).trim() !== '')
}

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

describe('Sales entry visual adapter — stylesheet', () => {
  it('imports the shared adapter and scopes every rule to the owned boundary', () => {
    expect(css).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    expect(css).not.toContain(':root')
    // No new palette literals: the boundary aliases the foundation instead.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    const selectors = selectorsOf(css)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toMatch(/sales-entry-(?:visual|portal)/)
      expect(selector).not.toMatch(
        /^(?:\*|html|body|:root|button|input|select|textarea|a|table)\b/,
      )
    }
  })

  it('carries no forced utilities to repair and no !important', () => {
    // The shared customer sheet and payment surfaces now take --hf roles
    // directly, so the adapter has nothing legacy left to override.
    expect(css).not.toContain('!important')
    expect(css).not.toContain('open-create-customer')
  })

  it('paints the in-page workspace boundary on the foundation page canvas', () => {
    const workspace = exactRule(css, '.hf-theme.sales-entry-visual', 'background-color')!
    expect(workspace).toBeDefined()
    expect(workspace.style.getPropertyValue('background-color').trim()).toBe('var(--hf-page)')
    expect(workspace.style.getPropertyValue('color').trim()).toBe('var(--hf-ink)')

    const page = exactRule(css, '.hf-theme.sales-entry-visual > .sales-entry-page')!
    expect(page).toBeDefined()
    expect(page.style.getPropertyValue('background-color').trim()).toBe('var(--hf-page)')

    const panel = exactRule(css, '.hf-theme.sales-entry-visual .sales-entry-panel')!
    expect(panel).toBeDefined()
    expect(panel.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(panel.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
  })

  it('restrains the legacy radius ramp without flattening the mobile sheet', () => {
    const workspaceRamp = exactRule(css, '.hf-theme.sales-entry-visual', '--radius-md')!
    const portalRamp = exactRule(css, '.hf-theme.sales-entry-portal', '--radius-md')!
    for (const rule of [workspaceRamp, portalRamp]) {
      expect(rule.style.getPropertyValue('--radius-md').trim()).toBe(
        'var(--hf-radius-control)',
      )
      expect(rule.style.getPropertyValue('--radius-lg').trim()).toBe('var(--hf-radius-card)')
      expect(rule.style.getPropertyValue('--radius-xl').trim()).toBe('var(--hf-radius-card)')
      // The mobile sheet keeps `rounded-t-2xl`, so 2xl/3xl/full are untouched.
      expect(rule.style.getPropertyValue('--radius-2xl')).toBe('')
      expect(rule.style.getPropertyValue('--radius-3xl')).toBe('')
    }
    expect(cssDeclarations).not.toContain('--radius-full')
  })

  it('paints the portal boundary and rejects unmarked teleports', () => {
    const portal = exactRule(css, '.hf-theme.sales-entry-portal', 'background-color')!
    expect(portal).toBeDefined()
    expect(portal.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(portal.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    expect(portal.style.getPropertyValue('color').trim()).toBe('var(--hf-ink)')

    // Teleported entry surfaces put `hf-theme hf-ui ... sales-entry-portal` on
    // one element, so the self-root selector is the one that matches.
    const fixture = document.createElement('div')
    fixture.className = 'hf-theme hf-ui sales-entry-portal'
    document.body.append(fixture)
    expect(fixture.matches(portal.selectorText)).toBe(true)

    // The shared `hf-ui` adapter already maps the semantic aliases on that same
    // element, so the native header/body/footer inherit them.
    const adapter = styleRules(shared).find((rule) => rule.selectorText.trim() === '.hf-ui')!
    expect(fixture.matches(adapter.selectorText)).toBe(true)

    // Negative control: a shared boundary without the feature marker must not
    // inherit the feature portal paint.
    const unmarked = document.createElement('div')
    unmarked.className = 'hf-theme hf-ui'
    document.body.append(unmarked)
    expect(unmarked.matches(portal.selectorText)).toBe(false)

    fixture.remove()
    unmarked.remove()
  })

  it('pairs the entry primary actions with the action foreground in both scopes', () => {
    const inline = exactRule(css, '.sales-entry-visual .sales-entry-primary-action')!
    expect(inline).toBeDefined()
    expect(inline.style.getPropertyValue('background-color').trim()).toBe('var(--hf-action)')
    expect(inline.style.getPropertyValue('color').trim()).toBe('var(--hf-on-action)')

    const portal = exactRule(css, '.hf-theme.sales-entry-portal .sales-entry-primary-action')!
    expect(portal).toBeDefined()
    expect(portal.style.getPropertyValue('background-color').trim()).toBe('var(--hf-action)')
    expect(portal.style.getPropertyValue('color').trim()).toBe('var(--hf-on-action)')
  })

  it('declares no legacy coco palette aliases', () => {
    expect(css).not.toMatch(/--color-coco-/)
    expect(css).not.toContain('text-coco-gold')
  })

  it('themes the protected shared product search through the caller class only', () => {
    const header = exactRule(
      css,
      '.hf-theme.sales-entry-visual .sales-entry-product-search > .sticky',
    )!
    expect(header).toBeDefined()
    expect(header.style.getPropertyValue('background-color')).toContain('var(--hf-surface)')
    expect(header.style.getPropertyValue('background-color')).not.toContain('--light-surface-page')

    const price = exactRule(
      css,
      '.hf-theme.sales-entry-visual .sales-entry-product-search p.tabular-nums',
    )!
    expect(price).toBeDefined()
    expect(price.style.getPropertyValue('color').trim()).toBe('var(--hf-ink)')
    // The variant count takes --hf-muted in the component itself.
    expect(css).not.toContain('--brand-primary')
  })

  it('leaves chip and add-action paint to the components', () => {
    expect(css).not.toContain('category-chip-')
    expect(css).not.toContain('add-action')
  })

  it('rejects unowned panels and never recolors stock-danger semantics', () => {
    const host = document.createElement('div')
    host.className = 'dark'
    host.innerHTML = `<div class="hf-theme hf-ui sales-entry-visual">
      <div class="sales-entry-product-search">
        <p class="tabular-nums">$10.00</p>
        <span data-testid="stock-badge">#1</span>
      </div>
    </div>
    <div class="hf-theme hf-ui"><div class="sales-entry-product-search">
      <p class="tabular-nums">$10.00</p>
    </div></div>`
    document.body.append(host)
    try {
      const selectors = selectorsOf(css).filter((selector) =>
        selector.includes('sales-entry-product-search'),
      )
      expect(selectors.length).toBeGreaterThan(0)

      const optedAction = host.querySelector('.sales-entry-visual p.tabular-nums')!
      const inertAction = host.querySelector('.hf-ui:not(.sales-entry-visual) p.tabular-nums')!
      const stock = host.querySelector('[data-testid="stock-badge"]')!
      expect(selectors.some((selector) => optedAction.matches(selector))).toBe(true)
      expect(selectors.some((selector) => inertAction.matches(selector))).toBe(false)
      expect(selectors.some((selector) => stock.matches(selector))).toBe(false)
    } finally {
      host.remove()
    }
  })

  it('never leaks into another module boundary', () => {
    expect(cssDeclarations).not.toContain('products-visual')
    expect(cssDeclarations).not.toContain('clients-visual')
    expect(cssDeclarations).not.toContain('quotations-workspace')
    expect(cssDeclarations).not.toContain('sales-detail')
    expect(cssDeclarations).not.toContain('sales-list')
    expect(cssDeclarations).not.toContain('cash-visual')
  })
})

describe('Sales entry visual wiring — caller class and portal opt-ins', () => {
  it('imports the adapter only from the Sales entry view', () => {
    expect(view).toContain("import '../styles/sales-entry-visual.css'")
    expect(view).toContain('hf-theme hf-ui sales-entry-visual')
    expect(view).toContain('sales-entry-product-search')
    expect(view).toContain('sales-entry-page')
    expect(view).toContain('sales-entry-panel')
    expect(view).toContain('hf-theme hf-ui sales-entry-portal')
  })

  it('preserves the accepted split, cart, shortcut and sequencing contracts', () => {
    // The responsive split and the mobile drawer → payment sequencing are
    // behavior, not styling: they must survive the presentation change.
    expect(view).toContain('lg:w-[60%]')
    expect(view).toContain('lg:w-[40%]')
    expect(view).toContain('xl:w-[75%]')
    expect(view).toContain('xl:w-[25%]')
    expect(view).toContain('handleCartAfterLeave')
    expect(view).toContain('pendingCartCharge')
    expect(view).toContain('handleF8')
    expect(view).toContain('handleSearchShortcut')
    expect(view).toContain('data-testid="mobile-cart-fab"')
  })

  it('passes the existing shared opt-ins by call-site props only', () => {
    // Product search and the customer sheet are shared/protected sources; the
    // caller forwards the marker without editing them.
    expect(view).toContain(':portal-class="ENTRY_PORTAL_CLASS"')
    // AssignCustomer is reached with a real saleId in this flow (step 2 stays
    // open), so the caller must forward the same opt-in there too.
    expect(view).toMatch(/AssignCustomerSlideover[\s\S]{0,320}:sale-id="activeDraft\.id"/)
    expect(sessionPicker).toContain('portalClass')
  })

  it('forwards optional, inert opt-ins across the owned panels, rows and dialogs', () => {
    expect(activePanel).toContain('portalClass?: string')
    expect(activePanel).toContain(':portal-class="portalClass"')
    expect(activePanel).toMatch(/:ui="portalClass \? \{ content: portalClass \} : undefined"/)
    expect(itemRow).toContain('portalClass?: string')
    expect(itemRow).toMatch(/:ui="portalClass \? \{ content: portalClass \} : undefined"/)
    expect(totalsFooter).toContain('sales-entry-primary-action')
    expect(successModal).toContain('sales-entry-primary-action')
    expect(requoteModal).toContain('sales-entry-primary-action')
    expect(paymentModal).toContain('sales-entry-primary-action')
  })

  it('preserves each native default when the opt-in is omitted', () => {
    // The shared AppResponsiveDrawer keeps its mobile geometry and its prior
    // `ui`/`desktopUi` defaults unless the caller supplies a marker.
    expect(drawer).toContain('h-[90dvh] max-h-[90dvh] rounded-t-2xl motion-reduce:transition-none')
    expect(drawer).toMatch(/portalClass \?[\s\S]{0,200}desktopUi/)
    // Dialogs keep their prior sizes when the marker is absent.
    expect(successModal).toContain("sm:max-w-md")
    expect(requoteModal).toContain("sm:max-w-md")
  })
})
