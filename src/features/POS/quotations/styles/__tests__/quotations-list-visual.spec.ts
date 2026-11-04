import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Quotations listing visual adapter contracts (T2 — S1, S3, S4).
 *
 * Source and cascade contracts only. jsdom never renders light/dark fidelity,
 * teleported geometry or browser behaviour, so the visual smoke remains
 * user-owned. Every path asserted here belongs to the T2 authored surface;
 * `houndfe-ui.css` and `coco-tokens.css` are read, never changed.
 */

const cssPath = 'src/features/POS/quotations/styles/quotations-list-visual.css'
const sharedPath = 'src/core/shared/design-system/houndfe-ui.css'
const cocoPath = 'src/features/POS/quotations/styles/coco-tokens.css'
const viewPath = 'src/features/POS/quotations/views/QuotationsListView.vue'

const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const sharedCss = readFileSync(sharedPath, 'utf8')
const coco = readFileSync(cocoPath, 'utf8')
const view = readFileSync(viewPath, 'utf8')

const PORTAL_MARKER = 'hf-theme hf-ui quotations-list-portal'
const OVERLAY_MARKER = 'hf-theme hf-ui hf-form-overlay quotations-list-portal'

const styles: HTMLStyleElement[] = []

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

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
      // Discriminate on shape instead of the deprecated `CSSRule.type`.
      if ('selectorText' in rule) collected.push(rule as CSSStyleRule)
      else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
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

describe('Quotations listing adapter — scope and tokens (S1/S3/S4)', () => {
  it('loads a scoped adapter and no longer pulls the Coco tokens', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).not.toContain('coco-tokens')
    expect(view).toContain("import '../styles/quotations-list-visual.css'")
    // The legacy Coco stylesheet stays for the detail view only.
    expect(coco).toContain('@layer coco-quotations')
    expect(coco).not.toContain('quotations-list-visual')
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toContain('.products-visual')
    expect(css).not.toContain('.clients-visual')
    expect(css).not.toContain('hf-shell-products-portal')
  })

  it('uses foundation semantic roles only: no palette literals and no global alias overrides', () => {
    // No hex/rgb palette values and no local --hf-* palette re-declaration:
    // light and dark come from houndfe-theme.css through the hf-theme boundary.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(
      /--hf-(page|surface|surface-muted|field|ink|heading|muted|border|action|on-action|active|active-soft|focus)\s*:/,
    )
    expect(css).not.toMatch(/--ui-[a-z-]+\s*:/)
    expect(css).not.toMatch(/--radius-[a-z0-9]+\s*:/)
  })

  it('themes the real routed root and owns the listing/portal markers', () => {
    expect(view).toMatch(/class="hf-theme hf-ui quotations-list-visual[^"]*"/)
    expect(view).toContain(`portal-class="${PORTAL_MARKER}"`)
    expect(view).toContain(`pagination-portal-class="${PORTAL_MARKER}"`)
    expect(view).toContain(`:ui="{ content: '${OVERLAY_MARKER}' }"`)
    expect(view).not.toContain('hf-shell-products-portal')
  })

  it('keeps the table surface/content hooks and drops the Coco neutral body override', () => {
    expect(view).toMatch(/hf-table-surface/)
    expect(view).toMatch(/hf-table-content/)
    expect(view).toMatch(/hf-data-table/)
    expect(view).not.toMatch(/bg-coco-neutral-/)
    expect(view).not.toMatch(/--coco-|coco-/)
  })

  it('retires the card grid and the view toggle in favour of table + cards', () => {
    expect(view).not.toContain('ViewToggle')
    expect(view).not.toContain('useQuotationViewMode')
    expect(view).toContain('mobile-render="cards"')
    expect(view).toContain('#mobile-card')
    expect(view).toContain(':row-open="goToDetail"')
  })

  it('styles money as tabular figures and keeps keyboard focus on semantic roles', () => {
    expect(css).toContain('.quotations-list-visual .quotations-total-value')
    expect(css).toContain('font-variant-numeric: tabular-nums')
    expect(css).toContain('.quotations-list-visual .quotations-status-tab:focus-visible')
    expect(css).toContain('.quotations-list-visual .quotation-row-link:focus-visible')
    expect(css).toContain('var(--hf-focus)')
  })

  it('never selects shared data slots or global elements from the listing scope', () => {
    const selectors = selectorsOf(css)
    expect(selectors.length).toBeGreaterThan(0)
    expect(selectors.some((selector) => /^(?:\*|html|body|:root)$/.test(selector))).toBe(false)
    for (const selector of selectors) {
      // Every rule is anchored on an owned marker; no element-blind target.
      expect(selector).toMatch(/\.quotations-list-(?:visual|portal)/)
      expect(selector).not.toContain('[data-slot=')
      expect(selector).not.toMatch(/^(?:\*|html|body|:root|button|input|select|textarea|a|table)\b/)
    }
  })

  it('paints the teleported boundary from the foundation roles only once opted in', () => {
    const rules = styleRules(css)
    const portalRule = rules.find(
      (rule) => rule.selectorText.trim() === '.hf-theme.quotations-list-portal',
    )
    expect(portalRule).toBeDefined()
    expect(portalRule!.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(portalRule!.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    expect(portalRule!.style.getPropertyValue('color').trim()).toBe('var(--hf-ink)')

    // The overlay/portal marker matches the owned rule AND the shared adapter,
    // so the semantic aliases and the local surface resolve on the same root.
    const portal = document.createElement('div')
    portal.className = OVERLAY_MARKER
    document.body.append(portal)
    expect(portal.matches(portalRule!.selectorText)).toBe(true)
    const adapterRoot = styleRules(sharedCss).find((rule) => rule.selectorText.trim() === '.hf-ui')!
    expect(adapterRoot).toBeDefined()
    expect(portal.matches(adapterRoot.selectorText)).toBe(true)
    expect(adapterRoot.style.getPropertyValue('--ui-bg').trim()).toBe('var(--hf-surface)')

    // Negative control: a plain shared boundary without the local marker must
    // not inherit the Quotations portal surface.
    const other = document.createElement('div')
    other.className = 'hf-theme hf-ui'
    document.body.append(other)
    expect(other.matches(portalRule!.selectorText)).toBe(false)

    portal.remove()
    other.remove()
  })
})
