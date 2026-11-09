// catalog-visual.spec.ts — source contract for the public catalog stylesheet:
// restrained weights, no uppercase eyebrows, tokens instead of hex literals and
// a forced-light bridge so the shared hf pieces never turn dark on this surface.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/catalog/styles/catalog.css', 'utf8')

/** The stylesheet without its token block and `var(--x, fallback)` fallbacks. */
function withoutTokens(source: string): string {
  const start = source.indexOf("body[data-catalog-theme='light'] {\n  --catalog-page")
  const end = source.indexOf('}', start)
  return (source.slice(0, start) + source.slice(end + 1)).replace(/var\([^)]*\)/g, 'var()')
}

describe('catalog stylesheet', () => {
  it('uses the 400-600 weight scale only', () => {
    expect(css).not.toMatch(/font-weight:\s*(?:7|8|9)\d\d/)
  })

  it('has no uppercase eyebrows or tracked micro-labels', () => {
    expect(css).not.toMatch(/text-transform:\s*uppercase/)
    expect(css).not.toMatch(/letter-spacing:\s*1(?:\.\d+)?px/)
  })

  it('keeps hex literals inside the token block', () => {
    expect(withoutTokens(css)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('does not restyle palette utilities to hide them', () => {
    expect(css).not.toMatch(/\.(?:bg|text)-(?:coco|emerald|amber|red)[\w-]*/)
  })

  it('declares the status tones once, as catalog tokens', () => {
    for (const name of ['--catalog-success', '--catalog-warning', '--catalog-active-soft']) {
      expect(css, name).toContain(`${name}:`)
    }
    expect(css).toMatch(/\.catalog-availability\[data-tone='success'\]/)
    expect(css).toMatch(/\.catalog-availability\[data-tone='warning'\]/)
    expect(css).toMatch(/\.catalog-availability\[data-tone='neutral'\]/)
  })

  it('bridges the shared hf roles to the forced-light catalog palette', () => {
    expect(css).toMatch(/html body\.hf-theme\[data-catalog-theme='light'\]/)
    expect(css).toContain('--hf-surface: var(--catalog-surface)')
    expect(css).toContain('--hf-heading: var(--catalog-title)')
    expect(css).toContain('--hf-muted: var(--catalog-muted)')
  })

  it('binds the soft danger surface and border too, so the error state stays readable in a dark OS theme', () => {
    const bridge = css.slice(css.indexOf("html body.hf-theme[data-catalog-theme='light']"))
    const block = bridge.slice(0, bridge.indexOf('}'))
    expect(block).toContain('--hf-danger-soft: var(--catalog-danger-soft)')
    expect(block).toContain('--hf-danger-border: var(--catalog-danger-border)')
  })

  it('keeps the phone footer compact (mobile-first base): a 40px logo and tight lines', () => {
    const base = css.slice(0, css.indexOf('@media (min-width: 601px) {'))
    expect(base).toMatch(/\.catalog-footer \.catalog-logo \{[^}]*width: 40px/)
    expect(base).toMatch(/\.catalog-footer \{[^}]*padding-block: 20px/)
    expect(base).toMatch(/\.catalog-footer p \{[^}]*margin-top: 4px/)
    // From 601px the roomier footer comes back.
    const desktop = css.slice(css.indexOf('@media (min-width: 601px) {'))
    expect(desktop).toMatch(/\.catalog-footer \.catalog-logo \{[^}]*width: 80px/)
  })

  it('pins skeleton cards that respect reduced motion', () => {
    expect(css).toContain('.catalog-skeleton-card')
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*catalog-skeleton/)
  })

  it('retires its own state box: loading and failures use the shared EmptyState and card skeletons', () => {
    expect(css).not.toMatch(/\.catalog-state\b/)
    expect(css).toContain('.catalog-skeleton-pill')
    expect(css).toContain('.catalog-category-error')
  })

  it('keeps the phone header to one compact row: small logo, branch and price list side by side', () => {
    const base = css.slice(css.indexOf('.catalog-header-inner {'), css.indexOf('.catalog-branch-trigger {'))
    expect(base).toContain('grid-template-columns: 48px minmax(0, 1fr) auto')
    expect(base).toMatch(/\.catalog-logo \{[^}]*width: 48px/)
    expect(base).toMatch(/\.catalog-header-controls \{[^}]*grid-column: 3[^}]*max-width: 8\.5rem/)
    // From 601px the desktop logo and spacing come back.
    const desktop = css.slice(css.indexOf('@media (min-width: 601px) {'))
    expect(desktop).toMatch(/\.catalog-header \.catalog-logo \{[^}]*width: 80px/)
  })

  it('keeps the footer lines close on a phone and spaced on desktop', () => {
    expect(css).toMatch(/\.catalog-footer-inner \{[^}]*gap: 8px 32px/)
    const desktop = css.slice(css.indexOf('@media (min-width: 601px) {'))
    expect(desktop).toMatch(/\.catalog-footer-inner \{[^}]*gap: 28px 32px/)
  })

  it('keeps every attribute facet on one sideways row on a phone and lets them flow side by side on desktop', () => {
    const facets = css.slice(css.indexOf('.catalog-facets {'))
    const phone = facets.slice(0, facets.indexOf('@media (min-width: 601px) {'))
    // Phone: one scrolling row (eight definitions stacked pushed the products off screen).
    // Only the groups scroll; «Limpiar filtros» is a separate item before the scroller and is
    // never pinned over it (a sticky clear covered the first label «Especie»).
    expect(phone).toMatch(/\.catalog-facet-scroller \{[^}]*overflow-x: auto/)
    expect(phone).not.toMatch(/\.catalog-facets \{[^}]*overflow-x/)
    expect(phone).not.toMatch(/\.catalog-facets \{[^}]*flex-direction: column/)
    expect(phone).toMatch(/\.catalog-facet-group \{[^}]*flex: none/)
    expect(phone).toMatch(/\.catalog-facet-chip \{[^}]*min-height: 44px/)
    expect(phone).toMatch(/\.catalog-facet-clear \{[^}]*flex: none[^}]*order: -1/)
    expect(facets).not.toMatch(/\.catalog-facet-clear \{[^}]*position: (?:sticky|absolute|fixed)/)
    const desktop = facets.slice(facets.indexOf('@media (min-width: 601px) {'))
    expect(desktop).toMatch(/\.catalog-facets \{[^}]*flex-wrap: wrap/)
    expect(desktop).toMatch(/\.catalog-facet-scroller \{[^}]*display: contents/)
    expect(desktop).toMatch(/\.catalog-facet-group \{[^}]*flex-direction: column/)
    expect(desktop).toMatch(/\.catalog-facet-clear \{[^}]*order: 0/)
  })
})
