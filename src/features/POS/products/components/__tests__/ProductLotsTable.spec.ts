/**
 * ProductLotsTable — lot, expiry, stock and the ⋮ menu, for pending and saved lots, on the REAL
 * AppDataTable (premium tables T9); only the viewport breakpoint is stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { columnLabel } from '@/core/shared/components/DataTable/columnLayout.utils'
import ProductLotsTable, { type ProductLotRow } from '../ProductLotsTable.vue'

const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const lot: ProductLotRow = {
  id: 'lot-1',
  lotNumber: 'LOTE-2026-04',
  expirationDate: '2026-12-31',
  quantity: 12,
}

function mountTable(props: Record<string, unknown> = {}) {
  return mount(ProductLotsTable, {
    attachTo: document.body,
    props: { lots: [lot], pending: false, canDelete: true, ...props },
  })
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 50))
// The row's ⋮, not the column menus (⋯) of the header.
const rowMenu = (wrapper: ReturnType<typeof mountTable>) => wrapper.get('tbody button[aria-haspopup="menu"]')
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const labels = () => menuItems().map((item) => (item.textContent ?? '').trim())

beforeEach(() => {
  isBelowBreakpoint.value = false
  localStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('ProductLotsTable', () => {
  it('shows the lot, its expiry and stock, with the ⋮ named after the lot', () => {
    const wrapper = mountTable()
    expect(wrapper.text()).toContain('LOTE-2026-04')
    expect(wrapper.text()).toContain('31 dic 2026')
    expect(wrapper.text()).not.toContain('2026-12-31')
    const figure = wrapper.get('tbody .hf-figure')
    expect(figure.text()).toBe('12')
    expect(figure.element.closest('td')!.classList).toContain('text-right')
    expect(rowMenu(wrapper).attributes('aria-label')).toBe(
      'Acciones de lote LOTE-2026-04',
    )
    wrapper.unmount()
  })

  it('reads a full server timestamp as the same short date', () => {
    const wrapper = mountTable({ lots: [{ ...lot, expirationDate: '2026-12-31T00:00:00.000Z' }] })
    expect(wrapper.text()).toContain('31 dic 2026')
    wrapper.unmount()
  })

  it('says the lots did not load, with a retry, instead of an empty list', async () => {
    const wrapper = mountTable({ lots: [], error: true })
    const state = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(state.text()).toContain('No se pudieron cargar los lotes')
    expect(wrapper.text()).not.toContain('Sin lotes registrados')
    await state.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    wrapper.unmount()
  })

  it('reads "Sin fecha" when the lot does not expire', () => {
    const wrapper = mountTable({ lots: [{ ...lot, expirationDate: null }] })
    expect(wrapper.text()).toContain('Sin fecha')
    wrapper.unmount()
  })

  it('offers edit and a last, confirmed delete for a saved lot', async () => {
    const wrapper = mountTable()
    await rowMenu(wrapper).trigger('click')
    await tick()
    expect(labels()).toEqual(['Editar', 'Eliminar…'])
    menuItems().find((item) => item.textContent?.trim() === 'Eliminar…')!.click()
    await tick()
    expect(wrapper.emitted('delete')).toEqual([[lot]])
    wrapper.unmount()
  })

  it('offers only delete for a pending lot', async () => {
    const wrapper = mountTable({ pending: true })
    await rowMenu(wrapper).trigger('click')
    await tick()
    expect(labels()).toEqual(['Eliminar…'])
    wrapper.unmount()
  })

  it('names the empty states and shows the table skeleton while the lots load', () => {
    const empty = mountTable({ lots: [] })
    expect(empty.get('.hf-empty-state[data-kind="empty"]').text()).toContain('Sin lotes registrados')
    empty.unmount()
    const pending = mountTable({ lots: [], pending: true })
    const pendingState = pending.get('.hf-empty-state[data-kind="empty"]')
    expect(pendingState.text()).toContain('Sin lotes agregados')
    expect(pendingState.text()).toContain('Usa «Agregar lote»')
    pending.unmount()
    const loading = mountTable({ lots: [], loading: true })
    expect(loading.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(loading.find('.hf-empty-state').exists()).toBe(false)
    loading.unmount()
  })

  it('keeps the loaded lots in view while they refresh', () => {
    const wrapper = mountTable({ loading: true })
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
    expect(wrapper.get('tbody').text()).toContain('LOTE-2026-04')
    wrapper.unmount()
  })

  it('shows one card per lot on phones, with its expiry, stock and ⋮', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountTable()
    expect(wrapper.find('table').exists()).toBe(false)
    const card = wrapper.get('[data-testid="product-lot-card"]')
    expect(card.text()).toContain('LOTE-2026-04')
    expect(card.text()).toContain('31 dic 2026')
    expect(card.get('.hf-figure').text()).toBe('12')
    expect(card.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe('Acciones de lote LOTE-2026-04')
    wrapper.unmount()
  })
})

describe('ProductLotsTable — column layout (premium tables T9)', () => {
  const STORAGE_KEY = 'table-preferences-pos-product-lots'

  it('persists order, pins, widths, visibility and density under one key for every product', async () => {
    const wrapper = mountTable()
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('persistLayout')).toBe(true)

    table.vm.$emit('update:columnOrder', ['expirationDate', 'lotNumber', 'quantity', 'actions'])
    table.vm.$emit('update:columnPinning', { left: ['lotNumber'], right: ['actions'] })
    table.vm.$emit('update:columnSizing', { expirationDate: 180 })
    table.vm.$emit('update:columnVisibility', { expirationDate: false })
    table.vm.$emit('update:density', 'compact')
    await nextTick()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      order: ['expirationDate', 'lotNumber', 'quantity', 'actions'],
      pinning: { left: ['lotNumber'], right: ['actions'] },
      sizing: { expirationDate: 180 },
      visibility: { expirationDate: false },
      density: 'compact',
    })

    // Another product's lots (or a reload) read the same layout.
    wrapper.unmount()
    const other = mountTable({ pending: true }).getComponent({ name: 'AppDataTable' })
    expect(other.props('columnSizing')).toEqual({ expirationDate: 180 })
    other.vm.$emit('reset-columns')
    await nextTick()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(other.props('columnSizing')).toEqual({})
  })

  it('names every column for the column menus, never with its id', () => {
    const table = mountTable().getComponent({ name: 'AppDataTable' })
    const labels = (table.props('columns') as Parameters<typeof columnLabel>[0][]).map(columnLabel)
    expect(labels).toEqual(['Lote', 'Caducidad', 'Existencias', 'Acciones'])
  })
})
