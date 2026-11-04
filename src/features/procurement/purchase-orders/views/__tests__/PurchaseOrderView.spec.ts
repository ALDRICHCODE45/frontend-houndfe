import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { readFileSync } from 'node:fs'
import PurchaseOrderView from '../PurchaseOrderView.vue'
import type { PurchaseOrder } from '../../interfaces/purchase-order.types'
const grants = new Set<string>()
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => ({ user: { id: 'u' }, currentTenantId: 't', authPhase: 'authenticated', permissionsLoaded: true, userCan: (action: string, subject: string) => grants.has(`${action}:${subject}`) }) }))
const state = vi.hoisted(() => ({ status: { value: undefined as string | undefined } }))
vi.mock('../../composables/usePurchaseOrders', async () => {
  const { shallowRef } = await import('vue')
  state.status = shallowRef<string | undefined>(undefined)
  return { usePurchaseOrders: () => ({ status: state.status, items: shallowRef([]), hasNext: shallowRef(false), hasPrevious: shallowRef(false), next: vi.fn(), back: vi.fn(), refresh: vi.fn(), isLoading: shallowRef(false), isFetching: shallowRef(false), error: shallowRef(null) }) }
})
const workspace = vi.hoisted(() => ({ selected: null as unknown, open: null as unknown, transition: null as unknown, canConfirm: null as unknown, canCancel: null as unknown, needsSave: null as unknown, message: null as unknown, dirty: null as unknown, requestTransition: null as unknown, confirmTransition: null as unknown, retry: null as unknown, uncertain: null as unknown }))
vi.mock('../../composables/usePurchaseOrderWorkspace', async () => {
  const { shallowRef, computed } = await import('vue')
  workspace.selected = shallowRef(null); workspace.open = shallowRef(false); workspace.transition = shallowRef(null); workspace.canConfirm = shallowRef(false); workspace.canCancel = shallowRef(false)
  workspace.needsSave = shallowRef(false); workspace.message = shallowRef(''); workspace.dirty = shallowRef(false); workspace.uncertain = shallowRef(false)
  workspace.requestTransition = vi.fn(); workspace.confirmTransition = vi.fn(); workspace.retry = vi.fn()
  return { usePurchaseOrderWorkspace: () => ({ commands: { isPending: shallowRef(false), hasUncertainResult: workspace.uncertain }, selected: workspace.selected, open: workspace.open, editorOpen: workspace.open, deleteOpen: shallowRef(false), dirty: workspace.dirty, formKey: shallowRef(0), detailLoading: shallowRef(false), detailError: shallowRef(''), deleteTarget: shallowRef(null), notice: shallowRef(''), locked: shallowRef(false), message: workspace.message, conflict: shallowRef(false), deleteRejected: shallowRef(false), canSave: shallowRef(true), transition: workspace.transition, transitionOpen: computed(() => workspace.transition !== null && (workspace.transition as { value: unknown }).value !== null), transitionRejected: shallowRef(false), needsSave: workspace.needsSave, canConfirm: workspace.canConfirm, canCancel: workspace.canCancel, requestTransition: workspace.requestTransition, confirmTransition: workspace.confirmTransition, retry: workspace.retry, create: vi.fn(), close: vi.fn(), restoreInvoker: vi.fn(), canLeave: () => true }) }
})
const set = (name: keyof typeof workspace, value: unknown) => { (workspace[name] as { value: unknown }).value = value }
const order: PurchaseOrder = {
  id: 'order-id-9f2', version: 3, status: 'DRAFT', supplierId: 'supplier-id-77', note: null, location: { detail: null }, lines: [], createdAt: '', updatedAt: '',
  supplierDisplaySnapshot: { id: 'supplier-id-77', displayName: 'Distribuidora del Norte', status: 'ACTIVE' }, lineDisplaySnapshots: [], lineSubtotals: [],
  locationSnapshot: { tenantId: 't', tenantName: 'Sucursal Centro', detail: null }, validation: { issues: [] }, supplierCurrentVersion: 7, referenceToken: 'opaque-token', canConfirm: true,
  confirmedAt: null, confirmedBy: null, cancelledAt: null, cancelledBy: null,
}
const stubs = {
  Card: { template: '<div><slot/></div>' }, Button: { template: '<button><slot/></button>' }, Icon: true,
  Slideover: { props: ['open', 'title', 'description'], template: '<section v-if="open"><h2>{{ title }}</h2><p>{{ description }}</p><slot name="body"/></section>' },
  Modal: { props: ['open', 'title', 'description'], template: '<aside v-if="open"><h2>{{ title }}</h2><p>{{ description }}</p><slot name="body"/><slot name="footer"/></aside>' },
  PurchaseOrderForm: { template: '<form data-testid="draft-form"/>' },
  PurchaseOrderList: { props: ['canEdit', 'canDelete', 'activeFilterCount'], emits: ['clear-filters'], template: '<div><slot name="filters"/><slot name="actions"/><span>{{canEdit}}/{{canDelete}}</span></div>' },
  ToolbarSelectFilter: { props: ['modelValue', 'items', 'label', 'portalClass', 'testId'], emits: ['update:modelValue'], template: '<div :data-testid="testId" :data-value="modelValue" :data-label="label" />' },
}
const mountView = () => mount(PurchaseOrderView, { global: { stubs } })
beforeEach(() => {
  grants.clear(); grants.add('read:ProcurementPurchaseOrder')
  set('selected', null); set('open', false); set('transition', null); set('canConfirm', false); set('canCancel', false); set('needsSave', false); set('message', ''); set('dirty', false); set('uncertain', false)
  state.status.value = undefined
  vi.mocked(workspace.requestTransition as ReturnType<typeof vi.fn>).mockClear(); vi.mocked(workspace.confirmTransition as ReturnType<typeof vi.fn>).mockClear()
})
describe('draft view effective permissions', () => {
  it('allows continuing with read and update even without catalog reads', () => {
    grants.add('update:ProcurementPurchaseOrder')
    const wrapper = mountView()
    expect(wrapper.text()).toContain('true/false')
    expect(wrapper.find('[data-testid="create-order"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('requires create + both reference reads for new orders, deletion does not require update', () => {
    grants.add('delete:ProcurementPurchaseOrder'); grants.add('create:ProcurementPurchaseOrder')
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="create-order"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('false/true')
    wrapper.unmount()
    grants.add('read:Product'); grants.add('read:ProcurementSupplier')
    const allowed = mountView()
    expect(allowed.find('[data-testid="create-order"]').exists()).toBe(true)
    allowed.unmount()
  })
})
describe('order status filter', () => {
  const filter = (wrapper: ReturnType<typeof mountView>) => wrapper.getComponent(stubs.ToolbarSelectFilter)
  it('is the shared toolbar select, defaulting to every order with readable labels', () => {
    const wrapper = mountView()
    const select = filter(wrapper)
    expect(select.attributes('data-testid')).toBe('order-status-filter')
    expect(select.props('label')).toBe('Estado')
    expect(select.props('modelValue')).toBe('ALL')
    expect(select.props('items')).toEqual([{ label: 'Todas', value: 'ALL' }, { label: 'Borradores', value: 'DRAFT' }, { label: 'Confirmadas', value: 'CONFIRMED' }, { label: 'Canceladas', value: 'CANCELLED' }])
    expect(select.props('portalClass')).toContain('purchase-orders-portal')
    expect(wrapper.find('select').exists()).toBe(false)
    wrapper.unmount()
  })
  it('maps the choice to the single status value and Todas back to undefined', async () => {
    const wrapper = mountView()
    filter(wrapper).vm.$emit('update:modelValue', 'CONFIRMED')
    await wrapper.vm.$nextTick()
    expect(state.status.value).toBe('CONFIRMED')
    expect(filter(wrapper).props('modelValue')).toBe('CONFIRMED')
    filter(wrapper).vm.$emit('update:modelValue', 'ALL')
    await wrapper.vm.$nextTick()
    expect(state.status.value).toBeUndefined()
    wrapper.unmount()
  })
  it('ships no feature rule that pushes the filter onto a second toolbar row', () => {
    const css = readFileSync('src/features/procurement/purchase-orders/styles/purchase-orders-visual.css', 'utf8')
    expect(css).not.toMatch(/hf-toolbar-filters/)
    expect(css).not.toMatch(/grid-area/)
  })
  it('counts one active filter away from Todas and clears back to it', async () => {
    const wrapper = mountView()
    const list = () => wrapper.getComponent(stubs.PurchaseOrderList)
    expect(list().props('activeFilterCount')).toBe(0)
    state.status.value = 'DRAFT'
    await wrapper.vm.$nextTick()
    expect(list().props('activeFilterCount')).toBe(1)
    list().vm.$emit('clear-filters')
    await wrapper.vm.$nextTick()
    expect(state.status.value).toBeUndefined()
    expect(list().props('activeFilterCount')).toBe(0)
    wrapper.unmount()
  })
})
describe('order editor by status', () => {
  it('shows a closed order read-only, titled by its status, with no form or id', () => {
    set('selected', { ...order, status: 'CONFIRMED', canConfirm: false, confirmedAt: '2026-11-03T10:00:00Z', confirmedBy: { displayName: 'Ana Pérez' } }); set('open', true)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="draft-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="order-readonly"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Orden confirmada')
    expect(wrapper.text()).toContain('Distribuidora del Norte')
    expect(wrapper.html()).not.toContain('order-id-9f2')
    set('selected', { ...order, status: 'CANCELLED', canConfirm: false })
    return wrapper.vm.$nextTick().then(() => { expect(wrapper.text()).toContain('Orden cancelada'); wrapper.unmount() })
  })
  it('keeps the form for drafts, with the draft title', () => {
    grants.add('update:ProcurementPurchaseOrder')
    set('selected', order); set('open', true)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="draft-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="order-readonly"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Continuar borrador')
    wrapper.unmount()
  })
  it('does not claim a create-only user just saved a draft they only opened', () => {
    grants.add('create:ProcurementPurchaseOrder'); grants.add('read:Product'); grants.add('read:ProcurementSupplier')
    set('selected', order); set('open', true)
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Solo lectura: no tienes permiso para editar este borrador.')
    expect(wrapper.text()).not.toContain('Borrador guardado')
    wrapper.unmount()
  })
  it('titles a draft opened without update permission as read-only, without the catalog-read save hint', () => {
    grants.add('create:ProcurementOrderConfirmation')
    set('selected', order); set('open', true)
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Ver borrador')
    expect(wrapper.text()).toContain('Solo lectura: no tienes permiso para editar este borrador.')
    expect(wrapper.text()).not.toContain('Continuar borrador')
    expect(wrapper.text()).not.toContain('Puedes guardar datos incompletos')
    expect(wrapper.text()).not.toContain('Para guardar cambios necesitas permiso de lectura')
    expect(wrapper.text()).not.toContain('Borrador guardado')
    expect(wrapper.find('[data-testid="draft-form"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('renders a draft opened without update permission as the read-only block with its status, no form and no disabled controls', () => {
    grants.add('create:ProcurementOrderConfirmation')
    set('selected', { ...order, supplierId: null, supplierDisplaySnapshot: null, canConfirm: false, validation: { issues: [{ path: '/supplierId', code: 'SUPPLIER_REQUIRED' }] } }); set('open', true)
    const wrapper = mountView()
    const readonly = wrapper.get('[data-testid="order-readonly"]')
    expect(wrapper.find('[data-testid="draft-form"]').exists()).toBe(false)
    expect(readonly.text()).toContain('Borrador')
    expect(readonly.text()).toContain('Selecciona un proveedor.')
    expect(readonly.findAll('button, input, select, textarea, [disabled]')).toHaveLength(0)
    wrapper.unmount()
  })
  it('keeps the editable form for a draft the user can update', () => {
    grants.add('update:ProcurementPurchaseOrder')
    set('selected', order); set('open', true)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="draft-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="order-readonly"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
const lineOf = (n: number) => ({ lineId: `line-id-${n}`, productId: `product-id-${n}`, variantId: null, orderedQuantity: `${n}`, informedUnitCost: { amount: '10', currency: 'MXN', unit: 'BOLSA', taxBasis: 'INCLUDES_TAX' as const } })
const summarized = { ...order, lines: [1, 2, 3, 4, 5, 6, 7].map(lineOf), lineDisplaySnapshots: [1, 2, 3, 4, 5, 6, 7].map(n => ({ lineId: `line-id-${n}`, productName: `Producto ${n}`, variantName: null, unit: 'BOLSA' })) }
describe('transition dialogs show an order summary', () => {
  it.each([['confirm', 'DRAFT'], ['cancel', 'CONFIRMED']] as const)('%s lists supplier, location, line count and the first five lines without totals', (kind, status) => {
    grants.add('create:ProcurementOrderConfirmation'); grants.add('create:ProcurementOrderCancellation')
    set('selected', { ...summarized, status }); set('open', true); set('transition', kind)
    const wrapper = mountView()
    const modal = wrapper.get('aside')
    const summary = modal.get('[data-testid="order-summary"]')
    for (const expected of ['Distribuidora del Norte', 'Sucursal Centro', '7', 'Producto 1 — 1 Bolsa', 'Producto 5 — 5 Bolsa', 'y 2 renglones más']) expect(summary.text()).toContain(expected)
    expect(summary.text()).not.toContain('Producto 6')
    expect(modal.text()).not.toMatch(/\$|Total/)
    expect(modal.find('[data-testid="confirm-transition"]').exists()).toBe(true)
    expect(modal.find('[data-testid="cancel-transition"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
describe('confirm and cancel actions', () => {
  it('shows each action only with its permission and enables it from the workspace gate', async () => {
    set('selected', order); set('open', true); set('canConfirm', true); set('canCancel', true)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="confirm-order"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cancel-order"]').exists()).toBe(false)
    wrapper.unmount()
    grants.add('create:ProcurementOrderConfirmation'); grants.add('create:ProcurementOrderCancellation')
    const allowed = mountView()
    await allowed.get('[data-testid="confirm-order"]').trigger('click')
    expect(workspace.requestTransition).toHaveBeenCalledWith('confirm')
    await allowed.get('[data-testid="cancel-order"]').trigger('click')
    expect(workspace.requestTransition).toHaveBeenCalledWith('cancel')
    set('canConfirm', false)
    await allowed.vm.$nextTick()
    expect(allowed.get('[data-testid="confirm-order"]').attributes('disabled')).toBeDefined()
    allowed.unmount()
  })
  it('does not offer confirm on closed orders and explains unsaved changes', async () => {
    grants.add('create:ProcurementOrderConfirmation'); grants.add('create:ProcurementOrderCancellation')
    set('selected', { ...order, status: 'CONFIRMED', canConfirm: false }); set('open', true); set('canCancel', true)
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="confirm-order"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cancel-order"]').exists()).toBe(true)
    set('selected', order); set('needsSave', true)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Guarda tus cambios antes de confirmar o cancelar.')
    wrapper.unmount()
  })
  it('confirms through a modal that says what freezes and that stock, payments and debt are untouched', async () => {
    grants.add('create:ProcurementOrderConfirmation')
    set('selected', order); set('open', true); set('transition', 'confirm')
    const wrapper = mountView()
    const modal = wrapper.get('aside')
    expect(modal.text()).toContain('Confirmar orden')
    expect(modal.text()).toContain('proveedor, los productos y los costos')
    expect(modal.text()).toContain('existencias, pagos ni deuda')
    expect(modal.text()).toContain('Distribuidora del Norte')
    expect(modal.find('textarea, input').exists()).toBe(false)
    await modal.get('[data-testid="confirm-transition"]').trigger('click')
    expect(workspace.confirmTransition).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('cancels through a modal that states it is final, asks for no reason, and retries uncertain results', async () => {
    grants.add('create:ProcurementOrderCancellation')
    set('selected', { ...order, status: 'CONFIRMED', canConfirm: false }); set('open', true); set('transition', 'cancel')
    const wrapper = mountView()
    const modal = wrapper.get('aside')
    expect(modal.text()).toContain('Cancelar orden')
    expect(modal.text()).toContain('definitiva')
    expect(modal.find('textarea, input').exists()).toBe(false)
    set('uncertain', true); set('message', 'El resultado no está confirmado. Reintenta el mismo intento antes de continuar.')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('aside').find('[data-testid="confirm-transition"]').exists()).toBe(false)
    await wrapper.get('aside').get('[data-testid="retry-transition"]').trigger('click')
    expect(workspace.retry).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
describe('transition action bar', () => {
  const bar = (wrapper: ReturnType<typeof mountView>) => wrapper.get('[data-testid="order-transition-bar"]')
  const before = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
  beforeEach(() => { grants.add('create:ProcurementOrderConfirmation'); grants.add('create:ProcurementOrderCancellation'); grants.add('update:ProcurementPurchaseOrder') })
  it('keeps both actions and the unsaved-changes explanation in one bar that precedes the form', () => {
    set('selected', order); set('open', true); set('canCancel', true); set('needsSave', true)
    const wrapper = mountView()
    const element = bar(wrapper).element
    expect(bar(wrapper).find('[data-testid="confirm-order"]').exists()).toBe(true)
    expect(bar(wrapper).find('[data-testid="cancel-order"]').exists()).toBe(true)
    expect(bar(wrapper).text()).toContain('Guarda tus cambios antes de confirmar o cancelar.')
    expect(before(element, wrapper.get('[data-testid="draft-form"]').element)).toBe(true)
    // The explanation follows the buttons inside the bar, never above them or elsewhere.
    expect(before(bar(wrapper).get('[data-testid="cancel-order"]').element, bar(wrapper).get('[role="status"]').element)).toBe(true)
    wrapper.unmount()
  })
  it('explains what is missing to confirm, inside the bar', () => {
    set('selected', { ...order, canConfirm: false }); set('open', true)
    const wrapper = mountView()
    expect(bar(wrapper).text()).toContain('Completa los avisos del borrador para poder confirmarla.')
    wrapper.unmount()
  })
  it.each([
    ['a ready draft', { ...order }, 'Al confirmar se congelan el proveedor, los productos y los costos.'],
    ['a draft for a user who can only cancel', { ...order }, 'La cancelación es definitiva y no se puede deshacer.'],
    ['a confirmed order', { ...order, status: 'CONFIRMED' as const, canConfirm: false }, 'La cancelación es definitiva y no se puede deshacer.'],
  ])('says what the actions do for %s', (name, selected, expected) => {
    if (name.includes('only cancel')) grants.delete('create:ProcurementOrderConfirmation')
    set('selected', selected); set('open', true); set('canCancel', true)
    const wrapper = mountView()
    expect(bar(wrapper).text()).toContain(expected)
    wrapper.unmount()
  })
  it('is the same bar, ahead of the read-only block, for a closed order', () => {
    set('selected', { ...order, status: 'CONFIRMED', canConfirm: false }); set('open', true); set('canCancel', true)
    const wrapper = mountView()
    expect(bar(wrapper).find('[data-testid="confirm-order"]').exists()).toBe(false)
    expect(bar(wrapper).find('[data-testid="cancel-order"]').exists()).toBe(true)
    expect(before(bar(wrapper).element, wrapper.get('[data-testid="order-readonly"]').element)).toBe(true)
    wrapper.unmount()
  })
  it('does not render a bar for a cancelled order or without transition permissions', () => {
    set('selected', { ...order, status: 'CANCELLED', canConfirm: false }); set('open', true)
    const cancelled = mountView()
    expect(cancelled.find('[data-testid="order-transition-bar"]').exists()).toBe(false)
    cancelled.unmount()
    grants.clear(); grants.add('read:ProcurementPurchaseOrder')
    set('selected', order)
    const reader = mountView()
    expect(reader.find('[data-testid="order-transition-bar"]').exists()).toBe(false)
    reader.unmount()
  })
})
