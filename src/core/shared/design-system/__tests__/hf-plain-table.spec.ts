import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Premium tables S7: the small tables inside forms and details stay plain <table>s with the
// AppDataTable look, from one shared class instead of a copy per feature. Hover is opt-in: only a
// table whose rows do something gets it.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}
const read = (path: string) => readFileSync(path, 'utf8')

const tables = {
  ProductVariantsTable: 'src/features/POS/products/components/ProductVariantsTable.vue',
  VariantPricingTable: 'src/features/POS/products/components/VariantPricingTable.vue',
  ProductPriceMarginTable: 'src/features/POS/products/components/ProductPriceMarginTable.vue',
  PriceListSection: 'src/features/POS/products/components/PriceListSection.vue',
  SaleDetailItemsList: 'src/features/POS/sales/components/SaleDetailItemsList.vue',
  BranchSalesTrendChart: 'src/features/analytics/components/BranchSalesTrendChart.vue',
}
// Each feature stylesheet and the class its table rules hang on.
const featureStyles: Array<[string, string]> = [
  ['src/features/POS/products/styles/products-plain-table.css', '.products-plain-table'],
  ['src/features/POS/sales/styles/sales-detail-visual.css', '.sale-detail-items-table'],
  ['src/features/analytics/styles/dashboard-trend.css', '.dashboard-trend-data'],
]
const rulesOf = (source: string, hook: string) =>
  [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector!.includes(hook))
    .map(([, selector, body]) => `${selector!.trim()} {${body}}`)

describe('.hf-plain-table', () => {
  it('uses the header wash of AppDataTable', () => {
    const wash = block('.hf-ui .hf-data-table').match(/--hf-table-head:\s*([^;]+);/)![1]
    expect(block('.hf-ui .hf-plain-table')).toContain(`--hf-table-head: ${wash};`)
    expect(block('.hf-ui .hf-plain-table thead')).toMatch(/background-color: var\(--hf-table-head\);/)
  })

  it('heads its columns in muted 13px/600', () => {
    const th = block('.hf-ui .hf-plain-table thead th')
    expect(th).toMatch(/color: var\(--hf-muted\);/)
    expect(th).toMatch(/font-size: 0\.8125rem;/)
    expect(th).toMatch(/font-weight: 600;/)
  })

  it('draws hairline rows on --hf-border and no line under the last row', () => {
    expect(block('.hf-ui .hf-plain-table :is(th, td)')).toMatch(/border-bottom: 1px solid var\(--hf-border\);/)
    expect(block('.hf-ui .hf-plain-table :is(thead, tbody, tr)')).toMatch(/border-color: var\(--hf-border\);/)
    expect(block('.hf-ui .hf-plain-table tbody tr:last-child > :is(th, td)')).toMatch(/border-bottom: 0;/)
  })

  it('sets figures in tabular numerals', () => {
    expect(block('.hf-ui .hf-plain-table :is(td, .hf-figure)')).toMatch(/font-variant-numeric: tabular-nums;/)
  })

  it('hovers rows only with the --hover modifier', () => {
    expect(block('.hf-ui .hf-plain-table--hover tbody tr:hover')).toMatch(/var\(--hf-active-soft\)/)
    expect(css).not.toMatch(/\.hf-plain-table tbody tr:hover/)
  })

  it.each(Object.entries(tables))('%s wears it', (_name, path) => {
    expect(read(path)).toMatch(/<table[^>]*class="[^"]*\bhf-plain-table\b/)
  })

  it('keeps hover on the editable product tables and none on the sale items', () => {
    for (const name of ['ProductVariantsTable', 'VariantPricingTable', 'ProductPriceMarginTable', 'PriceListSection'] as const) {
      expect(read(tables[name])).toMatch(/<table[^>]*hf-plain-table--hover/)
    }
    expect(read(tables.SaleDetailItemsList)).not.toContain('hf-plain-table--hover')
  })

  it.each(featureStyles)('%s no longer repaints the shared look', (path, hook) => {
    const rules = rulesOf(read(path), hook).join('\n')
    expect(rules).not.toMatch(/background-color: color-mix\(in srgb, var\(--hf-ink\) 4%/)
    expect(rules).not.toMatch(/tr:hover/)
    expect(rules).not.toMatch(/tabular-nums/)
  })
})
