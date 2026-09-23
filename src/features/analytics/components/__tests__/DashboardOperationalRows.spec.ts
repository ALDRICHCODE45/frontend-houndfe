// DashboardOperationalRows.spec.ts — exact real-field presentation for the
// three operational lists. No row is a navigation surface (OI-5B2 S2).

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import type { PendingRefundRow } from '@/features/POS/sales/interfaces/pending-refund.types'
import DashboardSaleRow from '../DashboardSaleRow.vue'
import DashboardRefundRow from '../DashboardRefundRow.vue'

function makeSale(over: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow {
  return {
    id: 'sale-1',
    folio: 'VTA-2025-0042',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    totalCents: 123_456,
    debtCents: 0,
    confirmedAt: '2025-03-01T12:30:00.000Z',
    dueDate: null,
    customer: { id: 'customer-1', name: 'María López' },
    cashier: { id: 'cashier-1', name: 'Caja Centro' },
    seller: null,
    paymentMethods: ['CASH'],
    ...over,
  }
}

function makeRefund(over: Partial<PendingRefundRow> = {}): PendingRefundRow {
  return {
    id: 'refund-1',
    saleId: 'sale-operational-id-001',
    method: 'card_credit',
    amountCents: 50_000,
    settledCents: 12_500,
    outstandingCents: 37_500,
    reason: 'CUSTOMER_REQUEST',
    status: 'PENDING',
    createdAt: '2025-03-02T01:15:00.000Z',
    ...over,
  }
}

describe('DashboardSaleRow — recent sale', () => {
  it('shows only authoritative sale fields with Mexico City event time', () => {
    const w = mount(DashboardSaleRow, { props: { sale: makeSale(), kind: 'recent' } })

    expect(w.text()).toContain('VTA-2025-0042')
    expect(w.text()).toContain('María López')
    expect(w.text()).toContain('$1,234.56')
    expect(w.text()).toContain('01/03/2025, 06:30')
    expect(w.text()).toContain('Venta confirmada')
    expect(w.find('time').attributes('datetime')).toBe('2025-03-01T12:30:00.000Z')
  })

  it('renders the null wire fallbacks without deriving an identifier or date', () => {
    const w = mount(DashboardSaleRow, {
      props: {
        sale: makeSale({ folio: null, confirmedAt: null, customer: null }),
        kind: 'recent',
      },
    })

    expect(w.text()).toContain('Sin folio')
    expect(w.text()).toContain('Fecha no disponible')
    expect(w.text()).toContain('Público en General')
    expect(w.find('time').exists()).toBe(false)
  })

  it('keeps the operational folio plain text and exposes no row navigation', () => {
    const w = mount(DashboardSaleRow, { props: { sale: makeSale(), kind: 'recent' } })

    expect(w.find('a').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
    expect(w.attributes('tabindex')).toBeUndefined()
    expect(w.text()).toContain('Folio VTA-2025-0042')
  })
})

describe('DashboardSaleRow — debt sale', () => {
  it('shows backend debt cents and the logical due date without a derived total', () => {
    const w = mount(DashboardSaleRow, {
      props: {
        sale: makeSale({
          totalCents: 1_000_000,
          debtCents: 25_500,
          dueDate: '2025-03-31T00:00:00.000Z',
        }),
        kind: 'debt',
      },
    })

    expect(w.text()).toContain('Deuda pendiente')
    expect(w.text()).toContain('$255.00')
    expect(w.text()).toContain('Vence 31/03/2025')
    expect(w.text()).not.toContain('$10,000.00')
  })

  it('uses a visible text cue in addition to the warning color and handles no due date', () => {
    const w = mount(DashboardSaleRow, {
      props: { sale: makeSale({ debtCents: 1, dueDate: null }), kind: 'debt' },
    })

    const amount = w.find('[data-testid="dashboard-sale-row-amount"]')
    expect(amount.text()).toContain('Deuda pendiente')
    expect(amount.classes()).toContain('text-warning')
    expect(w.text()).toContain('Sin fecha de vencimiento')
  })
})

describe('DashboardRefundRow — pending refund', () => {
  it('shows the backend outstanding cents, sale id, method, reason and Mexico City time', () => {
    const w = mount(DashboardRefundRow, { props: { refund: makeRefund() } })

    expect(w.text()).toContain('sale-operational-id-001')
    expect(w.text()).toContain('$375.00')
    expect(w.text()).toContain('Tarjeta de crédito')
    expect(w.text()).toContain('Solicitud del cliente')
    expect(w.text()).toContain('01/03/2025, 19:15')
    expect(w.text()).toContain('Pendiente')
    expect(w.find('time').attributes('datetime')).toBe('2025-03-02T01:15:00.000Z')
  })

  it.each([
    ['cash', 'Efectivo'],
    ['card_credit', 'Tarjeta de crédito'],
    ['card_debit', 'Tarjeta de débito'],
    ['transfer', 'Transferencia'],
    ['credit', 'Crédito'],
  ] as const)('labels method %s without exposing a raw enum', (method, label) => {
    const w = mount(DashboardRefundRow, { props: { refund: makeRefund({ method }) } })

    expect(w.text()).toContain(label)
  })

  it.each([
    ['CUSTOMER_REQUEST', 'Solicitud del cliente'],
    ['ORDER_ERROR', 'Error en la venta'],
    ['OUT_OF_STOCK', 'Sin existencias'],
    ['DUPLICATE_SALE', 'Venta duplicada'],
    ['OTHER', 'Otro'],
  ] as const)('labels reason %s as visible text', (reason, label) => {
    const w = mount(DashboardRefundRow, { props: { refund: makeRefund({ reason }) } })

    expect(w.text()).toContain(label)
  })

  it('keeps the sale identifier plain text and never invents a combined refund total', () => {
    const w = mount(DashboardRefundRow, { props: { refund: makeRefund() } })

    expect(w.find('a').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
    expect(w.text()).not.toContain('$500.00')
    expect(w.text()).not.toContain('$125.00')
    expect(w.text()).not.toMatch(/total|liquidado|porcentaje|%/i)
  })
})
