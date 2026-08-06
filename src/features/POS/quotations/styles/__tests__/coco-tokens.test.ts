import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * REQ-UI-001 — Coco scoped design tokens.
 *
 * The token stylesheet MUST live in a dedicated `@layer coco-quotations`
 * block and MUST NOT mutate `:root` or any other global selector. Tokens
 * are scoped to `.quotation-detail-view` and `.quotations-list-view` so
 * non-quotations screens are unaffected.
 *
 * Strategy: assert the file source directly. jsdom does not fully support
 * CSS layer cascade, so a file-level test is the most reliable way to pin
 * the contract. The same pattern is used by DashboardLayout's Coco shell
 * binding tests.
 */

const STYLES_PATH = join(__dirname, '..', 'coco-tokens.css')

function readTokens(): string {
  return readFileSync(STYLES_PATH, 'utf-8')
}

describe('Coco tokens (REQ-UI-001)', () => {
  it('exists at the feature-scoped path', () => {
    expect(existsSync(STYLES_PATH)).toBe(true)
  })

  it('defines the coco-quotations CSS layer', () => {
    const css = readTokens()
    expect(css).toMatch(/@layer\s+coco-quotations\s*\{/)
  })

  it('does NOT mutate :root or any other global selector', () => {
    const css = readTokens()
    // No top-level :root selector allowed — tokens MUST be scoped to the
    // quotation screens only.
    expect(css).not.toMatch(/^\s*:root\s*\{/m)
    // No naked html / body / * selectors at the top level either.
    expect(css).not.toMatch(/^\s*html\s*\{/m)
    expect(css).not.toMatch(/^\s*body\s*\{/m)
    expect(css).not.toMatch(/^\s*\*\s*\{/m)
  })

  it('defines every required Coco token (REQ-UI-001)', () => {
    const css = readTokens()
    const required = [
      '--coco-primary',
      '--coco-primary-50',
      '--coco-accent',
      '--coco-accent-50',
      '--coco-bg',
      '--coco-card',
      '--coco-border',
      '--coco-text',
      '--coco-text-secondary',
      '--coco-text-tertiary',
      '--coco-success',
      '--coco-warning',
      '--coco-danger',
      '--coco-info',
    ]
    for (const token of required) {
      expect(css, `missing ${token}`).toContain(`${token}:`)
    }
  })

  it('scopes tokens to the quotation screens only', () => {
    const css = readTokens()
    // The layer block must scope to the view classes — not bleed into the
    // global cascade.
    expect(css).toMatch(/\.quotation-detail-view/)
    expect(css).toMatch(/\.quotations-list-view/)
  })

  it('matches the Coco reference hex values from the design spec', () => {
    const css = readTokens()
    expect(css).toContain('#2557D6') // --coco-primary
    expect(css).toContain('#EFF4FF') // --coco-primary-50
    expect(css).toContain('#E0A800') // --coco-accent
    expect(css).toContain('#FEF8E7') // --coco-accent-50
  })
})
