import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CustomerSalesMonth } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryMonthlyChart from './SalesHistoryMonthlyChart.vue'

// Sales history backend data T1 (S4, handoff 28 §4): a compact bar chart of the customer's months
// (oldest first, zero months included), CSS only, every bar named for screen readers.
const stubs = { UIcon: true }

function months(): CustomerSalesMonth[] {
  const list: CustomerSalesMonth[] = []
  for (let index = 0; index < 12; index += 1) {
    const year = index < 2 ? 2025 : 2026
    const month = ((index + 10) % 12) + 1
    list.push({ month: `${year}-${String(month).padStart(2, '0')}`, saleCount: 0, totalCents: 0 })
  }
  list[10] = { month: '2026-10', saleCount: 2, totalCents: 58_000 }
  list[11] = { month: '2026-11', saleCount: 3, totalCents: 125_000 }
  return list
}

const mountChart = (props: Record<string, unknown>) =>
  mount(SalesHistoryMonthlyChart, { props, global: { stubs } })

describe('SalesHistoryMonthlyChart', () => {
  it('draws one bar per month, oldest first, with accessible labels (month, count, total)', () => {
    const w = mountChart({ months: months() })
    const list = w.get('ol')
    expect(list.attributes('aria-label')).toBe('Ventas por mes, últimos 12 meses')
    const items = list.findAll('li')
    expect(items).toHaveLength(12)
    expect(items[0]!.get('.sr-only').text()).toBe('noviembre 2025: sin ventas')
    expect(items[10]!.get('.sr-only').text()).toBe('octubre 2026: 2 ventas, $580.00')
    expect(items[11]!.get('.sr-only').text()).toBe('noviembre 2026: 3 ventas, $1,250.00')
  })

  it('scales the bars to the busiest month and keeps a visible stub for empty months', () => {
    const w = mountChart({ months: months() })
    const bars = w.findAll('[data-testid="monthly-bar"]')
    expect(bars[11]!.attributes('style')).toContain('height: 100%')
    expect(bars[10]!.attributes('style')).toContain('height: 46.4%')
    expect(bars[0]!.attributes('data-empty')).toBe('true')
    expect(bars[11]!.attributes('data-empty')).toBe('false')
  })

  it('uses the singular for one sale', () => {
    const list = months()
    list[11] = { month: '2026-11', saleCount: 1, totalCents: 10_000 }
    const w = mountChart({ months: list })
    expect(w.findAll('li')[11]!.get('.sr-only').text()).toBe('noviembre 2026: 1 venta, $100.00')
  })

  it('reads the month from the string, never through a Date (no timezone shift)', () => {
    const w = mountChart({ months: [{ month: '2026-01', saleCount: 1, totalCents: 100 }] })
    expect(w.get('li .sr-only').text()).toContain('enero 2026')
    expect(w.get('ol').attributes('aria-label')).toBe('Ventas por mes, último mes')
  })

  it('on failure shows only a quiet line with a small retry', async () => {
    const w = mountChart({ failed: true })
    expect(w.find('ol').exists()).toBe(false)
    const retry = w.get('[data-testid="monthly-retry"]')
    expect(retry.text()).toContain('Reintentar')
    await retry.trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })
})
