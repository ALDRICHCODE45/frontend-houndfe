import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// jsdom has no layout, so this pins the CSS contract of the premium tables: AppDataTable gives every
// column a width (`--hf-col-w-<id>`, user-set or default) and the table their sum (`--hf-table-w`) on a
// fixed layout; cells truncate inside their width instead of widening the table, and the surface
// scrolls horizontally when the columns exceed it. The Acciones and selection columns keep their
// widths, pinned cells stay opaque, and the pinned edge shows only while content scrolls under it.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

const ROOT = ".hf-ui .hf-data-table [data-slot='root']:has(table[data-slot='base'])"
const TABLE = ".hf-ui .hf-data-table table[data-slot='base']"
const CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th'])"
const CHECKBOX_CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th']):has([role='checkbox'])"
const ACTIONS_CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th']).w-16"
const PINNED_CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th'])[data-pinned]"
const BADGE_CELLS = ".hf-ui .hf-data-table :is(td[data-slot='td'], th[data-slot='th']):has(.hf-status-badge)"

describe('data table widths are user-set on a fixed layout', () => {
  it('lays the table out from the column widths, not from its content', () => {
    const table = block(TABLE)
    expect(table).toMatch(/table-layout: fixed/)
    expect(table).toMatch(/width: var\(--hf-table-w, 100%\)/)
    expect(table).toMatch(/min-width: 100%/)
    // A max-width would squeeze user widths back into the card.
    expect(table).toMatch(/max-width: none/)
  })

  it('scrolls horizontally inside the surface when the columns exceed it', () => {
    const root = block(ROOT)
    expect(root).toMatch(/max-width: 100%/)
    expect(root).toMatch(/overflow-x: auto/)
    expect(root).toMatch(/overscroll-behavior-x: contain/)
  })

  it('truncates a cell inside its width with an ellipsis and no auto-layout floor', () => {
    const cells = block(CELLS)
    expect(cells).toMatch(/overflow: hidden/)
    expect(cells).toMatch(/text-overflow: ellipsis/)
    expect(cells).toMatch(/padding-inline: 0\.75rem/)
    expect(cells).not.toMatch(/max-width: 0/)
    expect(cells).not.toMatch(/min-width/)
  })

  it('no longer gives the name column a share of the card in CSS (its width is a column width)', () => {
    expect(css).not.toMatch(/\.hf-col-primary \{[^}]*width: \d+%/)
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

  it('never truncates a status badge', () => {
    const badge = block(BADGE_CELLS)
    expect(badge).toMatch(/overflow: visible/)
    expect(badge).toMatch(/white-space: nowrap/)
    expect(badge).toMatch(/text-overflow: clip/)
  })

  it('paints pinned cells opaque, so a scrolled neighbour never shows through the menu', () => {
    const pinned = block(PINNED_CELLS)
    expect(pinned).toMatch(/background-color: var\(--hf-surface\);/)
    expect(pinned).not.toMatch(/\/75|opacity/)
  })
})

const EDGE_LEFT = ".hf-ui .hf-table-scrolled-left :is(td[data-slot='td'], th[data-slot='th']).hf-pin-edge-left"
const EDGE_RIGHT = ".hf-ui .hf-table-scrolled-right :is(td[data-slot='td'], th[data-slot='th']).hf-pin-edge-right"
const EDGES = ".hf-ui :is(td[data-slot='td'], th[data-slot='th']):is(.hf-pin-edge-left, .hf-pin-edge-right)"

describe('the pinned edge shows only while content scrolls under it', () => {
  it('draws a divider and a soft shadow on the left edge while scrolled from the start', () => {
    const edge = block(EDGE_LEFT)
    expect(edge).toMatch(/box-shadow: inset -1px 0 0 var\(--hf-border\), \d+px 0 \d+px -\d+px color-mix\(in srgb, var\(--hf-ink\) \d+%, transparent\);/)
  })

  it('draws them on the right edge while there is more content to the right', () => {
    const edge = block(EDGE_RIGHT)
    expect(edge).toMatch(/box-shadow: inset 1px 0 0 var\(--hf-border\), -\d+px 0 \d+px -\d+px color-mix\(in srgb, var\(--hf-ink\) \d+%, transparent\);/)
  })

  it('fades the edge in, without motion when the user asks for less', () => {
    expect(block(EDGES)).toMatch(/transition: box-shadow/)
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toMatch(/\.hf-pin-edge-left/)
    expect(reduced).toMatch(/\[data-resize-handle\]/)
    expect(reduced).toMatch(/transition: none/)
  })
})

const HANDLE = ".hf-ui [data-resize-handle]"

describe('the resize handle', () => {
  it('is an 8px col-resize hit area on the right edge of the header', () => {
    const handle = block(HANDLE)
    expect(handle).toMatch(/width: 8px/)
    expect(handle).toMatch(/right: 0/)
    expect(handle).toMatch(/cursor: col-resize/)
    expect(handle).toMatch(/touch-action: none/)
  })

  it('shows a faint line on header hover and the action colour while active or focused', () => {
    expect(block(".hf-ui th[data-slot='th']:hover [data-resize-handle]::after")).toMatch(/background-color: var\(--hf-border\)/)
    expect(
      block(".hf-ui :is([data-resize-handle]:hover, [data-resize-handle]:focus-visible, [data-resize-handle][data-resizing])::after"),
    ).toMatch(/background-color: var\(--hf-action\)/)
  })
})
