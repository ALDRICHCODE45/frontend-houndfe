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

  it('draw hairline rows on --hf-border with the list hover and tabular figures', () => {
    expect(css).toMatch(/\.products-plain-table :is\(thead, tbody, tr\)\s*\{[^}]*border-color: var\(--hf-border\)/s)
    expect(css).toMatch(/\.products-plain-table tbody tr:hover\s*\{[^}]*var\(--hf-active-soft\)/s)
    expect(css).toMatch(/\.products-plain-table td\s*\{[^}]*font-variant-numeric: tabular-nums/s)
  })

  it.each(tables)('%s opts in and drops the old tinted thead', (name) => {
    const source = readFileSync(`src/features/POS/products/components/${name}.vue`, 'utf8')
    expect(source).toContain("import '../styles/products-plain-table.css'")
    expect(source).toMatch(/<table[^>]*products-plain-table/)
    expect(source).not.toContain('bg-elevated/40')
  })

  // The lots are a list, not a small table of the form: they moved to AppDataTable (premium tables S7).
  it('leaves the lots to AppDataTable', () => {
    const source = readFileSync('src/features/POS/products/components/ProductLotsTable.vue', 'utf8')
    expect(source).toContain('<AppDataTable')
    expect(source).not.toMatch(/<table\b/)
  })
})
