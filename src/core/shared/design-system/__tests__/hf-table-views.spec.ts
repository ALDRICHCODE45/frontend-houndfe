import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Premium tables T8 (S6): the saved-views bar from artboard 02 — tabs across the top of the table
// surface with an action-coloured underline on the selected one and a warning dot for unsaved changes.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('saved views bar', () => {
  it('scopes every views rule under .hf-ui', () => {
    const selectors = css.match(/[^{}]*\.hf-views[^{]*\{/g) ?? []
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) expect(selector.trim().startsWith('.hf-ui')).toBe(true)
  })

  it('separates the bar from the toolbar with a border and keeps the tabs on one scrollable line', () => {
    expect(block('.hf-ui .hf-views')).toMatch(/border-bottom: 1px solid var\(--hf-border\);/)
    expect(block('.hf-ui .hf-views__tabs')).toMatch(/overflow-x: auto;/)
    expect(block('.hf-ui .hf-views__tab')).toMatch(/white-space: nowrap;/)
  })

  it('marks the selected tab with weight and an action underline, not colour alone', () => {
    expect(block(".hf-ui .hf-views__tab[aria-selected='true']")).toMatch(/font-weight: 600;/)
    expect(block(".hf-ui .hf-views__tab[aria-selected='true']::after")).toMatch(/background-color: var\(--hf-action\);/)
    expect(block('.hf-ui .hf-views__tab:focus-visible')).toMatch(/outline: 2px solid var\(--hf-focus\);/)
  })

  it('paints unsaved changes with the warning role', () => {
    expect(block('.hf-ui .hf-views__dot')).toMatch(/background-color: var\(--hf-warning\);/)
    expect(block('.hf-ui .hf-views__unsaved')).toMatch(/color: var\(--hf-warning\);/)
  })
})
