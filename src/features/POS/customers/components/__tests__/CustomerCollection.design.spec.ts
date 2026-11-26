/**
 * «Cobrar todo» S6 design guard: the slideover and its sale list follow the design system —
 * no Tailwind `rounded-xl` / `rounded-2xl` (28px here), the sales render as one `.hf-plain-table`
 * with hairline rows (no card per sale), and the local adapter radii come from the tokens.
 * Source and DOM contracts only; jsdom never proves rendered geometry.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CollectionSaleAllocation } from '../../collection/collection.types'
import CustomerCollectionSaleList from '../CustomerCollectionSaleList.vue'

const dir = 'src/features/POS/customers/components'
const sources = {
  slideover: readFileSync(`${dir}/CustomerCollectionSlideover.vue`, 'utf8'),
  saleList: readFileSync(`${dir}/CustomerCollectionSaleList.vue`, 'utf8'),
}
const css = readFileSync('src/features/POS/customers/styles/customer-collection.css', 'utf8')

function sale(folio: string, overrides: Partial<CollectionSaleAllocation> = {}) {
  return {
    saleId: `id-${folio}`,
    folio,
    confirmedAt: '2026-11-01T10:00:00.000Z',
    dueDate: '2026-11-10T00:00:00.000Z',
    overdue: false,
    appliedCents: 0,
    paidCents: 0,
    debtCents: 10000,
    paymentStatus: 'PENDING',
    ...overrides,
  } as CollectionSaleAllocation
}

describe('«Cobrar todo» design guard (S6)', () => {
  it.each(Object.entries(sources))('%s has no 28px rounded-xl / rounded-2xl classes', (_, src) => {
    expect(src).not.toMatch(/rounded-(?:xl|2xl)\b/)
  })

  it('renders the sales as one plain table at desktop, rows in the table body', () => {
    const wrapper = mount(CustomerCollectionSaleList, {
      props: {
        caption: 'Ventas con deuda',
        sales: [sale('V-1', { overdue: true }), sale('V-2', { dueDate: null, appliedCents: 500 })],
      },
    })
    const table = wrapper.find('table.hf-plain-table')
    expect(table.exists()).toBe(true)
    expect(table.findAll('thead th').map((th) => th.text())).toEqual([
      'Venta',
      'Vence',
      'Debe',
      'Abono',
      'Queda',
    ])
    const rows = table.findAll('tbody tr[data-testid="collection-sale-row"]')
    expect(rows.map((row) => row.attributes('data-folio'))).toEqual(['V-1', 'V-2'])
    expect(rows[0]!.find('.hf-status-badge').text()).toContain('Vencida')
    expect(wrapper.html()).not.toMatch(/rounded-(?:xl|2xl)\b/)
    expect(wrapper.find('li').exists()).toBe(false)
  })

  it('takes radii from the card token in its collection-only adapter', () => {
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).toContain('border-radius: var(--hf-radius-card)')
    expect(declarations).not.toMatch(/border-radius:(?!\s*var\(--hf-radius-(?:card|control)\))/)
    expect(declarations).not.toContain('!important')
    expect(declarations).not.toContain(':root')
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  // Style-cleanup U2 (owner S3 «una sola pieza»): the payment look is the shared `hf-pay-*` sheet.
  it('uses the shared payment sheet and no longer redefines its rules locally', () => {
    expect(sources.slideover).toContain(
      "import '@/core/shared/components/payments/payment-sheet.css'",
    )
    for (const piece of [
      'hf-pay-total',
      'hf-pay-methods',
      'hf-pay-tile',
      'hf-pay-tile-icon',
      'hf-pay-tile-label',
      'hf-pay-tile-count',
      'hf-pay-entry',
      'hf-pay-entry-head',
      'hf-pay-summary',
      'hf-pay-summary-row',
      'hf-pay-panel',
    ]) {
      expect(sources.slideover).toMatch(new RegExp(`class="[^"]*\\b${piece}\\b`))
    }
    const removed = [
      'total',
      'panel',
      'method-tile',
      'method-icon',
      'method-label',
      'method-count',
      'method-subtitle',
      'entry',
      'summary',
    ]
    for (const name of removed) {
      expect(css).not.toContain(`.customer-collection-${name}`)
      expect(sources.slideover).not.toContain(`customer-collection-${name}`)
    }
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toContain('hf-pay-')
    expect(declarations).not.toContain('aria-pressed')
    expect(declarations).not.toMatch(/font-size:\s*2\.25rem/)
  })
})
