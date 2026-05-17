import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailMetadataCard from '../SaleDetailMetadataCard.vue'
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
  customer: null,
  cashier: { id: 'cashier-1', name: 'María García' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
}

describe('SaleDetailMetadataCard', () => {
  it('displays all metadata fields', () => {
    const wrapper = mountWithUApp(SaleDetailMetadataCard, {
      props: { sale: mockSale }
    })
    
    const text = wrapper.text()
    expect(text).toContain('Fecha')
    expect(text).toContain('Canal')
    expect(text).toContain('Punto de Venta')
    expect(text).toContain('Caja')
    expect(text).toContain('Principal')
    expect(text).toContain('Cajero')
    expect(text).toContain('María García')
  })

  it('displays formatted date', () => {
    const wrapper = mountWithUApp(SaleDetailMetadataCard, {
      props: { sale: mockSale }
    })
    
    // The date is shown as relative format "Hoy a las..." for today's date
    expect(wrapper.text()).toContain('Hoy a las')
  })
})