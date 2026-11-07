import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Premium tables T7 (S5): the totals row. UTable writes `data-pinned="false"` on every unpinned
// cell, so a bare `[data-pinned]` selector matches all footer cells; the totals rules must name the
// pinned sides, or every empty footer cell is raised over the label that runs across it.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({ selector: selector!.trim(), body: body! }))
const totals = rules.filter(rule => rule.selector.includes('hf-table-totals'))
const zIndex = (rule: { body: string }) => Number(rule.body.match(/z-index:\s*(\d+)/)?.[1] ?? NaN)

describe('totals row layers', () => {
  it('never selects pinned footer cells with a bare [data-pinned]', () => {
    expect(totals.length).toBeGreaterThan(0)
    for (const rule of totals) expect(rule.selector).not.toMatch(/\[data-pinned\](?!=)/)
  })

  it('raises the label over its empty unpinned neighbours and keeps pinned cells above a scrolled label', () => {
    const label = totals.find(rule => /\[data-hf-totals-label\]\s*$/.test(rule.selector))!
    const pinned = totals.find(rule => rule.selector.includes("[data-pinned='left']") && /z-index/.test(rule.body))!
    const pinnedLabel = totals.find(rule => rule.selector.includes("[data-hf-totals-label='pinned']"))!
    expect(label.body).toMatch(/overflow: visible/)
    expect(zIndex(label)).toBeGreaterThan(0)
    expect(zIndex(pinned)).toBeGreaterThan(zIndex(label))
    expect(zIndex(pinnedLabel)).toBeGreaterThan(zIndex(pinned))
  })

  it('drops UTable\'s separator row from the footer (the cells draw their own hairline)', () => {
    const separator = totals.find(rule => rule.selector.includes("tr[data-slot='separator']"))
    expect(separator?.body).toMatch(/display: none/)
  })
})
