import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// One neutral header for every table. The blue band came from the core itself: the header painted
// `--hf-surface-muted` (a blue wash) with the navy `--hf-heading`, and the Products-only shell bridge
// swapped in a different blue, so Products and the other lists never matched.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

const TABLE = '.hf-ui .hf-data-table'
const THEAD = ".hf-ui .hf-data-table thead[data-slot='thead']"
const TH = ".hf-ui .hf-data-table th[data-slot='th']"
const PINNED_TH = ".hf-ui .hf-data-table th[data-slot='th'][data-pinned]"

describe('data table header is one neutral style', () => {
  it('defines the header wash once, as a neutral mix of ink over the surface', () => {
    const head = block(TABLE).match(/--hf-table-head:\s*([^;]+);/)
    expect(head).not.toBeNull()
    expect(head![1]).toMatch(/color-mix\(in srgb, var\(--hf-ink\) \d+%, var\(--hf-surface\)\)/)
    expect(head![1]).not.toMatch(/surface-muted|active-soft|action|heading/)
  })

  it('paints the thead and the pinned header cell with that same wash, never a blue role', () => {
    expect(block(THEAD)).toMatch(/background-color: var\(--hf-table-head\);/)
    expect(block(PINNED_TH)).toMatch(/background-color: var\(--hf-table-head\);/)
    expect(block(THEAD)).not.toMatch(/surface-muted|active-soft|action/)
  })

  it('reads headings as muted 13px/600 text, not navy', () => {
    const th = block(TH)
    expect(th).toMatch(/color: var\(--hf-muted\);/)
    expect(th).toMatch(/font-size: 0\.8125rem;/)
    expect(th).toMatch(/font-weight: 600;/)
    expect(th).not.toMatch(/--hf-heading/)
  })

  it('keeps the sort buttons readable on the neutral wash', () => {
    expect(block(`${TH} button`)).toMatch(/color: inherit;/)
  })
})
