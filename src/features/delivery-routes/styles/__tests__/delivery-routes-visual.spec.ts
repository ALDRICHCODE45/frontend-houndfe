import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/delivery-routes/styles/delivery-routes-visual.css', 'utf8')

// Source contracts, not rendered fidelity.
describe('Delivery routes presentation adapter', () => {
  it('maps the dark palette onto the listing and every owned portal', () => {
    for (const marker of [
      'delivery-routes-visual',
      'delivery-routes-list-portal',
      'delivery-routes-form-portal',
    ]) {
      expect(css).toMatch(new RegExp(`(^|,\\s*)\\.dark \\.hf-theme\\.${marker}[,\\s{]`, 'm'))
    }
    expect(css).not.toContain('.dark .dark')
  })

  it('stays scoped: no global root, important overrides or other module markers', () => {
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toContain('promotions-')
  })
})
