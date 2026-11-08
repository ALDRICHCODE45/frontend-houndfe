import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Premium tables T10 polish (artboard 01). jsdom has no layout, so this pins the CSS contract:
// the header grip lives in the cell's left padding (the label keeps its place), the ⋯ overlays the
// right padding with a fade of the header wash instead of pushing the label, a status badge never
// runs into the next cell when its column is at its minimum, and «Guardado en tu vista» has a
// surface anchor for tables without a toolbar.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}
const HOVER = ":is(th[data-slot='th']:hover, th[data-slot='th']:focus-within)"

describe('header grip and ⋯ float over the cell padding', () => {
  it('puts the grip inside the 12px left padding, clear of the label', () => {
    const grip = block('.hf-ui .hf-th-grip')
    expect(grip).toMatch(/position: absolute;/)
    // Box from -14px to -2px: it ends before the label starts.
    expect(grip).toMatch(/left: -0\.875rem;/)
    expect(grip).toMatch(/width: 0\.75rem;/)
    expect(block('.hf-ui .hf-th-grip__icon')).toMatch(/width: 0\.75rem;/)
  })

  it('overlays the ⋯ on the right padding with a fade of the header wash behind it', () => {
    const menu = block('.hf-ui .hf-th-menu')
    expect(menu).toMatch(/position: absolute;/)
    expect(menu).toMatch(/right: -0\.625rem;/)
    expect(menu).toMatch(/background-color: var\(--hf-table-head\);/)
    const fade = block('.hf-ui .hf-th-menu::before')
    expect(fade).toMatch(/right: 100%;/)
    expect(fade).toMatch(/linear-gradient\(to right, transparent, var\(--hf-table-head\)\)/)
    expect(fade).toMatch(/pointer-events: none;/)
  })

  it('no longer pads a left-aligned label on hover; only what must stay visible gets room', () => {
    expect(css).not.toContain(`.hf-ui ${HOVER} .hf-th-target {`)
    const room = block(
      `.hf-ui ${HOVER} :is(.hf-th-target:has(.hf-th-sort), th[data-slot='th'].text-right .hf-th-target)`,
    )
    expect(room).toMatch(/padding-right: 1\.25rem;/)
    expect(block(`.hf-ui ${HOVER} .hf-th:has(.hf-th-pin)`)).toMatch(/padding-right: 1\.25rem;/)
    expect(css).not.toMatch(/padding-right: 1\.75rem/)
  })

  it('keeps the visible focus ring on the header target', () => {
    expect(block('.hf-ui .hf-th-target:focus-visible')).toMatch(/box-shadow: inset 0 0 0 2px var\(--hf-focus\);/)
  })
})

describe('status badges stay inside their cell', () => {
  it('shrinks a table badge to its cell and ends the label in an ellipsis', () => {
    const badge = block('.hf-ui .hf-data-table td[data-slot=\'td\'] .hf-status-badge')
    expect(badge).toMatch(/display: inline-block;/)
    expect(badge).toMatch(/max-width: 100%;/)
    expect(badge).toMatch(/overflow: hidden;/)
    expect(badge).toMatch(/text-overflow: ellipsis;/)
    expect(badge).toMatch(/vertical-align: middle;/)
  })

  it('keeps the dot and the urgent icon on the label line', () => {
    const marks = block(
      ".hf-ui .hf-data-table td[data-slot='td'] .hf-status-badge :is(.hf-status-badge__dot, .hf-status-badge__icon)",
    )
    expect(marks).toMatch(/display: inline-block;/)
    expect(marks).toMatch(/vertical-align: middle;/)
  })
})

describe('«Guardado en tu vista» without a toolbar', () => {
  it('anchors the pill at the table surface top-right, above the cells, never blocking them', () => {
    const pill = block('.hf-ui .hf-table-saved--surface')
    expect(pill).toMatch(/top: 0\.375rem;/)
    expect(pill).toMatch(/right: 0\.5rem;/)
    expect(pill).toMatch(/z-index: 6;/)
    expect(block('.hf-ui .hf-table-saved')).toMatch(/pointer-events: none;/)
  })
})
