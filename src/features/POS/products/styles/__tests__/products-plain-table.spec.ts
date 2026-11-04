import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The detail's plain <table>s share the AppDataTable header: the same neutral wash
// (houndfe-ui.css `--hf-table-head`) and muted 13px/600 headings. Source contracts.
const css = readFileSync('src/features/POS/products/styles/products-plain-table.css', 'utf8')
const shared = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')

const tables = [
  'ProductVariantsTable',
  'VariantPricingTable',
  'ProductPriceMarginTable',
  'PriceListSection',
  'ProductLotsTable',
]

describe('plain tables in the product detail', () => {
  it('paint the same header wash and muted headings as AppDataTable', () => {
    const wash = shared.match(/--hf-table-head: (color-mix\([^;]+\));/)![1]!
    expect(css).toContain(wash)
    expect(css).toMatch(/\.products-plain-table th\s*\{[^}]*color: var\(--hf-muted\)/s)
    expect(css).toMatch(/\.products-plain-table th\s*\{[^}]*font-size: 0\.8125rem/s)
    expect(css).toMatch(/\.products-plain-table th\s*\{[^}]*font-weight: 600/s)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it.each(tables)('%s opts in and drops the old tinted thead', (name) => {
    const source = readFileSync(`src/features/POS/products/components/${name}.vue`, 'utf8')
    expect(source).toContain("import '../styles/products-plain-table.css'")
    expect(source).toMatch(/<table[^>]*products-plain-table/)
    expect(source).not.toContain('bg-elevated/40')
  })
})
