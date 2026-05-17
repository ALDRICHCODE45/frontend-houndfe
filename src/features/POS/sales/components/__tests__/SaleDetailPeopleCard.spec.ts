import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailPeopleCard from '../SaleDetailPeopleCard.vue'
import type { SaleDetail } from '../../interfaces/sale.types'

const mockSale: SaleDetail = {
  id: 'sale-1',
  folio: 'A-202605-000001',
  status: 'CONFIRMED',
  channel: 'Punto de Venta',
  register: 'Principal',
  confirmedAt: '2026-05-16T10:00:00Z',
  dueDate: null,
  subtotalCents: 10000,
  discountCents: 0,
  totalCents: 10000,
  paidCents: 10000,
  debtCents: 0,
  changeDueCents: 0,
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  customer: { id: 'customer-1', name: 'Juan Pérez' },
  cashier: { id: 'cashier-1', name: 'María García' },
  seller: { id: 'seller-1', name: 'Carlos López' },
  items: [],
  payments: [],
  timeline: [],
}

describe('SaleDetailPeopleCard', () => {
  it('displays customer information', () => {
    const wrapper = mountWithUApp(SaleDetailPeopleCard, {
      props: { sale: mockSale }
    })
    
    expect(wrapper.text()).toContain('Juan Pérez')
  })

  it('shows "Público en General" when no customer', () => {
    const saleWithoutCustomer: SaleDetail = {
      ...mockSale,
      customer: null,
    }
    
    const wrapper = mountWithUApp(SaleDetailPeopleCard, {
      props: { sale: saleWithoutCustomer }
    })
    
    expect(wrapper.text()).toContain('Público en General')
  })

  it('displays seller information when assigned', () => {
    const wrapper = mountWithUApp(SaleDetailPeopleCard, {
      props: { sale: mockSale, canUpdateSale: true }
    })
    
    expect(wrapper.text()).toContain('Carlos López')
    expect(wrapper.text()).toContain('Cambiar')
    expect(wrapper.text()).toContain('Quitar')
  })

  it('shows "Sin asignar" when no seller', () => {
    const saleWithoutSeller: SaleDetail = {
      ...mockSale,
      seller: null,
    }
    
    const wrapper = mountWithUApp(SaleDetailPeopleCard, {
      props: { sale: saleWithoutSeller, canUpdateSale: true }
    })
    
    expect(wrapper.text()).toContain('Sin asignar')
    expect(wrapper.text()).toContain('Asignar')
  })

  it('hides seller actions when cannot update sale', () => {
    const wrapper = mountWithUApp(SaleDetailPeopleCard, {
      props: { sale: mockSale, canUpdateSale: false }
    })
    
    expect(wrapper.text()).not.toContain('Cambiar')
    expect(wrapper.text()).not.toContain('Quitar')
    expect(wrapper.text()).not.toContain('Asignar')
  })

  it('emits assign-seller when assign button clicked', async () => {
    const saleWithoutSeller: SaleDetail = {
      ...mockSale,
      seller: null,
    }
    
    const wrapper = mountWithUApp(SaleDetailPeopleCard, {
      props: { sale: saleWithoutSeller, canUpdateSale: true }
    })
    
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('assign-seller')).toBeTruthy()
  })
})