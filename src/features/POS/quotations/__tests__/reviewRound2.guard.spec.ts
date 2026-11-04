import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// T4 review round 2: the mobile action bar must not paint on desktop. A scoped
// `display: grid` on the bar overrides Tailwind's `lg:hidden` (same specificity,
// later in the cascade), which showed two solid "Enviar cotización" at 1440.
const view = readFileSync(resolve(__dirname, '../views/QuotationDetailView.vue'), 'utf8')

describe('quotation detail action bar is mobile-only', () => {
  it('declares display only inside a max-width media query', () => {
    const base = view.match(/\.quotation-action-bar\s*\{[^}]*\}/)
    expect(base?.[0]).toBeDefined()
    expect(base![0]).not.toMatch(/display\s*:/)
    expect(view).toMatch(/@media\s*\(max-width:\s*1023px\)\s*\{\s*\.quotation-action-bar\s*\{[^}]*display:\s*grid/)
  })
})
