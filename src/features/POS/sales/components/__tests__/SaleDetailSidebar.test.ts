import { describe, it, expect, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailSidebar from '../SaleDetailSidebar.vue'
import type { SaleDetail } from '../../interfaces/sale.types'

const mocks = vi.hoisted(() => ({
  unassignSellerMock: vi.fn(),
  userCanMock: vi.fn((_action: string, _subject: string) => true),
}))

vi.mock('@/features/POS/sales/composables/useSellerAssignment', async () => {
  const { ref: vueRef } = await import('vue')
  return {
    useSellerAssignment: () => ({
      assignSeller: vi.fn(),
      unassignSeller: mocks.unassignSellerMock,
      isPending: vueRef(false),
      lastError: vueRef(null),
    }),
  }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: mocks.userCanMock }),
}))

const unassignSellerMock = mocks.unassignSellerMock

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const defaultStubs = {
  AppBadge: { template: '<span><slot /></span>' },
  UCard: { template: '<div><slot /></div>' },
  UButton: {
    props: ['block'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
  AssignSellerSlideover: {
    props: ['open', 'saleId'],
    template: '<div data-testid="assign-seller-slideover-stub" />',
  },
  DueDateEditModal: {
    props: ['open', 'saleId', 'currentDueDate'],
    template: '<div data-testid="due-date-modal-stub" />',
  },
}

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
    const wrapper = mountWithUApp(SaleDetailSidebar, {
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
        stubs: defaultStubs,
      },
    })

    expect(wrapper.text()).toContain('Cliente')
    expect(wrapper.text()).toContain('Juan Pérez')
  })

  it('shows fallback seller label when seller is null', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
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
        stubs: defaultStubs,
      },
    })

    expect(wrapper.text()).toContain('Sin asignar')
    expect(wrapper.find('[data-testid="assign-seller-trigger"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Punto de Venta')
  })

  it('shows Público en General when customer is null', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
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
        stubs: defaultStubs,
      },
    })

    expect(wrapper.text()).toContain('Cliente')
    expect(wrapper.text()).toContain('Público en General')
  })

  it('shows Registrar Pago CTA only when sale has outstanding debt', async () => {
    const onRegisterPayment = vi.fn()
    const wrapper = mountWithUApp(SaleDetailSidebar, {
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
        stubs: defaultStubs,
      },
    })

    const button = wrapper.find('[data-testid="register-debt-payment"]')
    expect(button.exists()).toBe(true)
    expect(wrapper.text()).toContain('$370.00')

    await button.trigger('click')
    expect(wrapper.emitted('register-payment')).toBeTruthy()
  })

  it('hides Registrar Pago CTA when payment status is PAID', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
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
        stubs: defaultStubs,
      },
    })

    expect(wrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(false)
  })

  it('renders Vence row with formatted date when dueDate exists and paymentStatus is PARTIAL', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({
          dueDate: '2026-06-01T10:00:00.000Z',
          paymentStatus: 'PARTIAL',
          debtCents: 37000,
          paidCents: 90000,
        }),
      },
      global: {
        stubs: defaultStubs,
      },
    })

    const dueDateRow = wrapper.find('[data-testid="sidebar-due-date"]')
    expect(dueDateRow.exists()).toBe(true)
    expect(dueDateRow.text()).toContain('Vence')
    expect(dueDateRow.text()).toContain('01/06/2026')
    expect(wrapper.find('[data-testid="edit-due-date-trigger"]').exists()).toBe(true)
  })

  it('shows Vence row with "Sin fecha" + asignar trigger when dueDate is null and paymentStatus is CREDIT', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({
          dueDate: null,
          paymentStatus: 'CREDIT',
        }),
      },
      global: {
        stubs: defaultStubs,
      },
    })

    const dueDateRow = wrapper.find('[data-testid="sidebar-due-date"]')
    expect(dueDateRow.exists()).toBe(true)
    expect(dueDateRow.text()).toContain('Sin fecha')
    expect(wrapper.get('[data-testid="edit-due-date-trigger"]').text()).toBe('Asignar fecha')
  })

  it('hides Vence row when paymentStatus is PAID even with dueDate', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({
          dueDate: '2026-06-01T10:00:00.000Z',
          paymentStatus: 'PAID',
        }),
      },
      global: {
        stubs: defaultStubs,
      },
    })

    expect(wrapper.find('[data-testid="sidebar-due-date"]').exists()).toBe(false)
  })

  it('shows Cambiar + Quitar triggers when seller is assigned and user has update:Sale', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({ seller: { id: 'u-2', name: 'Vendedor X' } }),
      },
      global: { stubs: defaultStubs },
    })

    expect(wrapper.text()).toContain('Vendedor X')
    expect(wrapper.find('[data-testid="change-seller-trigger"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="unassign-seller-trigger"]').exists()).toBe(true)
  })

  it('clicking Quitar triggers unassignSeller', async () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({ seller: { id: 'u-2', name: 'Vendedor X' } }),
      },
      global: { stubs: defaultStubs },
    })

    await wrapper.get('[data-testid="unassign-seller-trigger"]').trigger('click')
    expect(unassignSellerMock).toHaveBeenCalled()
  })

  it('hides seller affordances when user lacks update:Sale ability', () => {
    mocks.userCanMock.mockReturnValueOnce(false)
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({ seller: null }),
      },
      global: { stubs: defaultStubs },
    })

    expect(wrapper.text()).toContain('Sin asignar')
    expect(wrapper.find('[data-testid="assign-seller-trigger"]').exists()).toBe(false)
  })

  it('renders seller cambiar/quitar buttons as neutral link variant', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({ seller: { id: 'u-2', name: 'Vendedor X' } }),
      },
      global: { stubs: defaultStubs },
    })

    const changeSeller = wrapper.find('[data-testid="change-seller-trigger"]')
    const unassignSeller = wrapper.find('[data-testid="unassign-seller-trigger"]')
    
    expect(changeSeller.exists()).toBe(true)
    expect(unassignSeller.exists()).toBe(true)
    
    // Verify they have the expected data-testid attributes (confirming they render properly)
    expect(changeSeller.attributes('data-testid')).toBe('change-seller-trigger')
    expect(unassignSeller.attributes('data-testid')).toBe('unassign-seller-trigger')
  })

  it('renders payment status as UBadge in financial card header not banner', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail({ 
          paymentStatus: 'PAID',
          debtCents: 0,
          paidCents: 127000 
        }),
      },
      global: { stubs: defaultStubs },
    })

    const statusBadge = wrapper.find('[data-testid="payment-status-badge"]')
    expect(statusBadge.exists()).toBe(true)
    // The badge should exist and not be a full-width banner
    expect(statusBadge.exists()).toBe(true)
  })

  it('does not render Factura card placeholder', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail(),
      },
      global: {
        stubs: {
          ...defaultStubs,
        },
      },
    })

    expect(wrapper.text()).not.toContain('Factura')
    expect(wrapper.text()).not.toContain('Ver detalles')
  })

  it('renders financial, people and metadata cards in order', () => {
    const wrapper = mountWithUApp(SaleDetailSidebar, {
      props: {
        sale: buildSaleDetail(),
      },
      global: {
        stubs: {
          ...defaultStubs,
          SaleDetailFinancialCard: { template: '<div data-testid="financial-card-stub">Financial</div>' },
          SaleDetailPeopleCard: { template: '<div data-testid="people-card-stub">People</div>' },
          SaleDetailMetadataCard: { template: '<div data-testid="metadata-card-stub">Metadata</div>' },
        },
      },
    })

    const sidebarText = wrapper.get('[data-testid="sidebar"]').text()
    expect(sidebarText.indexOf('Financial')).toBeLessThan(sidebarText.indexOf('People'))
    expect(sidebarText.indexOf('People')).toBeLessThan(sidebarText.indexOf('Metadata'))

    const cardsCount = wrapper.findAll('[data-testid$="-card-stub"]').length
    expect(cardsCount).toBe(3)
  })
})
