import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Structural cascade contracts, not rendered geometry or contrast. These
// targets use simple, unlayered class selectors; compare their declarations
// by specificity and order instead of jsdom's incomplete computed-style engine.
const cart = readFileSync('src/features/POS/sales/styles/sales-pos-cart.css', 'utf8')
const workspace = readFileSync('src/features/POS/sales/styles/sales-pos-workspace.css', 'utf8')
const legacy = readFileSync('src/features/POS/sales/styles/sales-entry-visual.css', 'utf8')
const elements: HTMLElement[] = []

function selectors(value: string): string[] {
  const result: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(' || char === '[') depth += 1
    if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      result.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  result.push(value.slice(start).trim())
  return result
}

function winner(sources: string[], target: Element, property: string): string | undefined {
  let result: string | undefined
  let weight = -1
  for (const source of sources) {
    const style = document.createElement('style')
    style.textContent = source.replace(/^@import.*$/gm, '')
    document.head.append(style)
    elements.push(style)
    for (const entry of Array.from(style.sheet?.cssRules ?? [])) {
      // The audited declarations are top-level, not media/layer declarations.
      if (entry.type !== CSSRule.STYLE_RULE) continue
      const rule = entry as CSSStyleRule
      const value = rule.style.getPropertyValue(property).trim()
      if (!value) continue
      for (const selector of selectors(rule.selectorText)) {
        if (!target.matches(selector)) continue
        expect(selector).toMatch(/^[\w.\s>-]+$/)
        expect(rule.style.getPropertyPriority(property)).toBe('')
        const specificity = (selector.match(/\.[\w-]+/g) ?? []).length
        if (specificity >= weight) {
          weight = specificity
          result = value
        }
      }
    }
  }
  return result
}

function cartBody(mobile: boolean, composition: boolean): HTMLElement {
  const root = document.createElement('div')
  root.className = mobile ? 'sales-pos-cart' : 'sales-pos-workspace'
  const panel = document.createElement('div')
  panel.className = `sales-pos-cart-panel${composition ? ' sales-pos-cart-composition' : ''}`
  const body = document.createElement('section')
  body.className = 'sales-pos-cart-body'
  panel.append(body)
  root.append(panel)
  document.body.append(root)
  elements.push(root)
  return body
}

function catalogSurface(ownedWorkspace: boolean): HTMLElement {
  const root = document.createElement('div')
  root.className = `hf-theme hf-ui sales-entry-visual${ownedWorkspace ? ' sales-pos-workspace' : ''}`
  const search = document.createElement('div')
  search.className = 'sales-entry-product-search sales-pos-catalog'
  const surface = document.createElement('div')
  surface.className = 'sticky sales-pos-catalog-controls-surface'
  search.append(surface)
  root.append(search)
  document.body.append(root)
  elements.push(root)
  return surface
}

afterEach(() => {
  elements.splice(0).forEach((element) => element.remove())
})

const cartOrders = [
  { label: 'cart before workspace', sources: [cart, workspace] },
  { label: 'workspace before cart', sources: [workspace, cart] },
]

describe.each(cartOrders)('cart cascade — $label', ({ sources }) => {
  it.each([false, true])('keeps composition padding zero in mobile=%s', (mobile) => {
    expect(winner(sources, cartBody(mobile, true), 'padding-block')).toMatch(/^0(?:px)?$/)
  })
  it.each([false, true])('keeps legacy padding when composition is omitted in mobile=%s', (mobile) => {
    expect(winner(sources, cartBody(mobile, false), 'padding-block')).toBe('0.25rem')
  })
})

describe.each([
  { label: 'legacy before workspace', sources: [legacy, workspace] },
  { label: 'workspace before legacy', sources: [workspace, legacy] },
])('catalog cascade — $label', ({ sources }) => {
  it('uses the solid semantic surface inside the owned workspace', () => {
    expect(winner(sources, catalogSurface(true), 'background-color')).toBe('var(--hf-surface)')
  })
  it('does not replace the legacy surface outside the owned workspace', () => {
    expect(winner(sources, catalogSurface(false), 'background-color')).toBe(
      'color-mix(in srgb, var(--hf-surface) 85%, transparent)',
    )
  })
})
