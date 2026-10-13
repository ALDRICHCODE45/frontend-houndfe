import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Sales ultrawide composition regression contracts (T2 / S1-S6 correction).
 *
 * The user's S6 report is specific: on ultrawide screens the sale workspace
 * "se ve muy mal" compared with the accepted v0 reference, the responsive grid
 * is not monotonic and the catalog media is oversized/letterboxed. The accepted
 * v0 reference is a CENTERED, BOUNDED workspace (`max-width: 1900px`, readable
 * bounded cart rail around 388-420px), never a full-bleed desktop surface and
 * never Caja's global 1320px page limit (docs/design-system.md §2).
 *
 * These rules pin that accepted contract against the real feature stylesheet,
 * the real shared catalog classes it overrides, and the real SalesView markup
 * for BOTH the loaded and the loading composition.
 *
 * CSSOM/source assertions are structural contracts, NOT browser fidelity: they
 * do not prove rendered layout, measured contrast or touch ergonomics. The
 * offline real-browser probe under
 * `artifacts/sales-entry-v0/corrections/workspace/browser-probe/` is the
 * rendered check, and visual acceptance remains user-owned (S5).
 */

const CSS_PATH = 'src/features/POS/sales/styles/sales-pos-workspace.css'
const css = existsSync(CSS_PATH) ? readFileSync(CSS_PATH, 'utf8') : ''
const view = readFileSync('src/features/POS/sales/views/SalesView.vue', 'utf8')
const resultsSource = readFileSync(
  'src/features/POS/sales/components/ProductSearchResults.vue',
  'utf8',
)

const styles: HTMLStyleElement[] = []

interface Declaration {
  /** Owning media `min-width` in px, or `null` for an unconditional rule. */
  minWidthPx: number | null
  selector: string
  property: string
  value: string
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

function normalize(selector: string): string {
  return selector.replace(/\s+/g, ' ').replace(/["']/g, '').trim()
}

function lengthToPx(value: string): number | null {
  const rem = value.match(/^([\d.]+)rem$/)
  if (rem) return Number(rem[1]) * 16
  const px = value.match(/^([\d.]+)px$/)
  if (px) return Number(px[1])
  return null
}

/** Flattens the stylesheet, keeping each rule's media `min-width` boundary. */
function declarations(source: string): Declaration[] {
  const style = document.createElement('style')
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)

  const flat: Declaration[] = []
  const mediaOf = (rule: CSSRule): number | null => {
    let current: CSSRule | null = rule.parentRule ?? null
    while (current) {
      if (current.type === CSSRule.MEDIA_RULE) {
        const condition = (current as CSSMediaRule).conditionText ?? ''
        const match = condition.match(/min-width:\s*([\d.]+)rem/)
        if (match) return Number(match[1]) * 16
      }
      current = current.parentRule ?? null
    }
    return null
  }

  const walk = (list: CSSRuleList | undefined) => {
    if (!list) return
    Array.from(list).forEach((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) {
        const styleRule = rule as CSSStyleRule
        const minWidthPx = mediaOf(rule)
        for (const selector of splitTopLevel(styleRule.selectorText)) {
          Array.from({ length: styleRule.style.length }, (_, index) =>
            styleRule.style.item(index),
          ).forEach((property) => {
            flat.push({
              minWidthPx,
              selector: normalize(selector),
              property,
              value: styleRule.style.getPropertyValue(property).trim(),
            })
          })
        }
      } else {
        walk((rule as CSSGroupingRule).cssRules)
      }
    })
  }
  walk(style.sheet?.cssRules)
  return flat
}

const decls = declarations(css)

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

/** The declaration the cascade resolves for `selector` at `widthPx`. */
function valueAt(selector: string, property: string, widthPx: number): string | null {
  const matching = decls
    .filter(
      (decl) =>
        decl.selector === normalize(selector) &&
        decl.property === property &&
        (decl.minWidthPx === null || decl.minWidthPx <= widthPx),
    )
    .sort((a, b) => (a.minWidthPx ?? -1) - (b.minWidthPx ?? -1))
  return matching.length ? matching[matching.length - 1]!.value : null
}

/** Ordered `(minWidthPx, value)` steps an owned rule declares. */
function stepsOf(selector: string, property: string): Array<{ minWidthPx: number; value: string }> {
  return decls
    .filter(
      (decl) =>
        decl.selector === normalize(selector) &&
        decl.property === property &&
        decl.minWidthPx !== null,
    )
    .map((decl) => ({ minWidthPx: decl.minWidthPx as number, value: decl.value }))
    .sort((a, b) => a.minWidthPx - b.minWidthPx)
}

function repeatColumns(value: string | null): number | null {
  const match = value?.match(/repeat\(\s*(\d+)\s*,/)
  return match ? Number(match[1]) : null
}

/*
 * The responsive defaults of the shared catalog grid are read from the real
 * component source (Tailwind breakpoints) so this contract cannot silently
 * drift away from what the feature actually overrides. Quotations keep these
 * defaults; only the owned `.sales-pos-workspace` boundary may re-proportion
 * them.
 */
const TAILWIND_BREAKPOINTS: Record<string, number> = {
  '': 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

function sharedGridSteps(source: string): Array<{ minWidthPx: number; columns: number }> {
  const tokens = [...source.matchAll(/(?:^|\s)((?:sm:|md:|lg:|xl:|2xl:)?grid-cols-\d+)(?=\s)/g)]
  const byBreakpoint = new Map<number, number>()
  for (const match of tokens) {
    const token = match[1]!
    const prefix = token.includes(':') ? token.slice(0, token.indexOf(':')) : ''
    const columns = Number(token.match(/grid-cols-(\d+)/)?.[1] ?? '0')
    if (!columns) continue
    const minWidthPx = TAILWIND_BREAKPOINTS[prefix] ?? 0
    byBreakpoint.set(minWidthPx, Math.max(byBreakpoint.get(minWidthPx) ?? 0, columns))
  }
  return [...byBreakpoint.entries()]
    .map(([minWidthPx, columns]) => ({ minWidthPx, columns }))
    .sort((a, b) => a.minWidthPx - b.minWidthPx)
}

const sharedSteps = sharedGridSteps(resultsSource)
const ownedSteps = stepsOf('.sales-pos-workspace .sales-pos-product-grid', 'grid-template-columns')

/**
 * Columns the catalog actually resolves at a viewport width: the owned feature
 * boundary wins over the shared utilities on specificity, so a shared step is
 * only effective where no owned step has taken over yet.
 */
function resolvedColumns(widthPx: number): number | null {
  const owned = ownedSteps.filter((step) => step.minWidthPx <= widthPx)
  const ownedNow = owned.length ? repeatColumns(owned[owned.length - 1]!.value) : null
  const shared = sharedSteps.filter((step) => step.minWidthPx <= widthPx)
  const sharedNow = shared.length ? shared[shared.length - 1]!.columns : null
  if (ownedNow === null) return sharedNow
  // Once the owned boundary governs the grid it governs every step: a shared
  // breakpoint that still yields MORE columns than the owned step is the exact
  // non-monotonic defect this correction removes.
  return ownedNow
}

const RAIL_WIDTH_PX = 1900

function railWidthAt(widthPx: number): number {
  const value = valueAt('.sales-pos-workspace .sales-pos-cart-pane', 'width', widthPx)
  return lengthToPx(value ?? '') ?? 0
}

function gapAt(widthPx: number): number {
  const value = valueAt('.sales-pos-workspace .sales-pos-product-grid', 'gap', widthPx)
  return lengthToPx(value ?? '') ?? 16
}

// ── U1 — the accepted bounded, centered v0 workspace (not full-bleed) ────────

describe('U1 — the ultrawide workspace is bounded and centered', () => {
  it('bounds and centers the two-pane composition instead of stretching it edge to edge', () => {
    expect(css.length).toBeGreaterThan(0)
    const maxWidth = valueAt('.sales-pos-workspace .sales-pos-split', 'max-width', 3440)
    expect(maxWidth, 'the workspace needs the accepted bounded v0 max-width').toBe(`${RAIL_WIDTH_PX / 16}rem`)
    expect(valueAt('.sales-pos-workspace .sales-pos-split', 'margin-inline', 3440)).toBe('auto')
    expect(valueAt('.sales-pos-workspace .sales-pos-split', 'width', 3440)).toBe('100%')

    // SalesView must actually carry the hook in BOTH compositions (loaded +
    // loading skeleton); one branch alone would leave loading full-bleed.
    const occurrences = view.match(/sales-pos-split/g) ?? []
    expect(occurrences.length, 'both the loaded and the loading composition are bounded').toBeGreaterThanOrEqual(
      2,
    )
  })

  it('keeps the draft strip inside the same bounded column', () => {
    const maxWidth = valueAt('.sales-pos-workspace .sales-pos-draft-strip', 'max-width', 3440)
    expect(maxWidth).toBe(`${RAIL_WIDTH_PX / 16}rem`)
    expect(valueAt('.sales-pos-workspace .sales-pos-draft-strip', 'margin-inline', 3440)).toBe('auto')
  })

  it('bounds the accepted heading and places it before the draft strip', () => {
    // S8: the `PUNTO DE VENTA` / `Nueva venta` heading shares the same bounded,
    // centered column and precedes the draft strip in the view markup.
    expect(valueAt('.sales-pos-workspace .sales-pos-workspace-header', 'max-width', 3440)).toBe(
      `${RAIL_WIDTH_PX / 16}rem`,
    )
    expect(valueAt('.sales-pos-workspace .sales-pos-workspace-header', 'margin-inline', 3440)).toBe(
      'auto',
    )
    const headerIndex = view.indexOf('sales-pos-workspace-header')
    expect(headerIndex).toBeGreaterThan(-1)
    expect(headerIndex).toBeLessThan(view.indexOf('<SalesTabsStrip'))
  })
})

// ── U2 — the cart rail stays a bounded, readable column ─────────────────────

describe('U2 — the cart rail is bounded, never viewport-proportional', () => {
  it('uses the reference 388px / 420px columns and a padding-free wrapper', () => {
    const widths = stepsOf('.sales-pos-workspace .sales-pos-cart-pane', 'width')
    expect(widths.length).toBeGreaterThanOrEqual(2)
    for (const step of widths) {
      expect(step.value, `rail step ${step.value} must be rem-based`).toMatch(/^[\d.]+rem$/)
    }

    // S8: exactly two bounded steps — the reference's ordinary desktop cart
    // column from `lg`, and its wider column from 1500px.
    expect(widths.map((step) => [step.minWidthPx, step.value])).toEqual([
      [1024, '24.25rem'],
      [1500, '26.25rem'],
    ])

    // The pane is a NEUTRAL wrapper, so the visible cart surface equals the
    // pane width: 388px ordinary desktop, 420px from 1500px.
    expect(railWidthAt(1024)).toBe(388)
    expect(railWidthAt(1440)).toBe(388)
    expect(railWidthAt(1920)).toBe(420)
    expect(railWidthAt(3440)).toBe(420)
    expect(railWidthAt(3440)).toBeGreaterThanOrEqual(railWidthAt(1024))
    expect(railWidthAt(3440)).toBeLessThanOrEqual(448)

    // No padded wrapper can masquerade as the cart surface.
    expect(valueAt('.sales-pos-workspace .sales-pos-cart-pane', 'padding', 1440)).toMatch(
      /^0(px)?$/,
    )
    expect(valueAt('.sales-pos-workspace .sales-pos-catalog-pane', 'padding', 1440)).toMatch(
      /^0(px)?$/,
    )
  })

  it('leaves the cart surface to the cart panel (no wrapper border/rounding)', () => {
    const shell =
      '.sales-pos-workspace .sales-pos-cart-pane > .sales-entry-panel.sales-pos-cart-shell'
    expect(valueAt(shell, 'background-color', 1440)).toBe('transparent')
    expect(valueAt(shell, 'border-style', 1440)).toBe('none')
    expect(valueAt(shell, 'border-width', 1440)).toMatch(/^0(px)?$/)
    expect(valueAt(shell, 'border-radius', 1440)).toMatch(/^0(px)?$/)
    // The protected caller hook stays on the wrapper in the view markup.
    expect(view).toContain('sales-entry-panel sales-pos-cart-shell')
  })

  it('lets the catalog take the remaining bounded width', () => {
    const flex = valueAt('.sales-pos-workspace .sales-pos-catalog-pane', 'flex', 1440)
    expect(flex, 'the catalog pane must flex to fill the bounded workspace').toMatch(/^1\s/)
    expect(valueAt('.sales-pos-workspace .sales-pos-catalog-pane', 'min-width', 1440)).toMatch(/^0(px)?$/)
  })
})

// ── U3 — the responsive grid is monotonic and the cards stay bounded ────────

describe('U3 — catalog columns never step backwards and cards stay bounded', () => {
  it('shares the same responsive column contract between skeleton and results', () => {
    // Both grids are governed by the owned boundary; the shared defaults that
    // quotations still consume stay byte-identical.
    expect(resultsSource).toContain('sales-pos-product-grid')
    expect(sharedSteps.map((step) => step.columns)).toEqual([1, 3, 4, 4])
  })

  it('never renders fewer columns at a larger viewport width', () => {
    const expected: Array<[number, number]> = [
      [375, 1],
      [640, 3],
      [768, 3],
      [900, 3],
      [1024, 2],
      [1216, 3],
      [1280, 3],
      [1440, 3],
      [1536, 3],
      [1792, 3],
      [1920, 3],
      [2560, 3],
      [3440, 3],
    ]
    for (const [width, columns] of expected) {
      expect(resolvedColumns(width), `columns at ${width}px`).toBe(columns)
    }
    // S8: the visible cart (not the viewport) drives the two-column band, and
    // the desktop grid never grows past the reference's three columns.
    expect(resolvedColumns(3440)).toBe(3)
  })

  it('keeps every desktop/ultrawide product card inside a bounded band', () => {
    // Bounded workspace content = min(width, 1900) - split gutters (32+32) -
    // pane gap (24) - visible cart rail - results padding (20+20).
    for (const width of [1024, 1216, 1440, 1536, 1792, 1920, 2560, 3440]) {
      const columns = resolvedColumns(width) ?? 1
      const rail = railWidthAt(width)
      const content = Math.min(width, RAIL_WIDTH_PX) - 64 - 24 - rail - 40
      const card = (content - (columns - 1) * gapAt(width)) / columns
      expect(card, `card width at ${width}px`).toBeGreaterThanOrEqual(180)
      expect(card, `card width at ${width}px`).toBeLessThanOrEqual(460)
    }
  })
})

// ── U4 — catalog media is bounded and never letterboxed ─────────────────────

describe('U4 — product media fills a bounded band', () => {
  it('keeps the mobile horizontal-card band fixed and uncropped (guard)', () => {
    const height = valueAt('.sales-pos-workspace .sales-pos-product-media', 'height', 375)
    expect(height).toMatch(/^[\d.]+rem$/)
    expect(valueAt('.sales-pos-workspace .sales-pos-product-media img', 'object-fit', 375)).toBe(
      'contain',
    )
    // No proportional band may apply below sm: the mobile card is a row.
    const aspectSteps = stepsOf('.sales-pos-workspace .sales-pos-product-media', 'aspect-ratio')
    expect(aspectSteps.length).toBeGreaterThanOrEqual(1)
    expect(aspectSteps[0]!.minWidthPx).toBeGreaterThanOrEqual(640)
  })

  it('switches to a proportional band that fills the card from sm upward', () => {
    const aspect = valueAt('.sales-pos-workspace .sales-pos-product-media', 'aspect-ratio', 1024)
    expect(aspect, 'the media band must follow the card width instead of a fixed height').toMatch(
      /^[\d.]+\s*\/\s*[\d.]+$/,
    )
    expect(valueAt('.sales-pos-workspace .sales-pos-product-media', 'height', 1024)).toBe('auto')

    // Ceiling: the band may never become a hero image again. It is loose
    // enough not to clamp the bounded card widths above, so the aspect band
    // (not a clamped box) is what prevents the letterbox bars.
    const maxHeight = valueAt('.sales-pos-workspace .sales-pos-product-media', 'max-height', 1024)
    const maxHeightPx = lengthToPx(maxHeight ?? '')
    expect(maxHeightPx).not.toBeNull()
    expect(maxHeightPx!).toBeLessThanOrEqual(210)

    // A fixed height with `contain` is exactly what produced the letterbox
    // bands on the wide cards; the filled band uses the shared cover default.
    expect(valueAt('.sales-pos-workspace .sales-pos-product-media img', 'object-fit', 1024)).toBe(
      'cover',
    )
    expect(valueAt('.sales-pos-workspace .sales-pos-product-media img', 'padding', 1024)).toMatch(
      /^0(px)?$/,
    )
  })

  it('preserves the shared card defaults the other consumers still rely on', () => {
    const itemSource = readFileSync(
      'src/features/POS/sales/components/ProductSearchResultItem.vue',
      'utf8',
    )
    expect(itemSource).toContain('object-cover')
    expect(itemSource).toContain('w-[43%]')
    expect(itemSource).toContain('sales-pos-product-media')
    expect(itemSource).toContain('data-testid="result-card"')
  })
})

// ── U5 — the cart footer regions cannot be squeezed away ────────────────────

describe('U5 — the customer summary keeps its fixed region', () => {
  it('pins the cart footer and its summary so a long cart cannot displace them', () => {
    const selectors = [
      '.sales-pos-workspace .sales-pos-cart-footer',
      '.sales-pos-cart .sales-pos-cart-footer',
      '.sales-pos-workspace .sales-pos-customer-summary',
      '.sales-pos-cart .sales-pos-customer-summary',
    ]
    for (const selector of selectors) {
      expect(
        valueAt(selector, 'flex-shrink', 3440),
        `${selector} must not shrink away`,
      ).toBe('0')
    }
    // The scrolling body keeps `min-height: 0` so it absorbs the overflow
    // instead of pushing the fixed footer out of the pane.
    for (const selector of [
      '.sales-pos-workspace .sales-pos-cart-body',
      '.sales-pos-cart .sales-pos-cart-body',
    ]) {
      expect(valueAt(selector, 'min-height', 3440)).toMatch(/^0(px)?$/)
    }
  })
})

// ── U6 — the loading composition matches the loaded geometry ────────────────

describe('U6 — the loading skeleton mirrors the loaded composition', () => {
  const loadingBranch = (): string => {
    const start = view.indexOf('v-if="isLoadingList"')
    expect(start).toBeGreaterThan(-1)
    const end = view.indexOf('v-else', start)
    expect(end).toBeGreaterThan(start)
    return view.slice(start, end)
  }

  it('reuses the same pane, grid and media hooks while loading', () => {
    const branch = loadingBranch()
    for (const hook of [
      'sales-pos-split',
      'sales-pos-catalog-pane',
      'sales-pos-cart-pane',
      'sales-pos-product-grid',
      'sales-pos-product-media',
    ]) {
      expect(branch, `loading composition must carry ${hook}`).toContain(hook)
    }
    // The loaded split geometry, not a second, unrelated skeleton layout.
    expect(branch).toContain('lg:w-[60%]')
    expect(branch).toContain('lg:w-[40%]')
    expect(branch).not.toContain('grid-cols-2')
  })

  it('gives the loading card the same mobile media width as the loaded card', () => {
    const loaded = readFileSync('src/features/POS/sales/components/ProductSearchResultItem.vue', 'utf8')
    const loading = readFileSync('src/features/POS/sales/components/ProductSearchResults.vue', 'utf8')
    expect(loaded).toContain('w-[43%]')
    // The shared skeleton default belongs to other consumers too; only the
    // owned Venta workspace overrides it to match the loaded mobile card.
    expect(valueAt('.sales-pos-workspace .sales-pos-product-media', 'width', 390)).toBe('43%')
    expect(loading).toMatch(/<USkeleton[^>]*class="[^"]*w-28[^"]*sales-pos-product-media/s)
    expect(valueAt('.sales-pos-workspace .sales-pos-product-media', 'width', 640)).toBe('100%')
  })

  it('keeps the loaded cart panel geometry and the mobile-only drawer branch', () => {
    expect(view).toContain('sales-pos-cart-pane')
    expect(view).toContain('hidden lg:block')
    expect(view).toContain('data-testid="mobile-cart-drawer"')
    expect(view).toContain('handleCartAfterLeave')
  })
})
