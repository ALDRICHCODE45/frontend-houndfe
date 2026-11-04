import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import PurchaseOrderList from '../PurchaseOrderList.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import { isInteractiveTarget } from '@/core/shared/composables/useClickableRow'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { PurchaseOrderSummary } from '../../interfaces/purchase-order.types'
const row: PurchaseOrderSummary = { id: 'o', version: 1, status: 'DRAFT', supplierDisplaySnapshot: { id: 's', displayName: 'Proveedor', status: 'ACTIVE' }, lineCount: 2, issueCount: 0, note: 'Nota', locationDetail: null, totals: null, createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:20:00Z' }
// A real <table>; both layouts render so cells and cards can be read together. The real AppDataTable owns the row-click contract (its own spec covers it); the stub honors `rowOpen` the same way.
const table = defineComponent({
  props: ['data', 'columns', 'rowOpen'],
  methods: {
    clickRow(event: MouseEvent, row: unknown) { if (this.rowOpen && !isInteractiveTarget(event.target, event.currentTarget as Element)) this.rowOpen(row) },
  },
  template: `<div>
    <table><tbody><tr v-for="row in data" :key="row.id" data-slot="tr" :class="{ 'hf-clickable-row': rowOpen }" @click="clickRow($event, row)">
      <td data-cell="supplier"><slot name="supplier-cell" :row="{ original: row }"/></td>
      <td data-cell="status"><slot name="status-cell" :row="{ original: row }"/></td>
      <td data-cell="total"><slot name="total-cell" :row="{ original: row }"/></td>
      <td data-cell="updatedAt"><slot name="updatedAt-cell" :row="{ original: row }"/></td>
      <td data-cell="actions"><slot name="actions-cell" :row="{ original: row }"/></td>
    </tr></tbody></table>
    <div class="cards"><slot name="mobile-card" v-for="row in data" :row="row"/></div>
  </div>`,
})
const toolbar = defineComponent({ props: ['globalFilter', 'searchPlaceholder', 'showRefresh', 'activeFilterCount'], emits: ['refresh', 'clear-filters'], template: '<div><slot name="actions"/><slot name="filters"/></div>' })
const stubs = { AppDataTable: table, DataTableToolbar: toolbar }
const permissions = { canEdit: true, canDelete: true, canConfirm: true, canCancel: true }
const mountList = (items: PurchaseOrderSummary[], props: Record<string, unknown> = {}) => mount(PurchaseOrderList, { props: { items, ...permissions, ...props }, global: { stubs } })
const cell = (wrapper: ReturnType<typeof mountList>, name: string, index = 0) => wrapper.findAll(`td[data-cell="${name}"]`)[index]!

describe('list columns and toolbar', () => {
  it('declares Proveedor, Estado, Renglones, Total, Actualizada and a last Acciones column, with no Avisos or Nota columns', () => {
    const wrapper = mountList([row])
    const columns = wrapper.getComponent(table).props('columns') as Array<{ id?: string; accessorKey?: string; header: string }>
    expect(columns.map(column => column.header)).toEqual(['Proveedor', 'Estado', 'Renglones', 'Total', 'Actualizada', 'Acciones'])
    expect(columns[columns.length - 1]!.id).toBe('actions')
  })
  it('does not expose an empty filters slot to the shared toolbar', () => {
    expect(mountList([]).getComponent(toolbar).vm.$slots.filters).toBeUndefined()
  })
  it('emits search to the server owner without filtering the current page locally', async () => {
    const wrapper = mountList([row])
    expect(wrapper.getComponent(toolbar).props('searchPlaceholder')).toBe('Buscar por proveedor o nota...')
    wrapper.getComponent(toolbar).vm.$emit('update:globalFilter', 'inexistente')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:search')?.[0]).toEqual(['inexistente'])
    expect(wrapper.text()).toContain('Proveedor')
  })
  it('forwards the active filter count to the shared toolbar and relays clear-filters', () => {
    const wrapper = mountList([], { activeFilterCount: 1 })
    expect(wrapper.getComponent(toolbar).props('activeFilterCount')).toBe(1)
    wrapper.getComponent(toolbar).vm.$emit('clear-filters')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
  })
  it('drops the refresh button from the toolbar, as the pattern catalog says', () => {
    expect(mountList([]).getComponent(toolbar).props('showRefresh')).toBeFalsy()
  })
})

describe('proveedor cell', () => {
  it('holds the name in the row primary button and the note as the secondary line', () => {
    const wrapper = mountList([row])
    const primary = cell(wrapper, 'supplier').get('button.hf-row-primary')
    expect(primary.text()).toBe('Proveedor')
    expect(cell(wrapper, 'supplier').get('.hf-row-secondary').text()).toBe('Nota')
  })
  it('has no secondary line without a note, and falls back to Sin proveedor', () => {
    const wrapper = mountList([{ ...row, note: null, supplierDisplaySnapshot: null }])
    expect(cell(wrapper, 'supplier').find('.hf-row-secondary').exists()).toBe(false)
    expect(cell(wrapper, 'supplier').get('.hf-row-primary').text()).toBe('Sin proveedor')
  })
  it('flags an archived supplier next to the name', () => {
    const wrapper = mountList([{ ...row, supplierDisplaySnapshot: { id: 's', displayName: 'Proveedor', status: 'ARCHIVED' } }])
    expect(cell(wrapper, 'supplier').text()).toContain('Archivado')
  })
})

describe('estado cell', () => {
  it.each([['DRAFT', 'Borrador', 'warning'], ['CONFIRMED', 'Confirmada', 'success'], ['CANCELLED', 'Cancelada', 'neutral']] as const)('shows a %s order as a %s status badge with the %s tone, in cells and cards', (status, label, tone) => {
    const wrapper = mountList([{ ...row, status }])
    const badges = wrapper.findAll('[data-testid="order-status"]')
    expect(badges.map(badge => badge.text())).toEqual([label, label])
    for (const badge of badges) {
      expect(badge.classes()).toContain('hf-status-badge')
      expect(badge.attributes('data-tone')).toBe(tone)
    }
  })
  it('adds an aviso marker beside the badge only when the draft has avisos', () => {
    const wrapper = mountList([{ ...row, issueCount: 1 }, { ...row, id: 'p', issueCount: 3 }, { ...row, id: 'q', issueCount: 0 }])
    expect(cell(wrapper, 'status', 0).get('[data-testid="order-aviso"]').text()).toBe('1 aviso')
    expect(cell(wrapper, 'status', 1).get('[data-testid="order-aviso"]').text()).toBe('3 avisos')
    expect(cell(wrapper, 'status', 2).find('[data-testid="order-aviso"]').exists()).toBe(false)
  })
})

describe('total cell', () => {
  const total = (wrapper: ReturnType<typeof mountList>) => cell(wrapper, 'total').get('[data-testid="order-total"]')
  it('right-aligns tabular figures and reads a dash when the server sent no total', () => {
    const wrapper = mountList([row])
    expect(total(wrapper).text()).toBe('—')
    expect(total(wrapper).classes()).toContain('hf-figure')
  })
  it('shows one total as a single amount without a basis label', () => {
    const wrapper = mountList([{ ...row, totals: [{ amount: '1540.00', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }] }])
    expect(total(wrapper).text()).toBe('$1,540.00')
    expect(total(wrapper).findAll('.order-total-entry')).toHaveLength(1)
    expect(total(wrapper).find('.order-total-basis').exists()).toBe(false)
  })
  it('shows two decimals and the exact server amount in the title only where it was rounded', () => {
    const wrapper = mountList([{ ...row, totals: [{ amount: '128.125', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }] }])
    expect(total(wrapper).text()).toBe('$128.13')
    expect(total(wrapper).get('.order-total-entry').attributes('title')).toBe('$128.125')
    const exact = mountList([{ ...row, totals: [{ amount: '1540.00', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }] }])
    expect(total(exact).get('.order-total-entry').attributes('title')).toBeUndefined()
  })
  it('stacks two totals, each with its small basis label, never summed', () => {
    const wrapper = mountList([{ ...row, totals: [{ amount: '1000.50', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }, { amount: '580.00', currency: 'MXN', taxBasis: 'INCLUDES_TAX' }] }])
    const entries = total(wrapper).findAll('.order-total-entry')
    expect(entries.map(entry => entry.text())).toEqual(['$1,000.50 sin imp.', '$580.00 con imp.'])
    expect(total(wrapper).text()).not.toContain('1,580.50')
  })
})

describe('actualizada cell', () => {
  it('shows the short date, not the full locale string', () => {
    const wrapper = mountList([row])
    expect(cell(wrapper, 'updatedAt').text()).toBe(formatShortDateTime(row.updatedAt))
    expect(cell(wrapper, 'updatedAt').text()).not.toMatch(/a\. m\.|p\. m\.|\//)
  })
})

describe('acciones column', () => {
  it('holds only the ⋮ menu: a single button named after the order, never loose action buttons', () => {
    const wrapper = mountList([row])
    const buttons = cell(wrapper, 'actions').findAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.attributes('aria-label')).toBe('Acciones de la orden de Proveedor, borrador')
    expect(buttons[0]!.text()).toBe('')
    expect(wrapper.find('[data-testid="discard-order"]').exists()).toBe(false)
  })
  it('keeps the actions column even for a reader with no permissions, since anyone can open an order', () => {
    const wrapper = mountList([row], { canEdit: false, canDelete: false, canConfirm: false, canCancel: false })
    expect(cell(wrapper, 'actions').findAll('button')).toHaveLength(1)
    expect(wrapper.findAllComponents(RowActionsMenu)[0]!.props('actions').map((action: { label: string }) => action.label)).toEqual(['Ver orden'])
  })
  it('lists the menu items for a draft by permission, with the destructive one last', () => {
    const menu = mountList([row]).findAllComponents(RowActionsMenu)[0]!
    expect((menu.props('actions') as Array<{ label: string }>).map(action => action.label)).toEqual(['Continuar', 'Confirmar…', 'Cancelar…', 'Descartar borrador'])
    expect(menu.props('portalClass')).toContain('purchase-orders-portal')
  })
  it('lists Ver orden and Cancelar… for confirmed orders and Ver orden for cancelled ones', () => {
    const menus = mountList([{ ...row, status: 'CONFIRMED' }, { ...row, id: 'p', status: 'CANCELLED' }]).findAllComponents(RowActionsMenu)
    expect((menus[0]!.props('actions') as Array<{ label: string }>).map(action => action.label)).toEqual(['Ver orden', 'Cancelar…'])
    expect((menus[1]!.props('actions') as Array<{ label: string }>).map(action => action.label)).toEqual(['Ver orden'])
  })
  it.each([['open', 'open'], ['confirm', 'confirm'], ['cancel', 'cancel']] as const)('relays the %s item with the order and the row button that invokes it', (key, event) => {
    const wrapper = mountList([row], { attachTo: document.body })
    wrapper.findAllComponents(RowActionsMenu)[0]!.vm.$emit('select', key)
    const [order, origin] = wrapper.emitted(event)![0]!
    expect(order).toEqual(row)
    expect(wrapper.findAll('button.hf-row-primary').map(button => button.element)).toContain(origin)
  })
  it('relays Descartar borrador with the order', () => {
    const wrapper = mountList([row])
    wrapper.findAllComponents(RowActionsMenu)[0]!.vm.$emit('select', 'discard')
    expect(wrapper.emitted('discard')?.[0]).toEqual([row])
  })
  it('disables every item while the workspace is busy', () => {
    const menu = mountList([row], { disabled: true }).findAllComponents(RowActionsMenu)[0]!
    expect((menu.props('actions') as Array<{ disabled?: boolean }>).every(action => action.disabled)).toBe(true)
  })
})

describe('clickable rows', () => {
  it('hands the whole-row click to the shared table instead of delegating it', () => {
    const wrapper = mountList([row])
    expect(typeof wrapper.getComponent(table).props('rowOpen')).toBe('function')
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
  })
  it('opens the order when the whole row is clicked', async () => {
    const wrapper = mountList([row])
    await wrapper.get('tbody tr').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.emitted('open')![0]![0]).toEqual(row)
  })
  it('opens the right order when the row is not the first', async () => {
    const second = { ...row, id: 'p' }
    const wrapper = mountList([row, second])
    await wrapper.findAll('tbody tr')[1]!.trigger('click')
    expect(wrapper.emitted('open')![0]![0]).toEqual(second)
  })
  it('opens once from the primary button and never from the ⋮ menu', async () => {
    const wrapper = mountList([row])
    await cell(wrapper, 'supplier').get('button.hf-row-primary').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    await cell(wrapper, 'actions').get('button').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })
  it('makes the card clickable too, with the primary button as its only tab stop', async () => {
    const wrapper = mountList([row])
    const card = wrapper.get('article.order-card')
    expect(card.classes()).toContain('hf-clickable-row')
    expect(card.attributes('tabindex')).toBeUndefined()
    await card.trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    await card.get('.hf-row-actions-trigger').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })
})

describe('mobile card', () => {
  it('shows name, ⋮, note, badge, aviso and a footer with the line count, total and short date', () => {
    const wrapper = mountList([{ ...row, issueCount: 1, lineCount: 3, totals: [{ amount: '12946.00', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }] }])
    const card = wrapper.get('article.order-card')
    expect(card.get('button.hf-row-primary').text()).toBe('Proveedor')
    expect(card.get('.hf-row-actions-trigger').attributes('aria-label')).toBe('Acciones de la orden de Proveedor, borrador')
    expect(card.get('.hf-row-secondary').text()).toBe('Nota')
    expect(card.get('[data-testid="order-status"]').text()).toBe('Borrador')
    expect(card.get('[data-testid="order-aviso"]').text()).toBe('1 aviso')
    expect(card.get('.order-card-footer').text()).toContain('3 renglones')
    expect(card.get('.order-card-footer').text()).toContain('$12,946.00')
    expect(card.get('.order-card-footer').text()).toContain(formatShortDateTime(row.updatedAt))
  })
  it('uses the singular for one line and a dash without a total', () => {
    const card = mountList([{ ...row, lineCount: 1 }]).get('article.order-card')
    expect(card.get('.order-card-footer').text()).toContain('1 renglón')
    expect(card.get('.order-card-footer').text()).not.toContain('1 renglones')
    expect(card.get('[data-testid="order-total"]').text()).toBe('—')
  })
})

describe('compact desktop rows', () => {
  const sfc = readFileSync('src/features/procurement/purchase-orders/components/PurchaseOrderList.vue', 'utf8')
  it('uses a 64px cell with tight vertical padding, so a two-line cell is about 64px and not the 44px button plus 32px of padding', () => {
    expect(sfc).toMatch(/td\[data-slot='td'\]\) \{[^}]*height: 64px/)
    expect(sfc).toMatch(/td\[data-slot='td'\]\) \{[^}]*padding-block: 10px/)
  })
  it('does not give the primary button its own box (no min-height or padding): the shared class owns that', () => {
    expect(sfc).not.toMatch(/\.order-row-link \{[^}]*min-height: var/)
    expect(sfc).toMatch(/\.order-row-link \{[^}]*padding: 0/)
  })
})
