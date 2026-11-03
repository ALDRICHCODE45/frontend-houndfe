import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import PurchaseOrderView from '../PurchaseOrderView.vue'
const grants = new Set<string>()
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => ({ user: { id: 'u' }, currentTenantId: 't', authPhase: 'authenticated', permissionsLoaded: true, userCan: (action: string, subject: string) => grants.has(`${action}:${subject}`) }) }))
vi.mock('../../composables/usePurchaseOrders', () => ({ usePurchaseOrders: () => ({ items: shallowRef([]), hasNext: shallowRef(false), hasPrevious: shallowRef(false), next: vi.fn(), back: vi.fn(), refresh: vi.fn(), isLoading: shallowRef(false), isFetching: shallowRef(false), error: shallowRef(null) }) }))
vi.mock('../../composables/usePurchaseOrderWorkspace', () => ({ usePurchaseOrderWorkspace: () => ({ commands: { isPending: shallowRef(false), hasUncertainResult: shallowRef(false) }, selected: shallowRef(null), open: shallowRef(false), editorOpen: shallowRef(false), deleteOpen: shallowRef(false), dirty: shallowRef(false), formKey: shallowRef(0), detailLoading: shallowRef(false), detailError: shallowRef(''), deleteTarget: shallowRef(null), notice: shallowRef(''), locked: shallowRef(false), message: shallowRef(''), conflict: shallowRef(false), deleteRejected: shallowRef(false), create: vi.fn(), canLeave: () => true }) }))
const stubs = { UCard: { template: '<div><slot/></div>' }, USlideover: true, UModal: true, UButton: { template: '<button><slot/></button>' }, PurchaseOrderList: { props: ['canEdit', 'canDelete'], template: '<div><slot name="actions"/><span>{{canEdit}}/{{canDelete}}</span></div>' } }
describe('draft view effective permissions', () => {
  it('allows continuing with read and update even without catalog reads', () => {
    grants.clear(); grants.add('read:ProcurementPurchaseOrder'); grants.add('update:ProcurementPurchaseOrder')
    const wrapper = mount(PurchaseOrderView, { global: { stubs } })
    expect(wrapper.text()).toContain('true/false')
    expect(wrapper.find('[data-testid="create-order"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('requires create + both reference reads for new orders, deletion does not require update', () => {
    grants.clear(); grants.add('read:ProcurementPurchaseOrder'); grants.add('delete:ProcurementPurchaseOrder'); grants.add('create:ProcurementPurchaseOrder')
    const wrapper = mount(PurchaseOrderView, { global: { stubs } })
    expect(wrapper.find('[data-testid="create-order"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('false/true')
    wrapper.unmount()
    grants.add('read:Product'); grants.add('read:ProcurementSupplier')
    const allowed = mount(PurchaseOrderView, { global: { stubs } })
    expect(allowed.find('[data-testid="create-order"]').exists()).toBe(true)
    allowed.unmount()
  })
})
