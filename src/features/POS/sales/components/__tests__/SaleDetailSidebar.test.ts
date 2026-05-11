import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailSidebar from '../SaleDetailSidebar.vue'

describe('SaleDetailSidebar', () => {
  it('shows customer name when customer is present', () => {
    const wrapper = mount(SaleDetailSidebar, {
      props: {
        sale: {
          id: 'sale-1',
          folio: 'A-202605-000012',
          status: 'CONFIRMED',
          channel: 'POS',
          register: 'Principal',
          confirmedAt: '2026-05-06T14:43:00.000Z',
          subtotalCents: 127000,
          discountCents: 0,
          totalCents: 127000,
          paidCents: 127000,
          debtCents: 0,
          changeDueCents: 0,
          paymentStatus: 'PAID',
          deliveryStatus: 'DELIVERED',
          customer: { id: 'c1', name: 'Juan Pérez' },
          cashier: { id: 'u1', name: 'Cajero' },
          seller: { id: 'u2', name: 'Vendedor' },
          items: [],
          payments: [],
          timeline: [],
        },
      },
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Cliente')
    expect(wrapper.text()).toContain('Juan Pérez')
  })

  it('shows fallback seller label when seller is null', () => {
    const wrapper = mount(SaleDetailSidebar, {
      props: {
        sale: {
          id: 'sale-1',
          folio: 'A-202605-000012',
          status: 'CONFIRMED',
          channel: 'POS',
          register: 'Principal',
          confirmedAt: '2026-05-06T14:43:00.000Z',
          subtotalCents: 127000,
          discountCents: 0,
          totalCents: 127000,
          paidCents: 127000,
          debtCents: 0,
          changeDueCents: 0,
          paymentStatus: 'PAID',
          deliveryStatus: 'DELIVERED',
          customer: null,
          cashier: { id: 'u1', name: 'Cajero' },
          seller: null,
          items: [],
          payments: [],
          timeline: [],
        },
      },
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Asignar Vendedor')
    expect(wrapper.text()).toContain('Punto de Venta')
  })

  it('shows Público en General when customer is null', () => {
    const wrapper = mount(SaleDetailSidebar, {
      props: {
        sale: {
          id: 'sale-1',
          folio: 'A-202605-000012',
          status: 'CONFIRMED',
          channel: 'POS',
          register: 'Principal',
          confirmedAt: '2026-05-06T14:43:00.000Z',
          subtotalCents: 127000,
          discountCents: 0,
          totalCents: 127000,
          paidCents: 127000,
          debtCents: 0,
          changeDueCents: 0,
          paymentStatus: 'PAID',
          deliveryStatus: 'DELIVERED',
          customer: null,
          cashier: { id: 'u1', name: 'Cajero' },
          seller: { id: 'u2', name: 'Vendedor' },
          items: [],
          payments: [],
          timeline: [],
        },
      },
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Cliente')
    expect(wrapper.text()).toContain('Público en General')
  })
})
