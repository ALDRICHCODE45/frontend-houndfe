import { mount } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import PurchaseOrderList from '../PurchaseOrderList.vue'
vi.mock('@vueuse/core', async importOriginal => ({ ...await importOriginal<typeof import('@vueuse/core')>(), useBreakpoints: () => ({ smaller: () => shallowRef(true) }) }))
describe('draft mobile shared toolbar', () => {
  it('does not render an empty filters trigger through the real table wrapper', () => {
    const wrapper = mount(PurchaseOrderList, { props: { items: [], canEdit: false, canDelete: false }, global: { stubs: { Slideover: true, Tooltip: { template: '<span><slot/></span>' }, Button: { template: '<button><slot/></button>' } } } })
    expect(wrapper.find('[data-testid="toolbar-mobile-filters-row"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
