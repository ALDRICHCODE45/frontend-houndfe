import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The detail's plain <table>s wear the shared `.hf-plain-table` look (houndfe-ui.css, guarded by
// hf-plain-table.spec.ts) with row hover, as they did before. This file keeps only their phone stack.
const css = readFileSync('src/features/POS/products/styles/products-plain-table.css', 'utf8')

const tables = [
  'ProductVariantsTable',
  'VariantPricingTable',
  'ProductPriceMarginTable',
  'PriceListSection',
]

describe('plain tables in the product detail', () => {
  it('leave the shared look to .hf-plain-table and keep only the stacked phone layout', () => {
    expect(css).not.toMatch(/--hf-ink\) 4%/)
    expect(css).not.toMatch(/tr:hover/)
    expect(css).toMatch(/@media \(max-width: 639px\)/)
    expect(css).toMatch(/\.products-plain-table\[data-stack\] tbody td\s*\{[^}]*border-bottom: 0/s)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it.each(tables)('%s opts in and drops the old tinted thead', (name) => {
    const source = readFileSync(`src/features/POS/products/components/${name}.vue`, 'utf8')
    expect(source).toContain("import '../styles/products-plain-table.css'")
    expect(source).toMatch(/<table[^>]*hf-plain-table hf-plain-table--hover products-plain-table/)
    expect(source).not.toContain('bg-elevated/40')
  })

  // The lots are a list, not a small table of the form: they moved to AppDataTable (premium tables S7).
  it('leaves the lots to AppDataTable', () => {
    const source = readFileSync('src/features/POS/products/components/ProductLotsTable.vue', 'utf8')
    expect(source).toContain('<AppDataTable')
    expect(source).not.toMatch(/<table\b/)
  })
})
