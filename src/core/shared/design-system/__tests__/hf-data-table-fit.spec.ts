import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// jsdom has no layout, so this pins the CSS contract that makes a table of up to 8 columns fit the
// card at 1440 with the sidebar open: cells shrink and truncate instead of widening the table, and
// the Acciones column keeps its 64px without ever overlapping its neighbours.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

const CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th'])"
const CHECKBOX_CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th']):has([role='checkbox'])"
const ACTIONS_CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th']).w-16"
const PINNED_CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th'])[data-pinned]"

describe('data table fits its card (no horizontal scroll up to 8 columns)', () => {
  it('lets cells shrink below their text and truncate with an ellipsis', () => {
    const cells = block(CELLS)
    expect(cells).toMatch(/max-width: 0/)
    expect(cells).toMatch(/overflow: hidden/)
    expect(cells).toMatch(/text-overflow: ellipsis/)
  })

  it('keeps a floor wide enough for a status badge, so 8 columns still sum under the card width', () => {
    const floor = block(CELLS).match(/min-width: ([\d.]+)rem/)
    expect(floor).not.toBeNull()
    const rem = Number(floor![1])
    expect(rem).toBeGreaterThanOrEqual(6)
    // 7 text columns + the 64px Acciones column + a 48px selection column in the ~1020px card.
    expect(7 * rem * 16 + 64 + 48).toBeLessThanOrEqual(1020)
  })

  it('reserves exactly 64px for the Acciones column and never clips the menu', () => {
    const actions = block(ACTIONS_CELLS)
    expect(actions).toMatch(/width: 4rem/)
    expect(actions).toMatch(/min-width: 4rem/)
    expect(actions).toMatch(/max-width: 4rem/)
    expect(actions).toMatch(/overflow: visible/)
  })

  it('keeps the selection checkbox column at its own width', () => {
    const checkbox = block(CHECKBOX_CELLS)
    expect(checkbox).toMatch(/width: 3rem/)
    expect(checkbox).toMatch(/max-width: 3rem/)
    expect(checkbox).toMatch(/overflow: visible/)
  })

  it('paints pinned cells opaque, so a scrolled neighbour never shows through the menu', () => {
    const pinned = block(PINNED_CELLS)
    expect(pinned).toMatch(/background-color: var\(--hf-surface\);/)
    expect(pinned).not.toMatch(/\/75|opacity/)
  })
})
