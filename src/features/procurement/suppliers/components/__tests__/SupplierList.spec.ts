import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { isInteractiveTarget } from '@/core/shared/composables/useClickableRow'
const holder = vi.hoisted(() => ({ mobile: false }))
vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'AppDataTable', props: ['data', 'columns', 'loading', 'mobileRender', 'displayMode', 'totalCount', 'rowOpen'], setup(props, { slots }) {
    const cells = (row: Record<string, unknown>) => props.columns.map((column: { id?: string; accessorKey?: string }) => {
      const name = column.id ?? column.accessorKey
      return h('td', { 'data-column': name }, slots[`${name}-cell`]?.({ row: { original: row } }))
    })
    return () => {
      if (props.loading) return h('div', 'Cargando proveedores')
      if (holder.mobile) return h('div', props.data.map((row: Record<string, unknown>) => slots['mobile-card']?.({ row })))
      return h('table', [
        h('thead', [h('tr', props.columns.map((column: { id?: string; accessorKey?: string }) => h('th', { 'data-column': column.id ?? column.accessorKey }, slots[`${column.id ?? column.accessorKey}-header`]?.() ?? '')))]),
        // The real AppDataTable owns the click contract (its own spec covers it); the stub honors `rowOpen` the same way.
        h('tbody', props.data.map((row: Record<string, unknown>) => h('tr', { class: props.rowOpen ? 'hf-clickable-row' : undefined, onClick: (event: MouseEvent) => { if (props.rowOpen && !isInteractiveTarget(event.target, event.currentTarget as Element)) props.rowOpen(row) } }, cells(row)))),
      ])
    }
  } }) }
})
import SupplierList from '../SupplierList.vue'
const supplier = { id: 'one', displayName: 'Proveedor Centro', termsText: null, status: 'ACTIVE' as const, version: 1, createdAt: '', updatedAt: '2020-03-03T20:43:00Z' }
const tick = () => new Promise(resolve => setTimeout(resolve, 50))
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const labels = () => menuItems().map(item => (item.textContent ?? '').trim())
function mountList(props: Record<string, unknown> = {}) {
  return mount(SupplierList, { attachTo: document.body, props: { items: [supplier], canEdit: false, ...props } })
}
async function openMenu(wrapper: ReturnType<typeof mountList>) {
  await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
  await tick()
}
afterEach(() => {
  holder.mobile = false
  document.body.innerHTML = ''
})
describe('supplier list', () => {
  it('uses the canonical responsive table without fabricated totals or sorting', () => {
    const wrapper = mountList()
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('mobileRender')).toBe('cards')
    expect(table.props('displayMode')).toBe('auto')
    expect(table.props('totalCount')).toBeUndefined()
    expect(table.props('columns').every((column: { enableSorting: boolean }) => column.enableSorting === false)).toBe(true)
    wrapper.unmount()
  })
  it('folds the terms into the name cell and keeps a quiet date column instead of a Condiciones column', () => {
    const wrapper = mountList({ canEdit: true })
    const columns = wrapper.getComponent({ name: 'AppDataTable' }).props('columns') as Array<{ id?: string; accessorKey?: string; header: string }>
    expect(columns.map(column => column.header)).toEqual(['Proveedor', 'Estado', 'Actualizado', 'Acciones'])
    expect(wrapper.text()).not.toContain('Condiciones')
    expect(wrapper.text()).not.toContain('Sin condiciones registradas')
    wrapper.unmount()
  })
  it('shows the name as primary with the first line of the terms as the only secondary line, never an id', () => {
    const wrapper = mountList({ items: [{ ...supplier, termsText: '\n  Crédito a 30 días  \nEntrega los martes' }] })
    expect(wrapper.get('.hf-row-primary').text()).toBe('Proveedor Centro')
    expect(wrapper.findAll('.hf-row-secondary')).toHaveLength(1)
    expect(wrapper.get('.hf-row-secondary').text()).toBe('Crédito a 30 días')
    expect(wrapper.text()).not.toContain('one')
    wrapper.unmount()
  })
  it('draws no secondary line when the supplier has no terms', () => {
    const wrapper = mountList()
    expect(wrapper.find('.hf-row-secondary').exists()).toBe(false)
    wrapper.unmount()
  })
  it.each([
    ['ACTIVE', 'Activo', 'success'],
    ['ARCHIVED', 'Archivado', 'neutral'],
  ] as const)('renders %s with the shared status badge', (status, label, tone) => {
    const wrapper = mountList({ items: [{ ...supplier, status }] })
    const badge = wrapper.get('.hf-status-badge')
    expect(badge.text()).toBe(label)
    expect(badge.attributes('data-tone')).toBe(tone)
    expect(badge.attributes('aria-label')).toBe(`Estado: ${label}`)
    wrapper.unmount()
  })
  it('shows the update date in the short format', () => {
    const wrapper = mountList()
    expect(wrapper.get('td[data-column="updatedAt"]').text()).toBe(formatShortDateTime(supplier.updatedAt))
    wrapper.unmount()
  })
  it('exposes details with a native button but no mutation menu to read-only users', async () => {
    const wrapper = mountList()
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
    expect(wrapper.find('td[data-column="actions"]').exists()).toBe(false)
    await wrapper.get('[data-testid="supplier-detail"]').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.emitted('open')![0]![0]).toEqual(supplier)
    wrapper.unmount()
  })
  it('hands the whole-row click to the shared table instead of delegating it', () => {
    const wrapper = mountList()
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    wrapper.unmount()
  })
  it('opens the supplier from the whole row, once, but not from the menu or the name button twice', async () => {
    const wrapper = mountList({ canEdit: true, canDelete: true })
    await wrapper.get('td[data-column="updatedAt"]').trigger('click')
    await wrapper.get('td[data-column="status"]').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(2)
    expect(wrapper.emitted('open')![0]![0]).toEqual(supplier)
    await wrapper.get('[data-testid="supplier-detail"]').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(3)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    await tick()
    expect(wrapper.emitted('open')).toHaveLength(3)
    wrapper.unmount()
  })
  it('does not open from the header row, and passes the name button as the focus invoker', async () => {
    const wrapper = mountList()
    await wrapper.get('th[data-column="displayName"]').trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
    await wrapper.get('td[data-column="status"]').trigger('click')
    expect(wrapper.emitted('open')![0]![1]).toBe(wrapper.get('[data-testid="supplier-detail"]').element)
    wrapper.unmount()
  })
  it('keeps the name button as the only tab stop of the row', () => {
    const wrapper = mountList({ canEdit: true })
    expect(wrapper.find('tr[tabindex]').exists()).toBe(false)
    wrapper.unmount()
  })
  it.each([
    [{ canEdit: true, canDelete: true, status: 'ACTIVE' }, ['Editar', 'Archivar', 'Eliminar']],
    [{ canEdit: true, canDelete: true, status: 'ARCHIVED' }, ['Editar', 'Reactivar', 'Eliminar']],
    [{ canEdit: true, canDelete: false, status: 'ACTIVE' }, ['Editar', 'Archivar']],
    [{ canEdit: false, canDelete: true, status: 'ARCHIVED' }, ['Eliminar']],
  ])('lists only the actions allowed by status and permission: %j', async ({ status, ...permissions }, expected) => {
    const wrapper = mountList({ ...permissions, items: [{ ...supplier, status }] })
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe('Acciones de Proveedor Centro')
    await openMenu(wrapper)
    expect(labels()).toEqual(expected)
    wrapper.unmount()
  })
  it('keeps the actions column to the menu alone, with the destructive item last behind a separator', async () => {
    const wrapper = mountList({ canEdit: true, canDelete: true })
    const cell = wrapper.get('td[data-column="actions"]')
    expect(cell.findAll('button')).toHaveLength(1)
    expect(wrapper.find('[data-testid="supplier-status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="supplier-delete"]').exists()).toBe(false)
    await openMenu(wrapper)
    expect(document.querySelector('[role="separator"]')).not.toBeNull()
    expect(menuItems()[menuItems().length - 1]!.className).toContain('hf-row-action-danger')
    wrapper.unmount()
  })
  it('hides the accessible-only Acciones heading from sight', () => {
    const wrapper = mountList({ canEdit: true })
    expect(wrapper.get('th[data-column="actions"] .sr-only').text()).toBe('Acciones')
    wrapper.unmount()
  })
  it.each([
    ['Editar', 'open'],
    ['Archivar', 'changeStatus'],
    ['Eliminar', 'delete'],
  ])('%s emits %s with the supplier and the expanded menu trigger as the focus invoker', async (label, event) => {
    const wrapper = mountList({ canEdit: true, canDelete: true })
    await openMenu(wrapper)
    menuItems().find(item => item.textContent?.trim() === label)!.click()
    await tick()
    expect(wrapper.emitted(event)).toHaveLength(1)
    expect(wrapper.emitted(event)![0]![0]).toEqual(supplier)
    expect(wrapper.emitted(event)![0]![1]).toBe(wrapper.get('button[aria-haspopup="menu"]').element)
    wrapper.unmount()
  })
  it('does not present an empty result during loading', () => {
    const wrapper = mountList({ items: [], loading: true })
    expect(wrapper.text()).toContain('Cargando proveedores')
    expect(wrapper.text()).not.toContain('No hay proveedores')
    wrapper.unmount()
  })
  describe('mobile cards', () => {
    it('shows name, secondary line, badge, short date and a ⋮ instead of loose buttons', () => {
      holder.mobile = true
      const wrapper = mountList({ canEdit: true, canDelete: true, items: [{ ...supplier, termsText: 'Crédito a 30 días' }] })
      const card = wrapper.get('article')
      expect(card.get('.hf-row-primary').text()).toBe('Proveedor Centro')
      expect(card.get('.hf-row-secondary').text()).toBe('Crédito a 30 días')
      expect(card.get('.hf-status-badge').text()).toBe('Activo')
      expect(card.text()).toContain(formatShortDateTime(supplier.updatedAt))
      expect(card.findAll('button')).toHaveLength(2)
      expect(card.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe('Acciones de Proveedor Centro')
      wrapper.unmount()
    })
    it('opens from the whole card but not from the menu, and offers the same actions', async () => {
      holder.mobile = true
      const wrapper = mountList({ canEdit: true, canDelete: true })
      await wrapper.get('article').trigger('click')
      expect(wrapper.emitted('open')).toHaveLength(1)
      await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
      await tick()
      expect(wrapper.emitted('open')).toHaveLength(1)
      expect(labels()).toEqual(['Editar', 'Archivar', 'Eliminar'])
      menuItems().find(item => item.textContent?.trim() === 'Archivar')!.click()
      await tick()
      expect(wrapper.emitted('changeStatus')![0]![0]).toEqual(supplier)
      wrapper.unmount()
    })
  })
})
