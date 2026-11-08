import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Premium tables T6: row density (Compacta 40 / Normal 48 / Cómoda 64). AppDataTable sets
// `data-density` on the table root; Cómoda is today's row and keeps Nuxt's own cell padding, the
// other two set the row height, a thin vertical padding and only the primary line.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

const COMPACT = ".hf-ui [data-density='compact'] td[data-slot='td']"
const NORMAL = ".hf-ui [data-density='normal'] td[data-slot='td']"
const SECONDARY = ".hf-ui :is([data-density='compact'], [data-density='normal']) .hf-row-secondary"

describe('table density', () => {
  it('gives compact rows 40px and normal rows 48px with a thin vertical padding', () => {
    expect(block(COMPACT)).toMatch(/height: 2\.5rem;/)
    expect(block(COMPACT)).toMatch(/padding-block: 0\.125rem;/)
    expect(block(NORMAL)).toMatch(/height: 3rem;/)
    expect(block(NORMAL)).toMatch(/padding-block: 0\.125rem;/)
  })

  it('leaves the comfortable row and the header as they are', () => {
    expect(css).not.toMatch(/\[data-density='comfortable'\]/)
    expect(css).not.toMatch(/\[data-density='[a-z]+'\][^{]*th\[data-slot='th'\]/)
  })

  it('shows only the primary line in compact and normal rows', () => {
    expect(block(SECONDARY)).toMatch(/display: none;/)
  })

  it('spans the «Columnas» panel with the density control, scoped to the panel section', () => {
    expect(block('.hf-ui .hf-columns-density .hf-density')).toMatch(/width: 100%;/)
    expect(block('.hf-ui .hf-columns-density .hf-density__option')).toMatch(/flex: 1 1 0;/)
  })

  it('fits the row ⋮ in a compact row', () => {
    const trigger = block(".hf-ui [data-density='compact'] .hf-row-actions-trigger")
    expect(trigger).toMatch(/width: 2\.25rem;/)
    expect(trigger).toMatch(/min-width: 2\.25rem;/)
    expect(trigger).toMatch(/height: 2\.25rem;/)
  })
})

describe('«Guardado en tu vista» and the bulk bar', () => {
  it('fades the saved confirmation in a quiet success pill, without motion when asked', () => {
    const pill = block('.hf-ui .hf-table-saved')
    expect(pill).toMatch(/color: var\(--hf-success\);/)
    expect(block('.hf-ui :is(.hf-table-saved-enter-active, .hf-table-saved-leave-active)')).toMatch(/transition: opacity/)
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toMatch(/\.hf-table-saved/)
    expect(reduced).toMatch(/transition: none/)
  })

  it('anchors «Guardado en tu vista» under the toolbar right edge, out of the toolbar flow', () => {
    expect(block('.hf-ui .hf-toolbar-actions')).toMatch(/position: relative;/)
    const pill = block('.hf-ui .hf-table-saved')
    expect(pill).toMatch(/position: absolute;/)
    expect(pill).toMatch(/top: calc\(100% \+ 0\.25rem\);/)
    expect(pill).toMatch(/right: 0;/)
    expect(pill).toMatch(/pointer-events: none;/)
  })

  it('floats the bulk bar in the viewport, centred over the table surface, above the safe area', () => {
    const bar = block('.hf-ui .hf-bulk-bar')
    expect(bar).toMatch(/position: fixed;/)
    expect(bar).toMatch(/bottom: calc\(1\.5rem \+ env\(safe-area-inset-bottom, 0px\)\);/)
    expect(bar).toMatch(/left: var\(--hf-bulk-center, 50%\);/)
    expect(bar).toMatch(/translate: -50% 0;/)
    expect(bar).toMatch(/max-width: min\(var\(--hf-bulk-max, 100vw\), calc\(100vw - 2rem\)\);/)
    // Above the table (sticky header, pinned cells) and below overlays and toasts (z-50).
    expect(bar).toMatch(/z-index: 40;/)
    expect(bar).not.toMatch(/sticky/)
    expect(bar).toMatch(/background-color: var\(--hf-surface\);/)
    expect(bar).toMatch(/border-radius: var\(--hf-radius-card\);/)
    expect(block('.hf-ui .hf-bulk-bar__danger')).toMatch(/color: var\(--hf-danger\);/)
  })
})
