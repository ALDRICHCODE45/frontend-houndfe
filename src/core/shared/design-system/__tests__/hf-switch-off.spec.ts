import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// An off switch on the default accented track nearly matches the card in the dark theme and fails
// non-text contrast (WCAG 1.4.11). Products (Ocultar precios, Mayoreo) and Notificaciones showed
// the same invisible off switches, so the outline lives in core for every switch inside .hf-ui.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, s]) => s!.split(',').map(x => x.trim()).includes(selector))?.[2]

describe('off switch', () => {
  it('gives every unchecked .hf-ui switch a muted track with a --hf-muted inset outline', () => {
    const track = rule(".hf-ui [role='switch'][data-state='unchecked']")
    expect(track).toMatch(/background-color: var\(--hf-surface-muted\)/)
    expect(track).toMatch(/box-shadow: inset 0 0 0 1px var\(--hf-muted\)/)
  })

  it('paints the unchecked thumb muted', () => {
    expect(rule(".hf-ui [role='switch'][data-state='unchecked'] [data-slot='thumb']")).toMatch(/background-color: var\(--hf-muted\)/)
  })
})
