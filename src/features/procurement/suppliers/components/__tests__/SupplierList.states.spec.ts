/**
 * SupplierList — the four S10 states (empty, loading, data, error) plus
 * no-match, against the REAL AppDataTable. Only the viewport and the toolbar and
 * pagination chrome are stubbed; the states are what the shared table renders.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SupplierList from '../SupplierList.vue'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const supplier = { id: 'one', displayName: 'Proveedor Centro', termsText: null, status: 'ACTIVE' as const, version: 1, createdAt: '', updatedAt: '2020-03-03T20:43:00Z' }

function mountList(props: Record<string, unknown> = {}) {
  return mount(SupplierList, {
    props: { items: [supplier], canEdit: true, ...props },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
}

beforeEach(() => { isBelowBreakpoint.value = false })

describe('supplier list states — empty (nada todavía)', () => {
  it('says there are no suppliers yet and offers to create one with permission', async () => {
    const wrapper = mountList({ items: [], canCreate: true })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__title').text()).toBe('Aún no hay proveedores')
    expect(state.text()).not.toContain('esta búsqueda')
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
    const state = wrapper.get('[data-testid="mobile-empty-state"] .hf-empty-state, .hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(wrapper.html()).not.toContain('border-dashed')
  })
})

describe('supplier list states — no match', () => {
  it('names the filters and clears them from the state', async () => {
    const wrapper = mountList({ items: [], canCreate: true, filtered: true })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('no-match')
    expect(state.get('.hf-empty-state__title').text()).toBe('Ningún proveedor con estos filtros')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
    expect(wrapper.emitted('create')).toBeUndefined()
  })

  it('echoes the search term in the title', () => {
    const wrapper = mountList({ items: [], filtered: true, search: 'norte' })
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «norte»')
  })
})

describe('supplier list states — loading', () => {
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

describe('supplier list states — data', () => {
  it('renders the rows with no state chrome', () => {
    const wrapper = mountList({ canCreate: true, filtered: true })
    expect(wrapper.get('.hf-row-primary').text()).toBe('Proveedor Centro')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})

describe('supplier list states — error', () => {
  it('shows the shared error with a human title and Reintentar that refreshes', async () => {
    const wrapper = mountList({ items: [], error: true })
    const state = wrapper.get('[data-testid="table-error-state"]')
    expect(state.attributes('role')).toBe('alert')
    expect(state.get('.hf-empty-state__title').text()).toBe('No se pudieron cargar los proveedores')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
