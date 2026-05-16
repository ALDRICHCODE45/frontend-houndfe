import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailSidebar from '../SaleDetailSidebar.vue'
import type { SaleDetail } from '../../interfaces/sale.types'

const buildSaleDetail = (overrides: Partial<SaleDetail> = {}): SaleDetail => ({
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
  dueDate: null,
  items: [],
  payments: [],
  timeline: [],
  ...overrides,
})

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
          dueDate: null,
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
          dueDate: null,
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
          dueDate: null,
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
          dueDate: null,
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
          dueDate: null,
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

  it('renders Vence row when dueDate exists and paymentStatus is PARTIAL', () => {
    const wrapper = mount(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({
          dueDate: '2026-06-01T10:00:00.000Z',
          paymentStatus: 'PARTIAL',
          debtCents: 37000,
          paidCents: 90000,
        }),
      },
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
        },
      },
    })

    const dueDateRow = wrapper.find('[data-testid="sidebar-due-date"]')
    expect(dueDateRow.exists()).toBe(true)
    expect(dueDateRow.text()).toContain('Vence:')
    expect(dueDateRow.text()).toContain('01/06/2026')
  })

  it('hides Vence row when dueDate is null', () => {
    const wrapper = mount(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({
          dueDate: null,
          paymentStatus: 'CREDIT',
        }),
      },
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.find('[data-testid="sidebar-due-date"]').exists()).toBe(false)
  })

  it('hides Vence row when paymentStatus is PAID even with dueDate', () => {
    const wrapper = mount(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({
          dueDate: '2026-06-01T10:00:00.000Z',
          paymentStatus: 'PAID',
        }),
      },
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.find('[data-testid="sidebar-due-date"]').exists()).toBe(false)
  })
})
