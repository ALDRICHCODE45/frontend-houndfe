// SellerReportSalesList.spec.ts — sales history redesign T2 (S3): at phone width the
// confirmed rows become cards (no sideways scroll, 44px targets) that open in place
// into the shared sale detail, with the backend figures verbatim.

import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import SellerReportSalesList from '../SellerReportSalesList.vue'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'

const { getByIdMock } = vi.hoisted(() => ({ getByIdMock: vi.fn() }))
vi.mock('@/features/POS/sales/api/sale.api', () => ({ saleApi: { getById: getByIdMock } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn() }),
}))

type Row = SellerSalesReport['confirmed']['rows'][number]

const ROWS: Row[] = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    folio: 'S-000359',
    confirmedAt: '2026-11-04T22:02:00.000Z',
    totalCents: 298_000,
    paidCents: 150_000,
    debtCents: 148_000,
    paymentStatus: 'PARTIAL',
  },
  {
    id: 'b2222222-2222-4222-8222-222222222222',
    folio: null,
    confirmedAt: '2026-11-03T15:14:00.000Z',
    totalCents: 124_000,
    paidCents: 124_000,
    debtCents: 0,
    paymentStatus: 'PAID',
  },
]

function mountCards() {
  return mount(SellerReportSalesList, {
    props: { sales: ROWS, layout: 'cards', caption: 'Ventas confirmadas' },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ],
    },
  })
}

describe('SellerReportSalesList — phone cards', () => {
  it('renders one card per row with folio, current label, date and the three backend figures', () => {
    const wrapper = mountCards()
    const cards = wrapper.findAll('[data-testid="seller-report-confirmed-card"]')

    expect(wrapper.find('table').exists()).toBe(false)
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('S-000359')
    expect(cards[0]!.text()).toContain('Impaga')
    expect(cards[0]!.text()).toContain('04/11/2026, 16:02')
    expect(cards[0]!.text()).toContain('$2,980.00')
    expect(cards[0]!.text()).toContain('$1,500.00')
    expect(cards[0]!.text()).toContain('$1,480.00')
    expect(cards[1]!.text()).toContain('Sin folio')
    expect(cards[1]!.text()).toContain('Pagada')
  })

  it('opens the detail inside the card with a 44px control and one GET per opened card', async () => {
    getByIdMock.mockResolvedValue({
      id: ROWS[0]!.id,
      status: 'CONFIRMED',
      paidCents: 150_000,
      debtCents: 148_000,
      dueDate: null,
      deliveryStatus: 'DELIVERED',
      customer: null,
      cashier: { id: 'u', name: 'Caja' },
      seller: null,
      items: [],
      payments: [],
    })
    const wrapper = mountCards()
    const toggle = wrapper.findAll('[data-testid="seller-report-confirmed-card"] button')[0]!

    expect(toggle.classes()).toContain('min-h-11')
    expect(toggle.text()).toContain('Ver productos y detalle')
    await toggle.trigger('click')
    await flushPromises()

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.text()).toContain('Ocultar detalle')
    expect(getByIdMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="sale-history-detail"]').text()).toContain('Público general')
  })
})
