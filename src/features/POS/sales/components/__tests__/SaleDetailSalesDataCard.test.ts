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
  UCard: { template: '<div v-bind="$attrs"><slot /></div>' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
}

describe('SaleDetailSalesDataCard', () => {
  beforeEach(() => {
    getGlobalPriceListsMock.mockReset()
    getGlobalPriceListsMock.mockResolvedValue([])
  })

  // HST-REQ-002: every reflow card carries the coco-neutral surface.
  // WU-E: the root testid lives on the UCard wrapper (not on a custom
  // <section>). The UCard's own surface provides the coco-neutral
  // background — the 5 reflow cards keep their byte-identical HST-REQ-002
  // classes per the spec.
  it('renders all five facts as a read-only definition list; sidebar-data-reflow testid is on the UCard wrapper', async () => {
    getGlobalPriceListsMock.mockResolvedValue([])

    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: baseSale },
      global: { stubs: globalStubs },
    })
    await nextTick()

    // Root testid is preserved and lives on the UCard wrapper now.
    // wrapper.get() throws if the selector is missing, so the element
    // exists by construction — we just bind it to satisfy the type checker.
    const _root = wrapper.get('[data-testid="sidebar-data-reflow"]')
    void _root

    for (const testid of ['reflow-cajero', 'reflow-vendedor', 'reflow-cliente', 'reflow-price-list', 'reflow-payment-methods']) {
      const card = wrapper.get(`[data-testid="${testid}"]`)
      expect(card.find('dt').exists()).toBe(true)
      expect(card.find('dd').exists()).toBe(true)
      expect(card.classes().join(' ')).not.toMatch(/coco-|bg-white|border|rounded|p-3/)
    }
  })

  // WU-E: the data card wraps the reflow grid in a UCard with a header
  // titled "Datos de la venta".
  it('wraps the reflow grid in a UCard with "Datos de la venta" header', async () => {
    getGlobalPriceListsMock.mockResolvedValue([])

    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: baseSale },
      global: { stubs: globalStubs },
    })
    await nextTick()

    expect(wrapper.text()).toContain('Datos de la venta')
    // Header is rendered via #header slot (real UCard exposes data-slot="header")
    const headers = wrapper.findAll('[data-slot="header"]')
    const dataHeader = headers.find((h) => h.text().includes('Datos de la venta'))
    expect(dataHeader).toBeDefined()
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
  // labels — CASH → "Efectivo", CARD_DEBIT → "Tarjeta de débito".
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
    expect(methods).toContain('Tarjeta de débito')
    // CASH appears twice in input but should be deduplicated — count "Efectivo" occurrences.
    expect((methods.match(/Efectivo/g) ?? []).length).toBe(1)
  })

  // REQ-LAYOUT-006: emit assign-seller upward so the view opens
  // AssignSellerSlideover.
  it('emits assign-seller from the "Asignar vendedor" button', async () => {
    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: baseSale },
      global: { stubs: globalStubs },
    })
    await nextTick()

    const button = wrapper.get('[data-testid="assign-seller"]')
    expect(button.text()).toBe('Asignar vendedor')
    await button.trigger('click')
    expect(wrapper.emitted('assign-seller')?.length).toBe(1)
  })

  it('offers "Cambiar" when a seller is already assigned', async () => {
    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: { ...baseSale, seller: { id: 's1', name: 'Ana' } } },
      global: { stubs: globalStubs },
    })
    await nextTick()

    expect(wrapper.get('[data-testid="reflow-vendedor"]').text()).toContain('Ana')
    expect(wrapper.get('[data-testid="assign-seller"]').text()).toBe('Cambiar')
  })

  // Cajero from baseSale = 'Cajero'; customer falls back to 'Público en general';
  // seller null → 'Sin asignar'.
  it('renders identity fallback text for null seller/customer', async () => {
    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: baseSale },
      global: { stubs: globalStubs },
    })
    await nextTick()

    expect(wrapper.get('[data-testid="reflow-cajero"]').text()).toContain('Cajero')
    expect(wrapper.get('[data-testid="reflow-cliente"]').text()).toContain('Público en general')
    expect(wrapper.get('[data-testid="reflow-vendedor"]').text()).toContain('Sin asignar')
  })
})

describe('SaleDetailSalesDataCard — shipping address (odd sale-address-change-notice S1-S3)', () => {
  const snapshot = {
    id: null,
    street: 'Calle Prueba 1',
    exteriorNumber: '1',
    interiorNumber: null,
    zipCode: '06000',
    neighborhood: 'Centro',
    municipality: null,
    city: 'CDMX',
    state: null,
    visualReferences: null,
    carrierPhone: null,
    label: null,
    latitude: null,
    longitude: null,
  }

  async function mountCard(shippingAddress: SaleDetail['shippingAddress'] | undefined) {
    const wrapper = mountWithUApp(SaleDetailSalesDataCard, {
      props: { sale: { ...baseSale, ...(shippingAddress !== undefined ? { shippingAddress } : {}) } },
      global: { stubs: globalStubs },
    })
    await nextTick()
    return wrapper
  }

  it.each([
    ['CHANGED', ['street'], 'El cliente cambió esta dirección después de la venta.'],
    ['DELETED', [], 'El cliente eliminó esta dirección después de la venta.'],
  ] as const)('%s: shows the sale snapshot under «Dirección de envío» with the notice', async (sourceStatus, changedFields, message) => {
    const wrapper = await mountCard({ ...snapshot, sourceStatus, changedFields: [...changedFields] })
    const block = wrapper.get('[data-testid="reflow-shipping-address"]')
    expect(block.get('dt').text()).toBe('Dirección de envío')
    expect(block.get('[data-testid="sale-shipping-address"]').text()).toBe('Calle Prueba 1 #1, Centro, CDMX, CP 06000')
    expect(block.get('[data-testid="sale-address-source-notice"]').text()).toBe(message)
  })

  it('UNCHANGED and label-only show the address without a notice', async () => {
    for (const status of [
      { sourceStatus: 'UNCHANGED' as const, changedFields: [] },
      { sourceStatus: 'CHANGED' as const, changedFields: ['label'] },
    ]) {
      const wrapper = await mountCard({ ...snapshot, ...status })
      expect(wrapper.get('[data-testid="sale-shipping-address"]').text()).toContain('Calle Prueba 1')
      expect(wrapper.find('[data-testid="sale-address-source-notice"]').exists()).toBe(false)
    }
  })

  it('a sale without shipping address shows nothing new', async () => {
    for (const shippingAddress of [null, undefined]) {
      const wrapper = await mountCard(shippingAddress)
      expect(wrapper.find('[data-testid="reflow-shipping-address"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Dirección de envío')
    }
  })
})
