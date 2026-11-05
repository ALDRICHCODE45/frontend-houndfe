import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryList from './SalesHistoryList.vue'

const stubs = {
  StatusBadge: {
    props: ['label', 'tone'],
    template: '<span data-testid="status-badge" :data-label="label" :data-tone="tone" />',
  },
  UIcon: { template: '<span data-testid="icon" />' },
}

const makeSale = (over: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow => ({
  id: 'sale-1',
  folio: 'A-202608-000042',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  totalCents: 180_000,
  debtCents: 0,
  confirmedAt: '2026-08-30T14:00:00.000Z',
  dueDate: null,
  customer: null,
  cashier: { id: 'u1', name: 'Caja 1' },
  seller: null,
  paymentMethods: [],
  ...over,
})

const mountList = (sales: ConfirmedSaleRow[]) =>
  mount(SalesHistoryList, { props: { sales }, global: { stubs } })

describe('SalesHistoryList', () => {
  it('renders one semantic native button per sale inside a <ul>', () => {
    const w = mountList([makeSale({ id: 'a' }), makeSale({ id: 'b' })])
    expect(w.find('ul').exists()).toBe(true)
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.findAll('button[type="button"]')).toHaveLength(2)
  })

  it('displays formatCentsMXN values and explicit null fallbacks', () => {
    const w = mountList([
      makeSale({ id: 'a', folio: null, confirmedAt: null, paymentStatus: null }),
      makeSale({ id: 'b', totalCents: 180_000, debtCents: 45_000 }),
    ])
    expect(w.text()).toContain('Sin folio')
    expect(w.text()).toContain('Fecha no disponible')
    expect(w.find('[data-testid="status-badge"]').attributes('data-label')).toContain('Sin estado')
    expect(w.text()).toContain('$1,800.00')
    expect(w.text()).toContain('$450.00')
  })

  it('emits typed select with the original DTO exactly once per activation', () => {
    const sale = makeSale({ id: 'sale-x' })
    const w = mountList([sale])
    w.find('button').trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
    expect(w.emitted('select')![0]).toEqual([sale])
  })

  it('renders all-nullable sale fields with fallbacks in text and accessible name', () => {
    const w = mountList([makeSale({ folio: null, confirmedAt: null, paymentStatus: null })])
    expect(w.text()).toContain('Sin folio')
    expect(w.text()).toContain('Fecha no disponible')
    expect(w.find('[data-testid="status-badge"]').attributes('data-label')).toContain('Sin estado')
    const label = w.find('button').attributes('aria-label')
    expect(label).toContain('sin folio')
    expect(label).toContain('fecha no disponible')
    expect(label).toContain('saldo de $0.00')
  })

  it('generates the bound-handoff accessible name for a complete sale', () => {
    const w = mountList([makeSale({ folio: 'A-202608-000042', totalCents: 180_000, debtCents: 50_000 })])
    const label = w.find('button').attributes('aria-label')
    expect(label).toContain('Venta folio A-202608-000042')
    expect(label).toContain('$1,800.00')
    expect(label).toContain('saldo de $500.00')
  })

  it('emits select exactly once per click, in row order, with the original DTOs', () => {
    const sales = [makeSale({ id: 's1' }), makeSale({ id: 's2' }), makeSale({ id: 's3' })]
    const w = mountList(sales)
    const buttons = w.findAll('button')
    buttons[0]!.trigger('click')
    buttons[2]!.trigger('click')
    buttons[2]!.trigger('click')
    const emitted = w.emitted('select')
    expect(emitted).toHaveLength(3)
    const clickedOrder = [0, 2, 2] as const
    emitted!.forEach((args, i) => expect(args).toEqual([sales[clickedOrder[i]!]]))
  })

  it('maps payment statuses to existing badge labels and tones', () => {
    const w = mountList([
      makeSale({ id: 'p', paymentStatus: 'PARTIAL' }),
      makeSale({ id: 'c', paymentStatus: 'CREDIT' }),
      makeSale({ id: 'a', paymentStatus: 'PAID' }),
    ])
    const badges = w.findAll('[data-testid="status-badge"]')
    const labels = badges.map(b => b.attributes('data-label'))
    const tones = badges.map(b => b.attributes('data-tone'))
    expect(labels[0]).toContain('Impaga')
    expect(tones[0]).toBe('warning')
    expect(labels[1]).toContain('Deuda')
    expect(tones[1]).toBe('danger')
    expect(labels[2]).toContain('Pagada')
    expect(tones[2]).toBe('success')
  })

  it('renders the leading receipt icon and right-aligned total', () => {
    const w = mountList([makeSale({ totalCents: 99_999 })])
    const icon = w.find('[data-testid="sale-history-row-icon"]')
    expect(icon.classes()).toContain('size-10')
    expect(w.find('[data-testid="sale-history-row-total"]').text()).toContain('$999.99')
  })

  it('uses the shared StatusBadge and renders the debt only when there is one', () => {
    const w = mountList([
      makeSale({ id: 'paid', paymentStatus: 'PAID', debtCents: 0 }),
      makeSale({ id: 'partial', paymentStatus: 'PARTIAL', debtCents: 25_000 }),
    ])
    expect(w.findAll('[data-testid="status-badge"]')).toHaveLength(2)
    const badges = w.findAll('[data-testid="status-badge"]')
    expect(badges[0]!.attributes('data-label')).toContain('Pagada')
    expect(badges[1]!.attributes('data-label')).toContain('Impaga')
    expect(w.text()).toContain('$250.00')
  })
})

describe('SalesHistoryList — pattern', () => {
  it('shows a short date and the debt as a quiet warning figure, never the legacy red', () => {
    const w = mountList([makeSale({ debtCents: 25_000, paymentStatus: 'PARTIAL' })])
    expect(w.text()).not.toContain('30/08/2026')
    const debt = w.find('.text-\\[var\\(--hf-warning\\)\\]')
    expect(debt.exists()).toBe(true)
    expect(debt.text()).toContain('$250.00 pendiente')
    expect(w.html()).not.toMatch(/text-error|gray-|primary-500/)
  })

  it('keeps the total right-aligned and tabular', () => {
    const w = mountList([makeSale()])
    const total = w.get('[data-testid="sale-history-row-total"]')
    expect(total.classes()).toContain('hf-figure')
    expect(total.classes()).toContain('justify-self-end')
  })

  // T21 [S18]: the same shared rule as the Ventas list.
  it('shows a canceled sale as one neutral «Cancelada» with no pending debt', () => {
    const w = mountList([makeSale({ status: 'CANCELED', paymentStatus: 'PARTIAL', debtCents: 25_000 })])
    const badges = w.findAll('[data-testid="status-badge"]')
    expect(badges.map(b => b.attributes('data-label'))).toEqual(['Cancelada'])
    expect(badges[0]!.attributes('data-tone')).toBe('neutral')
    expect(w.text()).not.toContain('pendiente')
  })
})
