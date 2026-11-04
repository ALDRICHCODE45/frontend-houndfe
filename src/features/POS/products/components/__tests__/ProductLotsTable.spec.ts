/**
 * ProductLotsTable — lot, expiry, stock and the ⋮ menu, for pending and saved lots.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductLotsTable, { type ProductLotRow } from '../ProductLotsTable.vue'

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
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const labels = () => menuItems().map((item) => (item.textContent ?? '').trim())

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductLotsTable', () => {
  it('shows the lot, its expiry and stock, with the ⋮ named after the lot', () => {
    const wrapper = mountTable()
    expect(wrapper.text()).toContain('LOTE-2026-04')
    expect(wrapper.text()).toContain('2026-12-31')
    expect(wrapper.get('td.hf-figure').text()).toBe('12')
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe(
      'Acciones de lote LOTE-2026-04',
    )
    wrapper.unmount()
  })

  it('reads "Sin fecha" when the lot does not expire', () => {
    const wrapper = mountTable({ lots: [{ ...lot, expirationDate: null }] })
    expect(wrapper.text()).toContain('Sin fecha')
    wrapper.unmount()
  })

  it('offers edit and a last, confirmed delete for a saved lot', async () => {
    const wrapper = mountTable()
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    await tick()
    expect(labels()).toEqual(['Editar', 'Eliminar…'])
    menuItems().find((item) => item.textContent?.trim() === 'Eliminar…')!.click()
    await tick()
    expect(wrapper.emitted('delete')).toEqual([[lot]])
    wrapper.unmount()
  })

  it('offers only delete for a pending lot', async () => {
    const wrapper = mountTable({ pending: true })
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    await tick()
    expect(labels()).toEqual(['Eliminar…'])
    wrapper.unmount()
  })

  it('names the empty and loading states', () => {
    const empty = mountTable({ lots: [] })
    expect(empty.text()).toContain('Sin lotes registrados.')
    empty.unmount()
    const pending = mountTable({ lots: [], pending: true })
    expect(pending.text()).toContain('Sin lotes agregados.')
    pending.unmount()
    const loading = mountTable({ lots: [], loading: true })
    expect(loading.text()).toContain('Actualizando lotes...')
    loading.unmount()
  })
})
