import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import PurchaseOrderList from '../PurchaseOrderList.vue'
const row = { id: 'o', version: 1, status: 'DRAFT' as const, supplierDisplaySnapshot: { id: 's', displayName: 'Proveedor', status: 'ARCHIVED' as const }, lineCount: 2, issueCount: 3, note: 'Nota', locationDetail: null, createdAt: '', updatedAt: '2026-01-01' }
const table = defineComponent({ props: ['data', 'columns'], template: '<div><slot name="mobile-card" v-for="row in data" :row="row"/><slot name="status-cell" v-for="row in data" :row="{ original: row }"/><slot name="actions-cell" v-for="row in data" :row="{ original: row }"/></div>' })
const toolbar = defineComponent({ props: ['globalFilter', 'searchPlaceholder', 'showRefresh'], emits: ['refresh'], template: '<div><slot name="actions"/><slot name="filters"/></div>' })
const stubs = { AppDataTable: table, DataTableToolbar: toolbar, UIcon: true }
describe('draft list canonical mobile cards', () => {
  it('shows summary only and discard independently of update', async () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [row], canEdit: false, canDelete: true }, global: { stubs } })
    expect(wrapper.text()).toContain('Archivado')
    expect(wrapper.text()).toContain('Avisos')
    expect(wrapper.text()).not.toContain('Continuar')
    await wrapper.get('[data-testid="discard-order"]').trigger('click')
    expect(wrapper.emitted('discard')?.[0]).toEqual([row])
    expect(wrapper.text()).not.toContain('Total')
  })
  it('does not expose an empty filters slot to the shared toolbar', () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [], canEdit: false, canDelete: false }, global: { stubs } })
    expect(wrapper.getComponent(toolbar).vm.$slots.filters).toBeUndefined()
  })
  it('emits search to the server owner without filtering the current page locally', async () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [row], canEdit: false, canDelete: false }, global: { stubs } })
    expect(wrapper.getComponent(toolbar).props('searchPlaceholder')).toBe('Buscar por proveedor o nota...')
    wrapper.getComponent(toolbar).vm.$emit('update:globalFilter', 'inexistente')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:search')?.[0]).toEqual(['inexistente'])
    expect(wrapper.text()).toContain('Proveedor')
  })
  it('always keeps the actions column, because any reader can open an order', async () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [row], canEdit: false, canDelete: false }, global: { stubs } })
    const ids = wrapper.getComponent(table).props('columns').map((column: { id?: string; accessorKey?: string }) => column.id ?? column.accessorKey)
    expect(ids).toContain('actions')
    expect(ids).toContain('status')
  })
  it('keeps the shared refresh control like every system table', async () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [], canEdit: false, canDelete: false }, global: { stubs } })
    expect(wrapper.getComponent(toolbar).props('showRefresh')).toBe(true)
    wrapper.getComponent(toolbar).vm.$emit('refresh')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
  it('shows missing supplier and continue, without destructive permission', () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [{ ...row, supplierDisplaySnapshot: null }], canEdit: true, canDelete: false }, global: { stubs } })
    expect(wrapper.text()).toContain('Sin proveedor')
    expect(wrapper.text()).toContain('Continuar')
    expect(wrapper.find('[data-testid="discard-order"]').exists()).toBe(false)
  })
  it.each([['DRAFT', 'Borrador'], ['CONFIRMED', 'Confirmada'], ['CANCELLED', 'Cancelada']] as const)('labels a %s order with its status badge on cards and table cells', (status, label) => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [{ ...row, status }], canEdit: true, canDelete: true }, global: { stubs } })
    expect(wrapper.findAll('[data-testid="order-status"]').map(badge => badge.text())).toEqual([label, label])
  })
  it('offers continue and discard only on drafts and a read-only view on closed orders', async () => {
    const closed = { ...row, status: 'CONFIRMED' as const }
    const wrapper = mount(PurchaseOrderList, { props: { items: [closed], canEdit: true, canDelete: true }, global: { stubs } })
    expect(wrapper.text()).not.toContain('Continuar')
    expect(wrapper.find('[data-testid="discard-order"]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === 'Ver orden')!.trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual([closed])
  })
  it('opens a draft read-only when the reader cannot edit', async () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [row], canEdit: false, canDelete: false }, global: { stubs } })
    expect(wrapper.text()).not.toContain('Continuar')
    await wrapper.findAll('button').find(button => button.text() === 'Ver orden')!.trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual([row])
  })
})
