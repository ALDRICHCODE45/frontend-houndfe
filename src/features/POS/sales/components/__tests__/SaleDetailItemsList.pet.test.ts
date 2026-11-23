/** Handoff 27 §6: the sale detail shows «Para: <nombre>» on lines with a pet. */
import { describe, expect, it } from 'vitest'
import SaleDetailItemsList from '../SaleDetailItemsList.vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleDetailItem } from '../../interfaces/sale.types'

const base: SaleDetailItem = {
  productName: 'Croquetas',
  variantName: null,
  imageUrl: null,
  unitPriceCents: 10000,
  quantity: 1,
  discountCents: 0,
  subtotalCents: 10000,
}

describe('SaleDetailItemsList — line pet', () => {
  it('shows «Para: <nombre>» only on the lines with a pet', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          { ...base, pet: { id: 'p1', name: 'Bruno', species: 'DOG', status: 'ACTIVE' } },
          { ...base, productName: 'Collar', pet: null },
        ],
      },
    })

    expect(wrapper.get('[data-testid="item-row-0"]').text()).toContain('Para: Bruno')
    expect(wrapper.get('[data-testid="item-row-1"]').text()).not.toContain('Para:')
  })

  it('keeps the snapshot name of a pet whose customer was deleted', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [{ ...base, pet: { id: null, name: 'Bruno', species: 'DOG', status: null } }],
      },
    })

    expect(wrapper.get('[data-testid="item-row-0"]').text()).toContain('Para: Bruno')
  })
})
