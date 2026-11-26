import { describe, expect, it } from 'vitest'
import type { CustomerSalesMetrics } from '../../interfaces/customer.types'
import { buildCustomerKpis } from '../customerKpis'

const metrics = (overrides: Partial<CustomerSalesMetrics> = {}): CustomerSalesMetrics => ({
  openDebtCents: 128_400,
  overdueDebtCents: 49_800,
  overdueCount: 1,
  oldestOverdueDueDate: '2026-11-20',
  salesCount: 23,
  totalSoldCents: 1_846_050,
  averageTicketCents: 80_263,
  lastPurchaseAt: '2026-11-22T17:42:00.000Z',
  ...overrides,
})

const byKey = (kpis: ReturnType<typeof buildCustomerKpis>) => Object.fromEntries(kpis.map((k) => [k.key, k]))

describe('buildCustomerKpis — straight from GET /customers/:id/sales-summary metrics (T5)', () => {
  it('maps the five KPIs without adding money client-side', () => {
    const kpis = byKey(buildCustomerKpis(metrics()))
    expect(Object.keys(kpis)).toEqual(['debt', 'overdue', 'total', 'average', 'last'])
    expect(kpis.debt).toMatchObject({ label: 'Deuda', value: '$1,284.00', note: 'Por cobrar', tone: 'warning' })
    expect(kpis.overdue).toMatchObject({ label: 'Vencido', value: '$498.00', note: '1 vencida · desde 20/11/2026', tone: 'warning' })
    expect(kpis.total).toMatchObject({ label: 'Total comprado', value: '$18,460.50', note: '23 ventas' })
    expect(kpis.average).toMatchObject({ label: 'Ticket promedio', value: '$802.63', note: 'por venta' })
    expect(kpis.last).toMatchObject({ label: 'Última compra', note: null })
    expect(kpis.last!.value).toMatch(/22 nov 2026/)
  })

  it('reads the oldest overdue due day as a calendar day (no time zone shift)', () => {
    const kpis = byKey(buildCustomerKpis(metrics({ oldestOverdueDueDate: '2026-11-01', overdueCount: 2 })))
    expect(kpis.overdue!.note).toBe('2 vencidas · desde 01/11/2026')
  })

  it('a customer without debt is «Al corriente» and nothing is overdue', () => {
    const kpis = byKey(buildCustomerKpis(metrics({
      openDebtCents: 0, overdueDebtCents: 0, overdueCount: 0, oldestOverdueDueDate: null,
    })))
    expect(kpis.debt).toMatchObject({ value: '$0.00', note: 'Al corriente', tone: 'success' })
    expect(kpis.overdue).toMatchObject({ value: '$0.00', note: 'Nada vencido', tone: 'neutral' })
  })

  it('a null average reads «—» (never $0)', () => {
    const kpis = byKey(buildCustomerKpis(metrics({ averageTicketCents: null })))
    expect(kpis.average).toMatchObject({ value: '—', note: 'Sin ventas' })
  })

  it('without sales: zeros, «—» average and «Sin compras»', () => {
    const kpis = byKey(buildCustomerKpis({
      openDebtCents: 0, overdueDebtCents: 0, overdueCount: 0, oldestOverdueDueDate: null,
      salesCount: 0, totalSoldCents: 0, averageTicketCents: null, lastPurchaseAt: null,
    }))
    expect(kpis.total).toMatchObject({ value: '$0.00', note: '0 ventas' })
    expect(kpis.average).toMatchObject({ value: '—' })
    expect(kpis.last).toMatchObject({ value: '—', note: 'Sin compras' })
  })

  it('an unreadable last purchase instant reads «—»', () => {
    const kpis = byKey(buildCustomerKpis(metrics({ lastPurchaseAt: 'not-a-date' })))
    expect(kpis.last).toMatchObject({ value: '—', note: 'Sin compras' })
  })
})
