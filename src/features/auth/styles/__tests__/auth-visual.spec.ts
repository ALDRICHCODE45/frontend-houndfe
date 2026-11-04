// auth-visual.spec.ts — source contract for the sign-in and branch-selection card:
// stable card height, centered brand, tokens only, a readable busy primary.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/auth/styles/auth-visual.css', 'utf8')
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start === -1 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('auth stylesheet', () => {
  it('spaces the form with a flex gap so the title never touches the first label', () => {
    expect(rule('.hf-auth-form')).toContain('display: flex')
    expect(rule('.hf-auth-form')).toMatch(/gap: 2[0-9]px/)
  })

  it('centers the brand and the card titles', () => {
    expect(rule('.hf-auth-logo')).toContain('margin-inline: auto')
    expect(rule('.hf-auth-head')).toContain('text-align: center')
  })

  it('holds the card height: the failure notice and Cancelar are out of the flow', () => {
    expect(rule('.hf-auth-card')).toContain('position: relative')
    expect(rule('.hf-auth-feedback')).toContain('position: absolute')
    expect(rule('.hf-auth-cancel')).toContain('position: absolute')
  })

  it('keeps the busy primary on the action pairing at full strength, light and dark', () => {
    const busy = rule(".hf-auth-card .hf-primary-control[aria-busy='true']")
    expect(busy).toContain('var(--hf-action)')
    expect(busy).toContain('var(--hf-on-action)')
    expect(busy).toContain('opacity: 1')
  })

  it('has no hex literals and no uppercase or tracked labels', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/text-transform:\s*uppercase/)
  })
})
