import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * S11 source contracts for the Venta v0 fidelity correction.
 *
 * The user rejected the previous candidate because the workspace looked
 * "escalonada" (heading, draft strip and catalog started on different edges),
 * wasted space on doubled gutters, painted a padding-less hover on cart rows,
 * and kept the old brown/gold checkout paint with unreadable yellow warnings.
 *
 * Rules are evaluated in source order with min-width media queries applied for
 * a given viewport width, so a later unconditional rule that silently defeats a
 * media rule (the original draft-strip defect) fails here. These are CSSOM
 * contracts only: browser rendering, measured contrast and visual acceptance
 * remain user-owned.
 */

const read = (name: string) => readFileSync(`src/features/POS/sales/styles/${name}`, 'utf8')
const workspaceCss = read('sales-pos-workspace.css')
const cartCss = read('sales-pos-cart.css')
const checkoutCss = read('sales-pos-checkout.css')

const styles: HTMLStyleElement[] = []

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

type ScopedRule = { rule: CSSStyleRule; minWidthPx: number }

function scopedRules(source: string): ScopedRule[] {
  const style = document.createElement('style')
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)

  const collected: ScopedRule[] = []
  const walk = (list: CSSRuleList | undefined, minWidthPx: number) => {
    if (!list) return
    Array.from(list).forEach((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) {
        collected.push({ rule: rule as CSSStyleRule, minWidthPx })
      } else if (rule.type === CSSRule.MEDIA_RULE) {
        const media = (rule as CSSMediaRule).media.mediaText
        const match = media.match(/min-width:\s*([\d.]+)(rem|px)/)
        // Max-width or feature queries are not part of these contracts.
        if (!match) return
        const value = Number(match[1]) * (match[2] === 'rem' ? 16 : 1)
        walk((rule as CSSMediaRule).cssRules, Math.max(minWidthPx, value))
      }
    })
  }
  walk(style.sheet?.cssRules, 0)
  return collected
}

/** The last matching declaration in source order wins (equal specificity). */
function effective(source: string, selector: string, property: string, widthPx: number): string {
  let value = ''
  for (const { rule, minWidthPx } of scopedRules(source)) {
    if (minWidthPx > widthPx) continue
    const selectors = rule.selectorText.split(',').map((part) => part.trim())
    if (!selectors.includes(selector)) continue
    const declared = rule.style.getPropertyValue(property)
    if (declared) value = declared
  }
  return value
}

function toPx(value: string): number {
  if (value === '' || value === '0') return 0
  const match = value.match(/^([\d.]+)(rem|px)$/)
  if (!match) throw new Error(`Unsupported length: ${value}`)
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1)
}

function declarationsOf(source: string, selector: string): string {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = clean.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))
  return match?.[1] ?? ''
}

const EDGES = [
  '.sales-pos-workspace .sales-pos-workspace-header',
  '.sales-pos-workspace .sales-pos-draft-strip',
  '.sales-pos-workspace .sales-pos-split',
]
const WIDTHS = [375, 800, 1280, 1600]

describe('S11 — Venta workspace edges and gutters', () => {
  it.each(WIDTHS)('aligns heading, draft strip and split on one edge at %ipx', (width) => {
    for (const side of ['padding-left', 'padding-right']) {
      const values = EDGES.map((selector) => toPx(effective(workspaceCss, selector, side, width)))
      expect(new Set(values).size, `${side} at ${width}px: ${values.join(', ')}`).toBe(1)
    }
  })

  it('leaves the outer desktop gutter to the dashboard shell body (v0 total 32px)', () => {
    // The shell body already pads 24px from `sm`; v0's workspace gutter is 32px.
    for (const width of [1280, 1600]) {
      const own = toPx(effective(workspaceCss, '.sales-pos-workspace .sales-pos-split', 'padding-left', width))
      expect(own + 24).toBeLessThanOrEqual(32)
    }
  })

  it('keeps the panes and the results grid flush with the catalog controls', () => {
    for (const width of WIDTHS) {
      for (const selector of [
        '.sales-pos-workspace .sales-pos-catalog-pane',
        '.sales-pos-workspace .sales-pos-cart-pane',
        '.sales-pos-workspace .sales-pos-results',
      ]) {
        const left = effective(workspaceCss, selector, 'padding-left', width)
        expect(left, `${selector} at ${width}px`).not.toBe('')
        expect(toPx(left), `${selector} at ${width}px`).toBe(0)
      }
    }
  })
})

describe('S11 — cart rows and dividers', () => {
  it('never paints a hover background on padding-less cart rows', () => {
    for (const source of [workspaceCss, cartCss]) {
      const hoverPaint = scopedRules(source).filter(
        ({ rule }) => rule.selectorText.includes('.sales-pos-cart-row:hover') && rule.style.backgroundColor,
      )
      expect(hoverPaint.map(({ rule }) => rule.selectorText)).toEqual([])
    }
  })

  it('separates totals and the heading toolbar without extra full-bleed rules', () => {
    for (const selector of [
      '.sales-pos-cart-panel.sales-pos-cart-composition .sales-pos-totals',
      '.sales-pos-cart-panel.sales-pos-cart-composition .sales-pos-cart-toolbar',
    ]) {
      expect(effective(cartCss, selector, 'border-top-style', 1600), selector).toBe('none')
    }
  })
})

describe('S11 — Venta checkout paint', () => {
  it('maps the Nuxt warning and primary colors to readable semantic tokens', () => {
    const root = declarationsOf(checkoutCss, '.sales-pos-checkout')
    expect(root).toMatch(/--ui-warning:\s*var\(--hf-warning\)/)
    expect(root).toMatch(/--ui-primary:\s*var\(--hf-action\)/)
  })

  it('replaces the legacy gold method, total and due-date paint', () => {
    expect(
      effective(checkoutCss, '.sales-pos-checkout .sales-pos-checkout-method-tile > svg', 'color', 1280),
    ).toBe('var(--hf-muted)')
    // jsdom's CSSOM drops `color-mix()` values, so the hover wash is read from
    // the declaration text: it must repaint the inherited gold hover background.
    expect(
      declarationsOf(checkoutCss, '.sales-pos-checkout .sales-pos-checkout-method-tile:is(:hover, :focus-visible)'),
    ).toMatch(/background-color:\s*color-mix\(in srgb, var\(--hf-action\)/)
    expect(
      // jsdom serializes attribute selectors with double quotes.
      effective(checkoutCss, '.sales-pos-checkout [data-testid="expand-due-date"]', 'color', 1280),
    ).toBe('var(--hf-action)')
    expect(
      effective(checkoutCss, '.sales-pos-checkout .sales-pos-checkout-total', 'background-color', 1280),
    ).toBe('var(--hf-page)')
  })
})

describe('S11 — verifier follow-ups: cascade and touch targets', () => {
  it('outranks the workspace row-name size in either stylesheet order', () => {
    expect(
      effective(cartCss, '.sales-pos-cart-panel.sales-pos-cart-composition .sales-pos-cart-row-name', 'font-size', 1600),
    ).toBe('0.875rem')
  })

  it('keeps the heading options and the due-date link on the 44px target', () => {
    expect(
      effective(cartCss, '.sales-pos-cart-panel.sales-pos-cart-composition .sales-pos-cart-toolbar button', 'min-height', 1600),
    ).toBe('var(--hf-control-height)')
    expect(
      effective(checkoutCss, '.sales-pos-checkout [data-testid="expand-due-date"]', 'min-height', 1280),
    ).toBe('var(--hf-control-height)')
  })
})
