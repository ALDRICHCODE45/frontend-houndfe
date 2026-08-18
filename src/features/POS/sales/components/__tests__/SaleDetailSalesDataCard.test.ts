import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleDetail, SaleTimelineEvent } from '../../interfaces/sale.types'

const { getGlobalPriceListsMock } = vi.hoisted(() => ({
  getGlobalPriceListsMock: vi.fn(),
}))

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: {
    getGlobalPriceLists: getGlobalPriceListsMock,
  },
}))

import SaleDetailSalesDataCard from '../SaleDetailSalesDataCard.vue'

const baseSale: SaleDetail = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED',
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: null,
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
  timeline: [] as SaleTimelineEvent[],
  globalPriceListId: null,
}

const globalStubs = {
  UCard: { template: '<div><slot /></div>' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
}

describe('SaleDetailSalesDataCard', () => {
  beforeEach(() => {
    getGlobalPriceListsMock.mockReset()
    getGlobalPriceListsMock.mockResolvedValue([])
  })

  // HST-REQ-002: every reflow card carries the coco-neutral surface.
  it('renders all five reflow cards with HST-REQ-002 coco-neutral classes on the sidebar-data-reflow root', async () => {
    getGlobalPriceListsMock.mockResolvedValue([])

    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: baseSale },
      global: { stubs: globalStubs },
    })
    await nextTick()

    const root = wrapper.get('[data-testid="sidebar-data-reflow"]')
    expect(root.classes()).toEqual(expect.arrayContaining(['bg-coco-neutral-50', 'dark:bg-coco-neutral-950']))

    for (const testid of ['reflow-cajero', 'reflow-vendedor', 'reflow-cliente', 'reflow-price-list', 'reflow-payment-methods']) {
      const card = wrapper.get(`[data-testid="${testid}"]`)
      expect(card.classes()).toEqual(expect.arrayContaining(['bg-coco-neutral-50', 'dark:bg-coco-neutral-950', 'border', 'border-default', 'p-3']))
      expect(card.classes()).not.toContain('bg-white')
      expect(card.classes()).not.toContain('dark:bg-zinc-900')
    }
  })

  // REQ-LAYOUT-006: extracted card owns the price-list fetch — invoked exactly
  // once on mount so the view stops making this network call.
  it('invokes productApi.getGlobalPriceLists() exactly once on mount', async () => {
    getGlobalPriceListsMock.mockResolvedValue([
      { id: 'pl-mayoreo', name: 'Mayoreo', isDefault: false, createdAt: '', updatedAt: '' },
    ])

    mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: { ...baseSale, globalPriceListId: 'pl-mayoreo' } },
      global: { stubs: globalStubs },
    })
    await nextTick()
    await nextTick()

    expect(getGlobalPriceListsMock).toHaveBeenCalledTimes(1)
  })

  // priceListName state matrix — no id, loading, resolved, raw fallback.
  it('renders priceListName as PUBLICO when sale has no globalPriceListId', async () => {
    getGlobalPriceListsMock.mockResolvedValue([])

    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: { ...baseSale, globalPriceListId: null } },
      global: { stubs: globalStubs },
    })
    await nextTick()
    await nextTick()

    expect(wrapper.get('[data-testid="reflow-price-list"]').text()).toContain('PUBLICO')
  })

  it('falls back to raw id when price list cannot be resolved', async () => {
    getGlobalPriceListsMock.mockResolvedValue([
      { id: 'pl-other', name: 'Other', isDefault: false, createdAt: '', updatedAt: '' },
    ])

    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: { ...baseSale, globalPriceListId: 'pl-mayoreo' } },
      global: { stubs: globalStubs },
    })
    await nextTick()
    await nextTick()

    expect(wrapper.get('[data-testid="reflow-price-list"]').text()).toContain('pl-mayoreo')
  })

  it('renders the resolved price-list name on success', async () => {
    getGlobalPriceListsMock.mockResolvedValue([
      { id: 'pl-mayoreo', name: 'Mayoreo', isDefault: false, createdAt: '', updatedAt: '' },
    ])

    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: { ...baseSale, globalPriceListId: 'pl-mayoreo' } },
      global: { stubs: globalStubs },
    })
    await nextTick()
    await nextTick()

    expect(wrapper.get('[data-testid="reflow-price-list"]').text()).toContain('Mayoreo')
  })

  // uniquePaymentMethods: dedupes case-sensitively and uses formatPaymentMethod
  // labels — CASH → "Efectivo", CARD_DEBIT → "Tarjeta de Débito".
  it('renders deduplicated payment methods using localized labels', async () => {
    const saleWithPayments: SaleDetail = {
      ...baseSale,
      payments: [
        { method: 'CASH', amountCents: 5000, tenderedCents: 5000, changeCents: 0, reference: null, paidAt: '2026-05-06T14:43:00.000Z', paymentId: 'p1' },
        { method: 'CASH', amountCents: 6000, tenderedCents: 6000, changeCents: 0, reference: null, paidAt: '2026-05-06T14:44:00.000Z', paymentId: 'p2' },
        { method: 'CARD_DEBIT', amountCents: 30000, tenderedCents: 30000, changeCents: 0, reference: 'T-1', paidAt: '2026-05-06T14:45:00.000Z', paymentId: 'p3' },
      ],
    }

    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: saleWithPayments },
      global: { stubs: globalStubs },
    })
    await nextTick()

    const methods = wrapper.get('[data-testid="reflow-payment-methods"]').text()
    expect(methods).toContain('Efectivo')
    expect(methods).toContain('Tarjeta de Débito')
    // CASH appears twice in input but should be deduplicated — count "Efectivo" occurrences.
    expect((methods.match(/Efectivo/g) ?? []).length).toBe(1)
  })

  // REQ-LAYOUT-006: emit assign-seller upward so the view opens
  // AssignSellerSlideover.
  it('emits assign-seller from the reflow-vendedor card on click, Enter, and Space', async () => {
    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: baseSale },
      global: { stubs: globalStubs },
    })
    await nextTick()

    const card = wrapper.get('[data-testid="reflow-vendedor"]')

    await card.trigger('click')
    expect(wrapper.emitted('assign-seller')).toBeTruthy()
    expect(wrapper.emitted('assign-seller')?.length).toBe(1)

    await card.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('assign-seller')?.length).toBe(2)

    await card.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('assign-seller')?.length).toBe(3)
  })

  // Cajero from baseSale = 'Cajero'; customer falls back to 'Público en General';
  // seller null → 'Sin asignar'.
  it('renders identity fallback text for null seller/customer', async () => {
    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: baseSale },
      global: { stubs: globalStubs },
    })
    await nextTick()

    expect(wrapper.get('[data-testid="reflow-cajero"]').text()).toContain('Cajero')
    expect(wrapper.get('[data-testid="reflow-cliente"]').text()).toContain('Público en General')
    expect(wrapper.get('[data-testid="reflow-vendedor"]').text()).toContain('Sin asignar')
  })
})
