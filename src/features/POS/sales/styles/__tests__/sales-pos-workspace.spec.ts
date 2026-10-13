import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the Sales entry workspace / catalog / cart composition
 * (T2 / S1-S5).
 *
 * This adapter is composition-only: it is imported exclusively from SalesView,
 * every rule is scoped to the owned boundaries (`.sales-pos-workspace` for the
 * in-page workspace, `.sales-pos-cart` for the mobile drawer's native content
 * root), and it reuses the already-accepted `.sales-entry-visual` colour paint
 * instead of repeating palette work. It must never repaint another module, the
 * protected shared entry stylesheet, or the shared catalog defaults that
 * quotations still consume.
 *
 * These are source/CSSOM contracts. They do not prove browser fidelity,
 * measured contrast, media-query rendering or touch ergonomics. Visual smoke
 * remains user-owned.
 */
const path = 'src/features/POS/sales/styles/sales-pos-workspace.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
/** Declarations only: comments must not satisfy or defeat textual assertions. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

const view = readFileSync('src/features/POS/sales/views/SalesView.vue', 'utf8')

const COMPONENTS = [
  'ProductSearchPanel',
  'ProductSearchResults',
  'ProductSearchResultItem',
  'ActiveSalePanel',
  'SalesTabsStrip',
  'SaleItemRow',
  'SaleTotalsFooter',
  'PromocionesDisponiblesAccordion',
]
const componentSources = COMPONENTS.map((name) => ({
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

/**
 * The `min-width` (px) of the media query a rule sits in, or `null` when the
 * rule is unconditional. Needed because both panes now own a `width` in every
 * range: an unconditional one for the stacked layout and rem steps from `lg`.
 */
function mediaMinWidth(rule: CSSRule): number | null {
  let current: CSSRule | null = rule.parentRule ?? null
  while (current) {
    if (current.type === CSSRule.MEDIA_RULE) {
      const match = (current as CSSMediaRule).conditionText?.match(/min-width:\s*([\d.]+)rem/)
      if (match) return Number(match[1]) * 16
    }
    current = current.parentRule ?? null
  }
  return null
}

/** Every rule that declares `property` for the exact `selector`. */
function rulesFor(
  source: string,
  selector: string,
  property: string,
): Array<{ minWidthPx: number | null; value: string }> {
  const expected = normalize(selector)
  return styleRules(source)
    .filter((rule) =>
      splitTopLevel(rule.selectorText).some((part) => normalize(part) === expected),
    )
    .map((rule) => ({
      minWidthPx: mediaMinWidth(rule),
      value: rule.style.getPropertyValue(property).trim(),
    }))
    .filter((entry) => entry.value !== '')
}

/** Tailwind's own breakpoints — what the retained legacy utilities expand to. */
const UTILITY_BREAKPOINTS: Record<string, number> = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  '2xl': 96,
}

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

// ── R1 — one feature-owned adapter, owned boundaries only ───────────────────

describe('R1 — the workspace adapter owns its boundary', () => {
  it('imports the shared foundation, is imported only from SalesView, and scopes every rule', () => {
    expect(css).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    // Declarations only: the prose comment may mention a token it forbids.
    expect(declarations).not.toContain(':root')

    // Imported exclusively from the Sales entry view.
    expect(view).toContain("import '../styles/sales-pos-workspace.css'")
    for (const { name, source } of componentSources) {
      expect(source, `${name} must not import the workspace stylesheet`).not.toContain(
        'sales-pos-workspace.css',
      )
    }

    const selectors = selectorsOf(css)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      // Every rule is governed by the owned workspace boundary or the mobile
      // cart root; an unscoped rule would leak to other modules.
      expect(selector).toMatch(/sales-pos-(?:workspace|cart)/)
      expect(selector).not.toMatch(/^(?:\*|html|body|button|input|select|textarea|a|table)\b/)
      expect(selector.trim()).not.toBe('*')
    }
  })

  it('never repaints the protected entry adapter or another module', () => {
    expect(css.length).toBeGreaterThan(0)
    for (const foreign of [
      'sales-entry-visual',
      'sales-entry-portal',
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

// ── R2 — semantic roles only, no palette literals, no wildcard repaint ──────

describe('R2 — colour resolves through the foundation roles', () => {
  it('declares no raw colour literal and no global wildcard', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    for (const { property, value } of allDeclarations(css)) {
      expect(`${property}:${value}`).not.toMatch(/\brgba?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\bhsla?\(/i)
      expect(`${property}:${value}`).not.toMatch(/\boklch\(/i)
      expect(`${property}:${value}`).not.toMatch(/\b(?:white|black)\b/i)
    }
    // No universal selector anywhere in the file.
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

// ── R3 — readable two-pane desktop split (S6: bounded centered v0 rail) ─────

describe('R3 — two-pane desktop keeps a readable cart column', () => {
  const CART_PANE = '.sales-pos-workspace .sales-pos-cart-pane'
  const CATALOG_PANE = '.sales-pos-workspace .sales-pos-catalog-pane'
  const WORKSPACE_MAX_PX = 118.75 * 16 // 1900px content bound

  it('bounds the cart to the reference 388px / 420px visible columns', () => {
    // S8: the accepted reference uses a 388px ordinary desktop cart column and
    // a 420px column from 1500px. The pane is now a neutral wrapper with no
    // padding, so the pane width IS the visible cart surface.
    const railSteps = rulesFor(css, CART_PANE, 'width')
      .filter((entry) => entry.minWidthPx !== null)
      .sort((a, b) => (a.minWidthPx ?? 0) - (b.minWidthPx ?? 0))

    expect(railSteps.map((step) => [step.minWidthPx, step.value])).toEqual([
      [UTILITY_BREAKPOINTS.lg! * 16, '24.25rem'],
      [1500, '26.25rem'],
    ])

    // The workspace stays bounded and centered like the reference.
    const splitMax = rulesFor(css, '.sales-pos-workspace .sales-pos-split', 'max-width')[0]
    expect(splitMax).toBeDefined()
    expect(remValue(splitMax!.value) * 16).toBeCloseTo(WORKSPACE_MAX_PX, 0)

    // Bounded on both sides: never a wide takeover, never a narrow rail.
    const max = rulesFor(css, CART_PANE, 'max-width')[0]
    const min = rulesFor(css, CART_PANE, 'min-width')[0]
    expect(max).toBeDefined()
    expect(min).toBeDefined()
    expect(remValue(min!.value) * 16).toBe(388)
    expect(remValue(max!.value) * 16).toBe(420)
    // The ceiling equals the widest step, so the max-width cannot fake a step.
    expect(max!.value, 'max-width must match the widest rail step').toBe(railSteps[railSteps.length - 1]!.value)

    const catalog = rulesFor(css, CATALOG_PANE, 'flex')[0]
    expect(catalog).toBeDefined()
    expect(catalog!.value).toMatch(/^1\s/)

    // Wrapper padding is neutralized so it cannot masquerade as the surface.
    expect(
      rulesFor(css, CART_PANE, 'padding').map((entry) => entry.value),
    ).toContain('0px')

    // Both panes are only re-proportioned, never re-ordered or hidden here.
    expect(view).toContain('sales-pos-catalog-pane')
    expect(view).toContain('sales-pos-cart-pane')
  })

  it('keeps the retained legacy responsive width utilities inert in every range', () => {
    // Parent decision: `lg:w-[60%]`/`xl:w-[75%]` (catalog) and
    // `lg:w-[40%]`/`xl:w-[25%]` (cart) stay in the markup, so this is the
    // assertion that they can never control the sales composition.
    const legacyUtilities = [...view.matchAll(/\b((?:lg|xl|2xl):w-\[\d+\%\])/g)].map((m) => m[1]!)
    expect(legacyUtilities.length, 'the markup still carries the legacy utilities').toBeGreaterThan(0)

    for (const pane of [CATALOG_PANE, CART_PANE]) {
      const widths = rulesFor(css, pane, 'width')

      // 1. Every owned declaration outranks a single Tailwind utility class
      //    (0-1-0): each owned selector carries two class tokens (0-2-0).
      for (const entry of widths) {
        const ownedSelector = pane.split(' ').length
        expect(entry.value, `${pane} width declaration must be non-empty`).not.toBe('')
        expect(
          ownedSelector,
          `${pane} must stay a two-class owned selector so it outranks a utility`,
        ).toBeGreaterThanOrEqual(2)
      }

      // 2. Coverage: no width range may fall back to a utility. The stacked
      //    range owns an unconditional `width`, and `lg` and up own rem/auto.
      const unconditional = widths.filter((entry) => entry.minWidthPx === null)
      expect(
        unconditional.length,
        `${pane} needs an unconditional owned width so no range is unclaimed`,
      ).toBe(1)
      expect(unconditional[0]!.value).toBe('100%')

      for (const widthPx of [375, 640, 768, 900, 1024, 1280, 1536, 1920, 2560, 3440]) {
        const candidates = widths
          .filter((entry) => entry.minWidthPx === null || entry.minWidthPx! <= widthPx)
          .sort(
            (a, b) => (a.minWidthPx ?? -1) - (b.minWidthPx ?? -1),
          )
        const resolved = candidates[candidates.length - 1]!.value
        if (widthPx >= 1024) {
          expect(
            resolved,
            `${pane} resolves to a viewport share at ${widthPx}px — a legacy utility could win`,
          ).not.toMatch(/%$/)
          expect(resolved, `${pane} at ${widthPx}px must be an absolute/desktop value`).toMatch(
            /^(auto|[\d.]+rem)$/,
          )
        } else {
          expect(resolved, `${pane} must fill the stacked mobile layout`).toBe('100%')
        }
      }
    }

    // 3. None of the retained utilities declares a value the composition uses.
    for (const utility of legacyUtilities) {
      const percent = utility.match(/w-\[(\d+)%\]/)![1]!
      expect(percent, 'a legacy percentage must not be the resolved pane width').not.toBe(
        rulesFor(css, CART_PANE, 'width').filter((e) => e.minWidthPx !== null)[0]!.value,
      )
    }

    // 4. The utility breakpoints are all inside ranges the owned rules cover.
    for (const utility of legacyUtilities) {
      const prefix = utility.slice(0, utility.indexOf(':'))
      const breakpointRem = UTILITY_BREAKPOINTS[prefix] ?? 0
      expect(UTILITY_BREAKPOINTS[prefix], `unknown breakpoint prefix in ${utility}`).toBeDefined()
      for (const pane of [CATALOG_PANE, CART_PANE]) {
        const covered = rulesFor(css, pane, 'width').some(
          (entry) => entry.minWidthPx === null || entry.minWidthPx! <= breakpointRem * 16,
        )
        expect(covered, `${pane} is uncovered at the ${utility} breakpoint`).toBe(true)
      }
    }
  })
})

// ── R4 — catalog: bounded media, readable facts, grouped controls ───────────

describe('R4 — catalog cards stay bounded and readable', () => {
  it('bounds the mobile media band and keeps the horizontal card uncropped', () => {
    const media = exactRule(css, '.sales-pos-workspace .sales-pos-product-media', 'height')!
    expect(media).toBeDefined()
    const height = remValue(media.style.getPropertyValue('height').trim())
    // A bounded, comfortable band — not a dominant hero image.
    expect(height).toBeGreaterThanOrEqual(6)
    expect(height).toBeLessThanOrEqual(10)

    const image = exactRule(
      css,
      '.sales-pos-workspace .sales-pos-product-media img',
      'object-fit',
    )!
    expect(image).toBeDefined()
    expect(image.style.getPropertyValue('object-fit').trim()).toBe('contain')

    // S6: a fixed band across ALL widths is what letterboxed the wide desktop
    // cards. From sm the band must follow the (now bounded) card width.
    const aspect = exactRule(css, '.sales-pos-workspace .sales-pos-product-media', 'aspect-ratio')!
    expect(aspect, 'proportional media band is required from sm').toBeDefined()
    expect(aspect.style.getPropertyValue('aspect-ratio').trim()).toMatch(/^[\d.]+\s*\/\s*[\d.]+$/)
    const ceiling = exactRule(css, '.sales-pos-workspace .sales-pos-product-media', 'max-height')!
    expect(ceiling).toBeDefined()
    expect(remValue(ceiling.style.getPropertyValue('max-height').trim())! * 16).toBeLessThanOrEqual(210)
  })

  it('fills the desktop band instead of leaving letterbox bars', () => {
    const fills = styleRules(css).filter((rule) =>
      splitTopLevel(rule.selectorText).some(
        (part) => normalize(part) === '.sales-pos-workspace .sales-pos-product-media img',
      ),
    )
    expect(
      fills.some((rule) => rule.style.getPropertyValue('object-fit').trim() === 'cover'),
      'the proportional desktop band must fill the box',
    ).toBe(true)
  })

  it('keeps product name, price, brand and stock at readable sizes', () => {
    const name = exactRule(css, '.sales-pos-workspace .sales-pos-product-name', 'font-size')!
    const price = exactRule(css, '.sales-pos-workspace .sales-pos-product-price', 'font-size')!
    const brand = exactRule(css, '.sales-pos-workspace .sales-pos-product-brand', 'font-size')!
    const stock = exactRule(css, '.sales-pos-workspace .sales-pos-product-stock', 'font-size')!
    expect(name).toBeDefined()
    expect(price).toBeDefined()
    expect(brand).toBeDefined()
    expect(stock).toBeDefined()

    expect(remValue(name.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.9375)
    expect(remValue(price.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(1)
    expect(remValue(brand.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.75)
    expect(remValue(stock.style.getPropertyValue('font-size').trim())).toBeGreaterThanOrEqual(0.75)
  })

  it('groups search and categories and lays the results grid out for the workspace', () => {
    expect(view).toContain('sales-pos-catalog')
    const controls = exactRule(css, '.sales-pos-workspace .sales-pos-catalog-controls')!
    expect(controls).toBeDefined()

    // S8: the catalog controls own a single 12px surface; the product grid is
    // NOT wrapped inside it.
    const surface = exactRule(css, '.hf-ui.sales-pos-workspace .sales-pos-catalog > .sales-pos-catalog-controls-surface.sticky')!
    expect(surface).toBeDefined()
    expect(surface.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(surface.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-card)')

    // The workspace grid is the reference's spacious 3/2/3 contract, never the
    // denser 4/5/6 steps that were rejected.
    const gridSteps = rulesFor(
      css,
      '.sales-pos-workspace .sales-pos-product-grid',
      'grid-template-columns',
    )
      .slice()
      .sort((a, b) => (a.minWidthPx ?? 0) - (b.minWidthPx ?? 0))
    expect(gridSteps.map((step) => [step.minWidthPx, step.value])).toEqual([
      [640, 'repeat(3, minmax(0, 1fr))'],
      [1024, 'repeat(2, minmax(0, 1fr))'],
      [1152, 'repeat(3, minmax(0, 1fr))'],
    ])
  })

  it('keeps the catalog controls on the 6px control radius and the 44px target', () => {
    const search = exactRule(
      css,
      ".sales-pos-workspace .sales-pos-catalog-search [data-slot='base']",
      'border-radius',
    )!
    expect(search).toBeDefined()
    expect(search.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-control)')
    expect(search.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')

    const chip = styleRules(css).find((rule) =>
      splitTopLevel(rule.selectorText).some(
        (part) => normalize(part) === '.sales-pos-workspace .sales-pos-categories button',
      ),
    )
    expect(chip).toBeDefined()
    expect(chip!.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-control)')
    expect(chip!.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
  })

  it('hooks the shared catalog additively, without changing its default paint', () => {
    const byName = Object.fromEntries(componentSources.map(({ name, source }) => [name, source]))
    expect(byName.ProductSearchPanel).toContain('sales-pos-catalog-controls')
    expect(byName.ProductSearchPanel).toContain('sales-pos-categories')
    expect(byName.ProductSearchResults).toContain('sales-pos-product-grid')
    expect(byName.ProductSearchResultItem).toContain('sales-pos-product-card')
    expect(byName.ProductSearchResultItem).toContain('sales-pos-product-media')
    // The shared component keeps its prior classes and contracts.
    expect(byName.ProductSearchResultItem).toContain('data-testid="result-card"')
    expect(byName.ProductSearchResultItem).toContain('object-cover')
  })
})

// ── R5 — cart chrome and fixed totals/charge action ─────────────────────────

describe('R5 — cart chrome stays readable above the fixed totals', () => {
  it('hooks the cart panel, rows, customer summary, promotions and totals', () => {
    const byName = Object.fromEntries(componentSources.map(({ name, source }) => [name, source]))
    const hooks: Array<[string, string]> = [
      ['ActiveSalePanel', 'sales-pos-cart-panel'],
      ['ActiveSalePanel', 'sales-pos-cart-body'],
      ['ActiveSalePanel', 'sales-pos-customer-summary'],
      ['ActiveSalePanel', 'sales-pos-cart-toolbar'],
      ['SaleItemRow', 'sales-pos-cart-row'],
      ['SaleTotalsFooter', 'sales-pos-totals'],
      ['PromocionesDisponiblesAccordion', 'sales-pos-promotions'],
    ]
    for (const [component, hook] of hooks) {
      expect(byName[component], `${component} must expose ${hook}`).toContain(hook)
    }
  })

  it('separates and anchors the totals block, and sizes the charge action', () => {
    const totalsCanvas = styleRules(css).filter((rule) =>
      splitTopLevel(rule.selectorText).some(
        (part) =>
          normalize(part) === '.sales-pos-workspace .sales-pos-totals' ||
          normalize(part) === '.sales-pos-cart .sales-pos-totals',
      ),
    )
    expect(totalsCanvas.some((rule) => rule.style.getPropertyValue('border-top') !== '')).toBe(true)

    const charge = styleRules(css).filter((rule) =>
      splitTopLevel(rule.selectorText).some((part) =>
        part.includes('sales-pos-charge-button'),
      ),
    )
    expect(
      charge.some((rule) => rule.style.getPropertyValue('min-height').trim() === 'var(--hf-control-height)'),
    ).toBe(true)
  })
})

// ── R6 — mobile persistent FAB and cart root ────────────────────────────────

describe('R6 — the mobile cart root and FAB use the action pair', () => {
  it('pairs the FAB background with its foreground role instead of a literal', () => {
    const fab = exactRule(css, '.sales-pos-workspace .sales-pos-cart-fab', 'background-color')!
    expect(fab).toBeDefined()
    expect(fab.style.getPropertyValue('background-color').trim()).toBe('var(--hf-action)')
    expect(fab.style.getPropertyValue('color').trim()).toBe('var(--hf-on-action)')
  })

  it('paints the mobile cart root inside the owned cart boundary', () => {
    const cart = exactRule(css, '.sales-pos-cart', 'background-color')!
    expect(cart).toBeDefined()
    expect(cart.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
  })
})

// ── R7 — the view keeps its accepted contracts and appends markers ──────────

describe('R7 — SalesView keeps the accepted contracts', () => {
  it('opts into the workspace boundary and keeps the entry marker byte-exact', () => {
    expect(view).toContain('sales-pos-workspace')
    expect(view).toContain("const ENTRY_PORTAL_CLASS = 'hf-theme hf-ui sales-entry-portal'")
    expect(view).toContain(':portal-class="ENTRY_PORTAL_CLASS"')
  })

  it('appends the cart marker on the mobile drawer and the customer marker on the shared sheet', () => {
    // Both markers are APPENDED to the entry marker (never a replacement of it),
    // each declared on the specific caller prop that owns the native teleport root.
    expect(view).toMatch(/ENTRY_PORTAL_CLASS\}\s*sales-pos-cart/)
    expect(view).toMatch(/ENTRY_PORTAL_CLASS\}\s*sales-pos-customer/)
  })

  it('preserves the accepted split classes, shortcuts and drawer sequencing', () => {
    expect(view).toContain('lg:w-[60%]')
    expect(view).toContain('lg:w-[40%]')
    expect(view).toContain('xl:w-[75%]')
    expect(view).toContain('xl:w-[25%]')
    expect(view).toContain('handleF8')
    expect(view).toContain('handleSearchShortcut')
    expect(view).toContain('handleCartAfterLeave')
    expect(view).toContain('pendingCartCharge')
    expect(view).toContain('data-testid="mobile-cart-fab"')
  })
})
