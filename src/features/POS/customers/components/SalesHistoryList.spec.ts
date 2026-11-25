import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryList from './SalesHistoryList.vue'

// Sales history redesign T1: aligned table (desktop) / cards (390) whose rows expand in place into
// the shared `SaleHistoryRowDetail` (its own spec pins the GET /sales/:id contract).
const stubs = {
  StatusBadge: {
    props: ['label', 'tone'],
    template: '<span data-testid="status-badge" :data-label="label" :data-tone="tone">{{ label }}</span>',
  },
  UIcon: { template: '<span data-testid="icon" />' },
  SaleHistoryRowDetail: {
    props: ['saleId', 'allowCharge'],
    emits: ['charge'],
    template:
      '<div data-testid="row-detail" :data-sale-id="saleId" :data-allow-charge="String(allowCharge)">' +
      '<button type="button" data-testid="row-detail-charge" @click="$emit(\'charge\', { saleId, debtCents: 1 })" /></div>',
  },
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
  channel: 'POS',
  ...over,
})

const mountList = (sales: ConfirmedSaleRow[], props: Record<string, unknown> = {}) =>
  mount(SalesHistoryList, { props: { sales, ...props }, global: { stubs } })

const expandButtons = (w: ReturnType<typeof mountList>) => w.findAll('button[aria-expanded]')

describe('SalesHistoryList — table', () => {
  it('renders the aligned columns Venta, Pago, Total and Saldo', () => {
    const w = mountList([makeSale()])
    expect(w.find('table').exists()).toBe(true)
    const headers = w.findAll('thead th').map((th) => th.text())
    expect(headers).toEqual(['Abrir', 'Venta', 'Pago', 'Total', 'Saldo'])
    expect(w.find('caption').text()).toContain('más recientes primero')
  })

  it('renders folio, date, channel, payment badge, delivery, total, balance and due date from the row', () => {
    const w = mountList([
      makeSale({
        folio: 'S-000412',
        paymentStatus: 'PARTIAL',
        deliveryStatus: 'PENDING',
        totalCents: 148_600,
        debtCents: 78_600,
        dueDate: '2026-12-06T00:00:00.000Z',
        channel: 'ONLINE',
      }),
    ])
    const cells = w.findAll('tbody tr')[0]!.findAll('td')
    expect(cells[1]!.text()).toContain('S-000412')
    expect(cells[1]!.text()).toContain('30 ago')
    expect(cells[1]!.text()).toContain('En línea')
    expect(cells[2]!.find('[data-testid="status-badge"]').attributes('data-label')).toBe('Impaga')
    expect(cells[2]!.text()).toContain('No entregada')
    expect(cells[3]!.text()).toBe('$1,486.00')
    expect(cells[3]!.classes()).toEqual(expect.arrayContaining(['hf-figure', 'text-right']))
    expect(cells[4]!.text()).toContain('$786.00')
    expect(cells[4]!.text()).toContain('Vence 06/12/2026')
    expect(cells[4]!.find('.text-\\[var\\(--hf-warning\\)\\]').exists()).toBe(true)
  })

  it('keeps the current payment-status labels and tones of this screen', () => {
    const w = mountList([
      makeSale({ id: 'p', paymentStatus: 'PARTIAL' }),
      makeSale({ id: 'c', paymentStatus: 'CREDIT' }),
      makeSale({ id: 'a', paymentStatus: 'PAID' }),
      makeSale({ id: 'n', paymentStatus: null }),
    ])
    const badges = w.findAll('[data-testid="status-badge"]')
    expect(badges.map((b) => b.attributes('data-label'))).toEqual(['Impaga', 'Deuda', 'Pagada', 'Sin estado'])
    expect(badges.map((b) => b.attributes('data-tone'))).toEqual(['warning', 'danger', 'success', 'neutral'])
  })

  it('shows explicit fallbacks for a null folio and date and a zero balance', () => {
    const w = mountList([makeSale({ folio: null, confirmedAt: null })])
    expect(w.text()).toContain('Sin folio')
    expect(w.text()).toContain('Fecha no disponible')
    expect(w.findAll('tbody tr')[0]!.findAll('td')[4]!.text()).toBe('$0.00')
  })

  it('shows a canceled sale as one neutral «Cancelada» with its reason and no balance', () => {
    const w = mountList([
      makeSale({ status: 'CANCELED', paymentStatus: 'PARTIAL', debtCents: 25_000, cancelReason: 'CUSTOMER_REQUEST' }),
    ])
    const badges = w.findAll('[data-testid="status-badge"]')
    expect(badges.map((b) => b.attributes('data-label'))).toEqual(['Cancelada'])
    expect(badges[0]!.attributes('data-tone')).toBe('neutral')
    expect(w.text()).toContain('Solicitud del cliente')
    expect(w.findAll('tbody tr')[0]!.findAll('td')[4]!.text()).toBe('—')
  })

  it('opens a row in place: the 44px toggle names the sale, expands and mounts its detail', async () => {
    const w = mountList([makeSale({ id: 's1', folio: 'S-1' }), makeSale({ id: 's2', folio: 'S-2' })])
    const [first] = expandButtons(w)
    expect(first!.attributes('aria-label')).toBe('Detalle de la venta S-1')
    expect(first!.attributes('aria-expanded')).toBe('false')
    expect(first!.classes()).toContain('size-11')
    expect(w.find('[data-testid="row-detail"]').exists()).toBe(false)

    await first!.trigger('click')
    expect(first!.attributes('aria-expanded')).toBe('true')
    const detail = w.get('[data-testid="row-detail"]')
    expect(detail.attributes('data-sale-id')).toBe('s1')
    expect(w.find(`#${first!.attributes('aria-controls')}`).exists()).toBe(true)

    await first!.trigger('click')
    expect(w.find('[data-testid="row-detail"]').exists()).toBe(false)
  })

  it('forwards allowCharge and re-emits the detail «Cobrar» request', async () => {
    const w = mountList([makeSale({ id: 's1' })], { allowCharge: true })
    await expandButtons(w)[0]!.trigger('click')
    expect(w.get('[data-testid="row-detail"]').attributes('data-allow-charge')).toBe('true')
    await w.get('[data-testid="row-detail-charge"]').trigger('click')
    expect(w.emitted('charge')).toEqual([[{ saleId: 's1', debtCents: 1 }]])
  })
})

describe('SalesHistoryList — cards (390)', () => {
  it('renders one card per sale and no table (no sideways scroll)', () => {
    const w = mountList([makeSale({ id: 'a' }), makeSale({ id: 'b' })], { layout: 'cards' })
    expect(w.find('table').exists()).toBe(false)
    const cards = w.findAll('[data-testid="sale-history-card"]')
    expect(cards).toHaveLength(2)
    expect(w.get('ul').classes()).toContain('min-w-0')
  })

  it('shows folio and total first, then date, badges and «Debe … · vence …»', () => {
    const w = mountList(
      [
        makeSale({
          folio: 'S-000412',
          paymentStatus: 'PARTIAL',
          deliveryStatus: 'PENDING',
          totalCents: 148_600,
          debtCents: 78_600,
          dueDate: '2026-12-06T00:00:00.000Z',
        }),
      ],
      { layout: 'cards' },
    )
    const card = w.get('[data-testid="sale-history-card"]')
    expect(card.text()).toContain('S-000412')
    expect(card.text()).toContain('$1,486.00')
    expect(card.findAll('[data-testid="status-badge"]').map((b) => b.attributes('data-label'))).toEqual([
      'Impaga',
      'No entregada',
    ])
    expect(card.text()).toContain('Debe $786.00 · vence 06/12/2026')
  })

  it('opens the detail inside the card with a full-width 44px toggle', async () => {
    const w = mountList([makeSale({ id: 's1' })], { layout: 'cards' })
    const toggle = expandButtons(w)[0]!
    expect(toggle.text()).toContain('Ver productos y detalle')
    expect(toggle.classes()).toEqual(expect.arrayContaining(['min-h-11', 'w-full']))
    await toggle.trigger('click')
    expect(toggle.text()).toContain('Ocultar detalle')
    expect(w.get('[data-testid="sale-history-card"]').find('[data-testid="row-detail"]').exists()).toBe(true)
  })

  it('lets long folios wrap inside the card', () => {
    const w = mountList([makeSale({ folio: 'S-0004120000000000000000000001' })], { layout: 'cards' })
    expect(w.get('[data-testid="sale-history-card-folio"]').classes()).toContain('break-all')
  })
})
