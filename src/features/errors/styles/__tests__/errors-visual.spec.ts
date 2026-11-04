// errors-visual.spec.ts — the 403 and 404 pages: one card with the brand mark,
// tokens only, buttons separated by one even gap.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/errors/styles/errors-visual.css', 'utf8')
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start === -1 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('errors stylesheet', () => {
  it('centers one card on the page surface', () => {
    expect(rule('.hf-error-page')).toContain('min-height: 100dvh')
    expect(rule('.hf-error-page')).toContain('background-color: var(--hf-page)')
    expect(rule('.hf-error-card')).toContain('border: 1px solid var(--hf-border)')
    expect(rule('.hf-error-card')).toContain('background-color: var(--hf-surface)')
  })

  it('separates the actions with a single gap and no stray margins', () => {
    const actions = rule('.hf-error-actions')
    expect(actions).toContain('display: flex')
    expect(actions).toMatch(/gap: 12px/)
    expect(css).not.toMatch(/\.hf-error-actions[^{]*\{[^}]*margin/)
  })

  it('uses tokens only', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/text-transform:\s*uppercase/)
  })
})
