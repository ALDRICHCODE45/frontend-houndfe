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

  it('pins skeleton cards that respect reduced motion', () => {
    expect(css).toContain('.catalog-skeleton-card')
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*catalog-skeleton/)
  })
})
