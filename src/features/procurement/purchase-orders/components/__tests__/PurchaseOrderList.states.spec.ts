/**
 * PurchaseOrderList — the four S10 states (empty, loading, data, error) plus
 * no-match, against the REAL AppDataTable. Only the viewport and the toolbar and
 * pagination chrome are stubbed; the states are what the shared table renders.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import PurchaseOrderList from '../PurchaseOrderList.vue'
import type { PurchaseOrderSummary } from '../../interfaces/purchase-order.types'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const row: PurchaseOrderSummary = { id: 'o', version: 1, status: 'DRAFT', supplierDisplaySnapshot: { id: 's', displayName: 'Distribuidora Norte', status: 'ACTIVE' }, lineCount: 2, issueCount: 0, note: null, locationDetail: null, totals: null, createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:20:00Z' }

function mountList(props: Record<string, unknown> = {}) {
  return mount(PurchaseOrderList, {
    props: { items: [row], canEdit: true, canDelete: true, ...props },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
}

beforeEach(() => { isBelowBreakpoint.value = false })

describe('purchase order list states — empty (nada todavía)', () => {
  it('says there are no orders yet and offers a new one with permission', async () => {
    const wrapper = mountList({ items: [], canCreate: true })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__title').text()).toBe('Aún no hay órdenes de compra')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('shows no create action without permission', () => {
    const wrapper = mountList({ items: [], canCreate: false })
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('empty')
    expect(wrapper.find('[data-testid="empty-state-action"]').exists()).toBe(false)
  })

  it('uses the shared state on mobile too, with no dashed legacy box', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountList({ items: [], canCreate: true })
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('empty')
    expect(wrapper.html()).not.toContain('border-dashed')
  })
})

describe('purchase order list states — no match', () => {
  it('names the filters and clears them from the state', async () => {
    const wrapper = mountList({ items: [], canCreate: true, filtered: true })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('no-match')
    expect(state.get('.hf-empty-state__title').text()).toBe('Ninguna orden con estos filtros')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
    expect(wrapper.emitted('create')).toBeUndefined()
  })

  it('echoes the search term in the title', () => {
    const wrapper = mountList({ items: [], filtered: true, search: 'norte' })
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «norte»')
  })
})

describe('purchase order list states — loading', () => {
  it('renders a table skeleton, no rows and no state chrome', () => {
    const wrapper = mountList({ items: [], loading: true })
    expect(wrapper.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('renders card skeletons on mobile', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountList({ items: [], loading: true })
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]').length).toBeGreaterThanOrEqual(1)
  })
})

describe('purchase order list states — data', () => {
  it('renders the rows with no state chrome', () => {
    const wrapper = mountList({ canCreate: true, filtered: true })
    expect(wrapper.get('.hf-row-primary').text()).toBe('Distribuidora Norte')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})

describe('purchase order list states — error', () => {
  it('shows the shared error with a human title and Reintentar that refreshes', async () => {
    const wrapper = mountList({ items: [], error: true })
    const state = wrapper.get('[data-testid="table-error-state"]')
    expect(state.attributes('role')).toBe('alert')
    expect(state.get('.hf-empty-state__title').text()).toBe('No se pudieron cargar las órdenes')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
