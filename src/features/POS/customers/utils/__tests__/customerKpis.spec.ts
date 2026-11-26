import { describe, expect, it } from 'vitest'
import type { ConfirmedSaleRow, SaleListSummary, SalesListCounts } from '@/features/POS/sales/interfaces/sale.types'
import { buildCustomerKpis, latestPurchase } from '../customerKpis'

const summary = (overrides: Partial<SaleListSummary> = {}): SaleListSummary => ({
  salesCount: 23,
  totalSoldCents: 1_846_050,
  outstandingDebtCents: 128_400,
  averageTicketCents: 80_263,
  overdueDebtCents: 49_800,
  oldestOverdueDueDate: '2026-11-20',
  ...overrides,
})
const counts = (overrides: Partial<SalesListCounts> = {}): SalesListCounts => ({
  all: 23,
  pendingPayments: 2,
  notDelivered: 1,
  overdue: 1,
  ...overrides,
})
const sale = (overrides: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow => ({
  id: 's-1',
  folio: 'S-000412',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  totalCents: 148_600,
  debtCents: 0,
  confirmedAt: '2026-11-22T17:42:00.000Z',
  dueDate: null,
  customer: null,
  cashier: { id: 'u', name: 'Caja' },
  seller: null,
  paymentMethods: [],
  ...overrides,
})

const byKey = (kpis: ReturnType<typeof buildCustomerKpis>) => Object.fromEntries(kpis.map((k) => [k.key, k]))

describe('buildCustomerKpis — straight from GET /sales?customerId= summary and counts', () => {
  it('maps the five KPIs without adding money client-side', () => {
    const kpis = byKey(buildCustomerKpis(summary(), counts(), sale()))
    expect(Object.keys(kpis)).toEqual(['debt', 'overdue', 'total', 'average', 'last'])
    expect(kpis.debt).toMatchObject({ label: 'Deuda', value: '$1,284.00', note: '2 ventas por cobrar', tone: 'warning' })
    expect(kpis.overdue).toMatchObject({ label: 'Vencido', value: '$498.00', note: '1 vencida · desde 20/11/2026', tone: 'warning' })
    expect(kpis.total).toMatchObject({ label: 'Total comprado', value: '$18,460.50', note: '23 ventas' })
    expect(kpis.average).toMatchObject({ label: 'Ticket promedio', value: '$802.63', note: 'por venta' })
    expect(kpis.last).toMatchObject({ label: 'Última compra', note: 'S-000412' })
    expect(kpis.last!.value).toMatch(/22 nov 2026/)
  })

  it('reads the oldest overdue due day from its first 10 characters (no time zone shift)', () => {
    const kpis = byKey(buildCustomerKpis(summary({ oldestOverdueDueDate: '2026-11-20T00:00:00.000Z' }), counts({ overdue: 2 }), sale()))
    expect(kpis.overdue!.note).toBe('2 vencidas · desde 20/11/2026')
  })

  it('a customer without debt is «Al corriente» and nothing is overdue', () => {
    const kpis = byKey(buildCustomerKpis(
      summary({ outstandingDebtCents: 0, overdueDebtCents: 0, oldestOverdueDueDate: null }),
      counts({ pendingPayments: 0, overdue: 0 }),
      sale(),
    ))
    expect(kpis.debt).toMatchObject({ value: '$0.00', note: 'Al corriente', tone: 'success' })
    expect(kpis.overdue).toMatchObject({ value: '$0.00', note: 'Nada vencido', tone: 'neutral' })
  })

  it('an older backend without overdue or average fields hides those KPIs', () => {
    const kpis = byKey(buildCustomerKpis(
      { salesCount: 1, totalSoldCents: 1000, outstandingDebtCents: 0 },
      { all: 1, pendingPayments: 0, notDelivered: 0 },
      sale(),
    ))
    expect(Object.keys(kpis)).toEqual(['debt', 'total', 'last'])
  })

  it('without a purchase the last purchase reads «Sin compras»', () => {
    const kpis = byKey(buildCustomerKpis(summary({ salesCount: 0 }), counts(), null))
    expect(kpis.last).toMatchObject({ value: '—', note: 'Sin compras' })
    expect(kpis.total!.note).toBe('0 ventas')
  })
})

describe('latestPurchase', () => {
  it('is the newest row that was not cancelled (rows come newest first)', () => {
    const rows = [
      sale({ id: 'c', status: 'CANCELED' }),
      sale({ id: 'b' }),
      sale({ id: 'a' }),
    ]
    expect(latestPurchase(rows)?.id).toBe('b')
  })

  it('is null without rows or with only cancelled ones', () => {
    expect(latestPurchase([])).toBeNull()
    expect(latestPurchase(undefined)).toBeNull()
    expect(latestPurchase([sale({ status: 'CANCELED' })])).toBeNull()
  })
})
