import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The «Columnas» panel and sheet (premium tables T5) render in portals that carry `hf-theme hf-ui`;
// their rules stay scoped to that root and use the theme roles, never raw colours.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  // Split the selector list on top-level commas only (`:is(a, b)` stays whole).
  .map(([, selector, body]) => ({ selectors: selector!.split(/,(?![^(]*\))/).map(item => item.trim()), body: body! }))
  .filter(rule => rule.selectors.some(selector => selector.includes('hf-columns-')))

describe('«Columnas» panel styles', () => {
  it('defines the panel, rows, pin buttons, guide and sheet', () => {
    const all = rules.flatMap(rule => rule.selectors)
    for (const part of ['.hf-columns-panel', '.hf-columns-row', '.hf-columns-pin', '.hf-columns-guide', '.hf-columns-sheet']) {
      expect(all.some(selector => selector.includes(part))).toBe(true)
    }
  })

  it('scopes every rule under .hf-ui and paints with theme roles only', () => {
    for (const rule of rules) {
      for (const selector of rule.selectors) expect(selector.startsWith('.hf-ui ')).toBe(true)
      expect(rule.body).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i)
    }
  })

  it('marks a pressed pin with the active role', () => {
    const pressed = rules.find(rule => rule.selectors.includes(".hf-ui .hf-columns-pin[aria-pressed='true']"))
    expect(pressed?.body).toMatch(/color: var\(--hf-active\)/)
  })
})
