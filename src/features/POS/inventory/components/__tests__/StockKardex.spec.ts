/**
 * StockKardex — the four S10 states (empty, loading, data, error) plus no-match,
 * against the REAL AppDataTable; only the viewport breakpoint is stubbed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { StockMovement } from '../../interfaces/inventory.types'
import StockKardex from '../StockKardex.vue'

const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

function movement(patch: Partial<StockMovement> & { id: string }): StockMovement {
  return {
    type: 'SALE', bucket: 'LOT', productId: 'p1', variantId: null, lotId: 'l1',
    labels: { product: 'Croquetas', variant: null, lot: 'L-A' }, delta: -3, balanceAfter: 0, productBalanceAfter: 15,
    reason: null, note: null, removalCause: null, group: { type: 'SALE', id: 'sale-1' },
    actor: { displayName: 'María López' }, createdAt: '2026-11-04T15:02:11.120Z', ...patch,
  }
}
const opening = movement({
  id: 'o', type: 'OPENING', bucket: 'PRODUCT_UNTRACKED', lotId: null, labels: { product: 'Croquetas', variant: null, lot: null },
  delta: 40, balanceAfter: 40, productBalanceAfter: 40, group: { type: 'PRODUCT', id: 'p1' }, actor: { displayName: 'Sistema' },
  createdAt: '2026-10-01T10:00:00.000Z',
})
const adjustment = movement({
  id: 'a', type: 'ADJUSTMENT', delta: -8, balanceAfter: 14, productBalanceAfter: 32, reason: 'EXPIRED',
  note: 'Lote vencido retirado', group: { type: 'ADJUSTMENT', id: 'adj-1' },
})
const saleRows = [
  movement({ id: 's3', bucket: 'PRODUCT_UNTRACKED', lotId: null, labels: { product: 'Croquetas', variant: null, lot: null }, delta: -2, balanceAfter: 3, productBalanceAfter: 3 }),
  movement({ id: 's2', labels: { product: 'Croquetas', variant: null, lot: 'L-B' }, lotId: 'l2', delta: -10, balanceAfter: 0, productBalanceAfter: 5 }),
  movement({ id: 's1', delta: -3, balanceAfter: 0, productBalanceAfter: 15 }),
]

function mountKardex(props: Record<string, unknown> = {}) {
  return mount(StockKardex, {
    props: { items: [adjustment, opening], ...props },
    global: { stubs: { DataTableToolbar: true, DataTablePagination: true } },
  })
}
beforeEach(() => { isBelowBreakpoint.value = false })

describe('kardex — empty (nada todavía)', () => {
  it('says there are no movements yet, with no action', () => {
    const wrapper = mountKardex({ items: [] })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__title').text()).toBe('Aún no hay movimientos')
    expect(wrapper.find('[data-testid="empty-state-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="kardex-load-more"]').exists()).toBe(false)
  })
})

describe('kardex — loading', () => {
  it('renders the table skeleton and no rows', () => {
    const wrapper = mountKardex({ items: [], loading: true })
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})

describe('kardex — data', () => {
  it('shows date, type, bucket, signed delta, balances, reason/note and actor, with no state chrome', () => {
    const wrapper = mountKardex()
    const text = wrapper.text()
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(text).toContain('Ajuste')
    expect(text).toContain('Caducado · Lote vencido retirado')
    expect(text).toContain('Lote L-A')
    expect(text).toContain('−8')
    expect(text).toContain('María López')
    expect(text).toContain('Apertura')
    expect(text).toContain('Sin lote')
    expect(text).toContain('+40')
    expect(text).toContain('Sistema')
    expect(text).toMatch(/nov/)
    expect(text).toMatch(/oct/)
    const body = wrapper.findAll('tbody tr')
    expect(body).toHaveLength(2)
    const cells = body[0]!.findAll('td').map(cell => cell.text())
    expect(cells.some(cell => cell === '14')).toBe(true)
    expect(cells.some(cell => cell === '32')).toBe(true)
  })

  it('never prints a movement or sale id', () => {
    const wrapper = mountKardex({ items: [...saleRows, adjustment] })
    expect(wrapper.html()).not.toMatch(/sale-1|adj-1/)
  })

  it('folds a sale that consumed three buckets into one operation and expands the split on demand', async () => {
    const wrapper = mountKardex({ items: saleRows })
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    const toggle = wrapper.get('[data-testid="kardex-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).toContain('Venta')
    expect(wrapper.text()).toContain('−15')
    expect(wrapper.text()).toContain('3 ubicaciones')
    await toggle.trigger('click')
    expect(wrapper.get('[data-testid="kardex-toggle"]').attributes('aria-expanded')).toBe('true')
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows.slice(1).map(row => row.text())).toEqual([
      expect.stringContaining('Sin lote'), expect.stringContaining('Lote L-B'), expect.stringContaining('Lote L-A'),
    ])
    expect(rows.slice(1).every(row => row.find('[data-testid="kardex-toggle"]').exists() === false)).toBe(true)
    await wrapper.get('[data-testid="kardex-toggle"]').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('renders cards on mobile with the same content and the same split', async () => {
    isBelowBreakpoint.value = true
    const wrapper = mountKardex({ items: [...saleRows, adjustment] })
    const cards = wrapper.findAll('[data-testid="kardex-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('Venta')
    expect(cards[0]!.text()).toContain('−15')
    expect(cards[1]!.text()).toContain('Caducado · Lote vencido retirado')
    await cards[0]!.get('[data-testid="kardex-toggle"]').trigger('click')
    expect(wrapper.findAll('[data-testid="kardex-card"]')).toHaveLength(5)
  })
})

describe('kardex — error', () => {
  it('shows the fixed title in a danger alert and refreshes from Reintentar', async () => {
    const wrapper = mountKardex({ items: [], error: true })
    const state = wrapper.get('[data-testid="table-error-state"]')
    expect(state.attributes('role')).toBe('alert')
    expect(state.text()).toContain('No se pudieron cargar los movimientos')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})

describe('kardex — filters (lot and variant chips)', () => {
  const filters = [
    { kind: 'lot' as const, id: 'l1', label: 'Lote L-2027-01' },
    { kind: 'lot' as const, id: 'l2', label: 'Lote L-2027-06' },
  ]
  it('shows no chips when there is nothing to filter by', () => {
    expect(mountKardex().find('[data-testid="kardex-filters"]').exists()).toBe(false)
  })
  it('lists «Todos» and every bucket, marks the active one and emits the choice', async () => {
    const wrapper = mountKardex({ filters, filter: { kind: 'lot', id: 'l2' } })
    const chips = wrapper.findAll('[data-testid="kardex-filters"] button')
    expect(chips.map(chip => chip.text())).toEqual(['Todos', 'Lote L-2027-01', 'Lote L-2027-06'])
    expect(chips.map(chip => chip.attributes('aria-pressed'))).toEqual(['false', 'false', 'true'])
    await chips[1]!.trigger('click')
    expect(wrapper.emitted('update:filter')).toEqual([[{ kind: 'lot', id: 'l1' }]])
    await chips[0]!.trigger('click')
    expect(wrapper.emitted('update:filter')![1]).toEqual([null])
  })
  it('says no movement matches the chosen bucket and clears it', async () => {
    const wrapper = mountKardex({ items: [], filters, filter: { kind: 'lot', id: 'l1' } })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('no-match')
    expect(state.get('.hf-empty-state__title').text()).toBe('Ningún movimiento en esta ubicación')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(wrapper.emitted('update:filter')).toEqual([[null]])
  })
})

describe('kardex — Cargar más', () => {
  it('offers the button only while a next page exists and asks for it', async () => {
    const wrapper = mountKardex({ hasMore: true })
    const button = wrapper.get('[data-testid="kardex-load-more"]')
    expect(button.text()).toBe('Cargar más')
    await button.trigger('click')
    expect(wrapper.emitted('load-more')).toHaveLength(1)
    await wrapper.setProps({ hasMore: false })
    expect(wrapper.find('[data-testid="kardex-load-more"]').exists()).toBe(false)
  })
  it('disables the button while the next page loads', () => {
    const wrapper = mountKardex({ hasMore: true, loadingMore: true })
    expect(wrapper.get('[data-testid="kardex-load-more"]').attributes('disabled')).toBeDefined()
  })
  it('keeps the rows and says the next page failed, with the button still there', () => {
    const wrapper = mountKardex({ hasMore: true, loadMoreError: true })
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.get('[data-testid="kardex-load-more-error"]').attributes('role')).toBe('alert')
    expect(wrapper.get('[data-testid="kardex-load-more-error"]').text()).toBe('No se pudieron cargar más movimientos.')
    expect(wrapper.find('[data-testid="kardex-load-more"]').exists()).toBe(true)
  })
})
