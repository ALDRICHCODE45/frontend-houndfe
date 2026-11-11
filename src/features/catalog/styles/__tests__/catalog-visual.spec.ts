// catalog-visual.spec.ts — source contract for the public catalog stylesheet:
// restrained weights, no uppercase eyebrows, tokens instead of hex literals and
// a forced-light bridge so the shared hf pieces never turn dark on this surface.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/catalog/styles/catalog.css', 'utf8')

/** The stylesheet without its token block and `var(--x, fallback)` fallbacks. */
function withoutTokens(source: string): string {
  const start = source.indexOf("body[data-catalog-theme='light'],\n.catalog-layout {\n  --catalog-page")
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

  it('repeats the light tokens on the layout root as a net for a missing body boundary', () => {
    expect(css).toContain("body[data-catalog-theme='light'],\n.catalog-layout {\n  --catalog-page")
    expect(css).toContain("html body.hf-theme[data-catalog-theme='light'],\nhtml body .catalog-layout {")
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
    // The logo stays ~40px on every width, like the artboard (no oversized logo on desktop).
    const desktop = css.slice(css.indexOf('@media (min-width: 601px) {'))
    expect(desktop).not.toMatch(/\.catalog-footer \.catalog-logo \{/)
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

  it('keeps the artboard 02 phone header: logo, «Categorías» and branch, then the full-width search', () => {
    const base = css.slice(
      css.indexOf('.catalog-header-inner {'),
      css.indexOf('@media (min-width: 721px) {'),
    )
    expect(base).toContain("'logo cats branch'")
    expect(base).toContain("'search search search'")
    // The discreet price list gets its own third row on a phone, only when there is a real choice.
    expect(base).toMatch(/\.catalog-header-inner--lists \{[^}]*'lists lists lists'/)
    expect(base).toMatch(/\.catalog-select-name \{[^}]*text-overflow: ellipsis/)
    expect(base).toMatch(/\.catalog-logo \{[^}]*width: 48px/)
    expect(base).toMatch(/\.catalog-header-controls \{[^}]*grid-area: lists/)
    // From 721px one row: logo, Categorías, search, branch (and lists).
    const desktop = css.slice(css.indexOf('@media (min-width: 721px) {'))
    expect(desktop).toContain("grid-template-areas: 'logo cats search branch'")
    expect(desktop).toContain("grid-template-areas: 'logo cats search branch lists'")
    const tablet = css.slice(css.indexOf('@media (min-width: 601px) {'))
    expect(tablet).toMatch(/\.catalog-header \.catalog-logo \{[^}]*width: 56px/)
  })

  it('pins the listing chrome: 44px targets, chips, pager and the hero bar', () => {
    expect(css).toMatch(/\.catalog-sort select \{[^}]*min-height: 44px/)
    expect(css).toMatch(/\.catalog-pager-button \{[^}]*min-height: 44px/)
    expect(css).toMatch(/\.catalog-menu-item \{[^}]*min-height: 44px/)
    expect(css).toMatch(/\.catalog-chip \{[^}]*border-radius: 999px/)
    expect(css).toMatch(/\.catalog-hero-bar \{[^}]*min-height: 52px/)
    // Phones read «Página X de Y»; desktop numbers the pages.
    const desktop = css.slice(css.indexOf('@media (min-width: 721px) {'))
    expect(desktop).toMatch(/\.catalog-pager-compact \{[^}]*display: none/)
  })

  it('keeps the footer lines close on a phone and spaced on desktop', () => {
    expect(css).toMatch(/\.catalog-footer-inner \{[^}]*gap: 8px 32px/)
    const desktop = css.slice(css.indexOf('@media (min-width: 601px) {'))
    expect(desktop).toMatch(/\.catalog-footer-inner \{[^}]*gap: 28px 32px/)
  })

  it('pins the filters: 40/48px rows with a round mark, the sidebar from 901px and the sheet on a phone', () => {
    const filters = css.slice(css.indexOf('Filters (design/public-catalog-v0'))
    expect(filters).toMatch(/\.catalog-filter-option \{[^}]*min-height: 40px/)
    expect(filters).toMatch(/\.catalog-filter-option-mark \{[^}]*border-radius: 50%/)
    expect(filters).toMatch(
      /\.catalog-filter-sheet-body \.catalog-filter-option \{[^}]*min-height: 48px/,
    )
    expect(filters).toMatch(/\.catalog-recipient \{[^}]*min-height: 44px/)
    // Phone: no sidebar and no classic checkbox styling; the sidebar and the card grid come at 901px.
    expect(filters).toMatch(/\.catalog-filter-sidebar \{[^}]*display: none/)
    const desktop = filters.slice(filters.indexOf('@media (min-width: 901px) {'))
    expect(desktop).toMatch(/\.catalog-split--filters \{[^}]*grid-template-columns: 208px/)
    expect(desktop).toMatch(/\.catalog-filter-sidebar \{[^}]*display: block/)
    expect(desktop).toMatch(/\.catalog-filter-trigger \{[^}]*display: none/)
    expect(desktop).toMatch(/repeat\(4, minmax\(0, 1fr\)\)/)
    expect(filters).not.toMatch(/input\[type=['"]?checkbox/)
  })

  it('keeps the detail eyebrow in sentence case, like every other label', () => {
    const detail = readFileSync('src/features/catalog/styles/catalog-detail.css', 'utf8')
    const eyebrow = detail.slice(detail.indexOf('.catalog-pdp-eyebrow {'))
    expect(eyebrow.slice(0, eyebrow.indexOf('}'))).not.toMatch(/uppercase|letter-spacing/)
  })

  it('gives the branch-without-catalog options their own full-width rows', () => {
    expect(css).toMatch(/\.catalog-branch-pick \{[^}]*width: 100%/)
    expect(css).toMatch(/\.catalog-branch-pick-name \{[^}]*min-width: 0/)
    // The branch block's `.catalog-branch-row` styles its first child 16px wide: never reuse it.
    expect(css).not.toContain('.catalog-branch-row')
  })

  it('pins the card colours to the catalog palette instead of the inherited Nuxt UI variables', () => {
    // The owner saw dark card bodies (white title on near-black) while the media stayed light.
    expect(css).toMatch(/\.catalog-product-card \{[^}]*background: var\(--catalog-surface\)/)
    expect(css).toMatch(/\.catalog-product-card \{[^}]*--ui-bg: var\(--catalog-surface\)/)
    expect(css).toMatch(/\.catalog-product-card \{[^}]*--ui-text-highlighted: var\(--catalog-title\)/)
    expect(css).toMatch(/\.catalog-product-name \{[^}]*color: var\(--catalog-title\)/)
    expect(css).toMatch(/\.catalog-product-price \{[^}]*color: var\(--catalog-title\)/)
    expect(css).toMatch(/\.catalog-product-brand \{[^}]*color: var\(--catalog-muted\)/)
  })

  it('draws the card media edge to edge on a soft stage with the photo contained', () => {
    // A square white frame with padding left landscape photos floating in empty space.
    expect(css).toMatch(/\.catalog-product-media \{[^}]*aspect-ratio: 4 \/ 3/)
    expect(css).toMatch(/\.catalog-product-media \{[^}]*padding: 0;/)
    expect(css).toMatch(/\.catalog-product-media \{[^}]*background: var\(--catalog-page\)/)
    expect(css).toMatch(/\.catalog-product-image \{[^}]*object-fit: contain/)
    // Packshots on white blend into the stage instead of showing a white box.
    expect(css).toMatch(/\.catalog-product-image \{[^}]*mix-blend-mode: multiply/)
  })
})
