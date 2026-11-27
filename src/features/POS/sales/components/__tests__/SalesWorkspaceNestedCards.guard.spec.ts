/**
 * style-cleanup U4 (owner S1/S4, design/system.md «No nested decorative cards») guard: the Venta
 * workspace keeps a single surface per region. The success folio, the empty-cart icon, the cart
 * rows and the catalog/cart pane wrappers paint no bordered, rounded box of their own.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleItemRow from '../SaleItemRow.vue'
import type { SaleItem } from '../../interfaces/sale.types'

const read = (path: string) => readFileSync(path, 'utf8')
const template = (path: string) =>
  read(path)
    .split('<template>')
    .slice(1)
    .join('<template>')
    .replace(/<!--[\s\S]*?-->/g, '')

const COMPONENTS = 'src/features/POS/sales/components'

describe('U4 guard — no nested decorative cards in the Venta workspace', () => {
  it('PaymentSuccessModal shows the folio as a plain row, not a tinted bordered panel', () => {
    const source = template(`${COMPONENTS}/PaymentSuccessModal.vue`)
    const body = source.slice(source.indexOf('<template #body>'), source.indexOf('<template #footer>'))
    expect(body).not.toMatch(/rounded-(?:lg|xl|2xl)|\bborder\b/)
    expect(source).not.toMatch(/border-success|bg-success\/10/)
    expect(source).toContain('Folio')
  })

  it('ActiveSalePanel empty state shows the icon without a boxed tile', () => {
    const source = template(`${COMPONENTS}/ActiveSalePanel.vue`)
    expect(source).not.toMatch(/rounded-2xl/)
    expect(source).not.toMatch(/bg-primary\/8 border border-primary\/15/)
    expect(source).toContain('Tu venta está vacía')
  })

  it('SalesView pane wrappers carry no card paint (the workspace owns the only surfaces)', () => {
    const source = template('src/features/POS/sales/views/SalesView.vue')
    const shells = source.match(/class="[^"]*sales-entry-panel[^"]*"/g) ?? []
    expect(shells).toHaveLength(4)
    for (const shell of shells) {
      expect(shell).not.toMatch(/rounded-|\bborder\b|border-default/)
    }
  })

  it.each([
    ['desktop', {}],
    ['mobile sheet', { mobileSheet: true }],
  ])('SaleItemRow (%s) is a divider row, not a bordered rounded card', (_, extra) => {
    const item: SaleItem = {
      id: 'item-1',
      productId: 'prod-1',
      variantId: null,
      productName: 'Aspirina 100mg',
      variantName: null,
      quantity: 1,
      unitPriceCents: 5000,
      unitPriceCurrency: 'MXN',
    }
    const wrapper = mount(SaleItemRow, {
      props: {
        item,
        saleId: 'sale-1',
        isDraft: true,
        onSubmitPriceOverride: async () => undefined,
        onApplyDiscount: async () => undefined,
        onRemoveDiscount: async () => undefined,
        onRemoveItem: async () => undefined,
        ...extra,
      },
      global: {
        stubs: {
          UInputNumber: true,
          UIcon: true,
          UButton: true,
          UBadge: true,
          UDropdownMenu: true,
          UTooltip: true,
          Tooltip: true,
          PriceOverrideModal: true,
          ItemDiscountModal: true,
          StatusBadge: true,
          USeparator: true,
        },
      },
    })
    const classes = wrapper.get('[data-testid="sale-item-card"]').classes()
    expect(classes.some((name) => name.startsWith('rounded'))).toBe(false)
    expect(classes).not.toContain('border')
    expect(classes).not.toContain('mx-3')
    // The divider itself comes from sales-pos-cart.css (`.sales-pos-cart-composition .sales-pos-cart-row`).
    expect(classes).toEqual(expect.arrayContaining(['sales-pos-cart-row', 'sales-pos-cart-row-composition']))
  })
})
