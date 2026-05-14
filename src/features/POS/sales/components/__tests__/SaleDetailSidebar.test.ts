import { describe, it, expect, vi } from 'vitest'
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

  it('shows Registrar Pago CTA only when sale has outstanding debt', async () => {
    const onRegisterPayment = vi.fn()
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
          paidCents: 90000,
          debtCents: 37000,
          changeDueCents: 0,
          paymentStatus: 'PARTIAL',
          deliveryStatus: 'DELIVERED',
          customer: null,
          cashier: { id: 'u1', name: 'Cajero' },
          seller: { id: 'u2', name: 'Vendedor' },
          items: [],
          payments: [],
          timeline: [],
        },
        onRegisterPayment,
      },
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    const button = wrapper.find('[data-testid="register-debt-payment"]')
    expect(button.exists()).toBe(true)
    expect(wrapper.text()).toContain('$370.00')

    await button.trigger('click')
    expect(wrapper.emitted('register-payment')).toBeTruthy()
  })

  it('hides Registrar Pago CTA when payment status is PAID', () => {
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
          UButton: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(false)
  })
})
