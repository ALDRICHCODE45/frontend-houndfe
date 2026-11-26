/**
 * Style-cleanup U2: the customer history drawer keeps its redesign structure (one surface,
 * hairline metrics, a table) and draws no card per row (design/system.md:130 «No nested
 * decorative cards»; docs/design-system.md:650 rows separated by dividers). Source contract only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const drawer = readFileSync('src/features/POS/customers/components/CustomerSalesHistorySlideover.vue', 'utf8')

function openingTag(src: string, marker: string): string {
  const at = src.indexOf(marker)
  expect(at).toBeGreaterThan(-1)
  return src.slice(src.lastIndexOf('<', at), src.indexOf('>', at) + 1)
}

describe('Customer history drawer — no card per row (U2)', () => {
  it('the loading rows are hairline rows inside one list surface', () => {
    const row = openingTag(drawer, 'data-testid="row-skeleton"')
    expect(row).not.toMatch(/\brounded-|\bborder\b/)

    const rowsStart = drawer.indexOf('data-testid="row-skeleton"')
    const surface = drawer.slice(drawer.lastIndexOf('<div class="', drawer.lastIndexOf('v-for="index in 5"', rowsStart)), rowsStart)
    expect(surface).toMatch(/divide-y/)
    expect(surface).toMatch(/\bborder\b/)
  })
})
