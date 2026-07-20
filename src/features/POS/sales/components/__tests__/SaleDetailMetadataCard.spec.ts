import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailMetadataCard from '../SaleDetailMetadataCard.vue'
import type { SaleDetail } from '../../interfaces/sale.types'

// Freeze the clock so the "Hoy a las" relative-format branch is deterministic:
// the fixture's confirmedAt must fall on the same calendar day as the frozen now.
const FROZEN_NOW = new Date('2026-05-16T12:00:00Z')

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
  customer: null,
  cashier: { id: 'cashier-1', name: 'María García' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
  globalPriceListId: null,
}

describe('SaleDetailMetadataCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('displays all metadata fields', () => {
    const wrapper = mountWithUApp(SaleDetailMetadataCard, {
      props: { sale: mockSale },
    })
    
    const text = wrapper.text()
    expect(text).toContain('Fecha')
    expect(text).toContain('Canal')
    expect(text).toContain('Punto de Venta')
    expect(text).toContain('Caja')
    expect(text).toContain('Principal')
    expect(text).toContain('Cajero')
    expect(text).toContain('María García')
    // pos-price-list-tiers: always shows the list used
    expect(text).toContain('Lista')
  })

  it('displays formatted date', () => {
    const wrapper = mountWithUApp(SaleDetailMetadataCard, {
      props: { sale: mockSale },
    })
    
    expect(wrapper.text()).toContain('Hoy a las')
  })
})