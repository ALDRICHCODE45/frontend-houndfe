import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// C3: `.hf-figure` was `text-align: right` everywhere, which also right-aligned the figures of stat
// cards and summary panels. The numeric alignment belongs to table cells only; a figure in a card
// keeps tabular numerals and follows the card's own alignment.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selector: selector!.trim(),
  body: body!,
}))
const figureRules = rules.filter(({ selector }) => selector.includes('.hf-figure'))

describe('hf-figure alignment is scoped to table cells', () => {
  it('keeps tabular numerals on every figure', () => {
    const base = figureRules.find(({ selector }) => selector === '.hf-ui .hf-figure')
    expect(base?.body).toMatch(/font-variant-numeric: tabular-nums/)
  })

  it('does not right-align a bare figure', () => {
    const base = figureRules.find(({ selector }) => selector === '.hf-ui .hf-figure')
    expect(base?.body).not.toMatch(/text-align/)
  })

  it('right-aligns a figure only inside a table cell', () => {
    const aligned = figureRules.filter(({ body }) => /text-align: right/.test(body))
    expect(aligned.length).toBeGreaterThan(0)
    for (const { selector } of aligned) {
      for (const part of selector.split(',').map(s => s.trim())) {
        expect(part).toMatch(/\b(td|th)\b|\[role='(cell|columnheader)'\]/)
      }
    }
  })
})
