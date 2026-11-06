import { defineComponent, h, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShippingSettingsView from '../ShippingSettingsView.vue'

const holder = vi.hoisted(() => ({
  grants: [] as string[],
  confirm: vi.fn(async () => true),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => reactive({
    currentTenantId: 't-1',
    userCan: (action: string, subject: string) => holder.grants.includes(`${action}:${subject}`),
  }),
}))
vi.mock('@/core/shared/composables/useLeaveGuard', () => ({
  useLeaveGuard: vi.fn(),
  confirmLeave: () => holder.confirm(),
}))

const { panel } = vi.hoisted(() => ({
  // Stand-ins for the tab panels: they show what the view passes and can report unsaved edits.
  panel: async (name: string) => {
    const { defineComponent, h } = await import('vue')
    return {
      default: defineComponent({
        name,
        props: ['tenantId', 'canUpdate'],
        emits: ['dirty'],
        setup(props, { emit }) {
          return () =>
            h('div', { 'data-panel': name, 'data-can-update': String(props.canUpdate), 'data-tenant': props.tenantId }, [
              h('button', { 'data-testid': `${name}-dirty`, onClick: () => emit('dirty', true) }),
            ])
        },
      }),
    }
  },
}))

vi.mock('@/features/shipping/delivery-zones/components/DeliveryZonesPanel.vue', () => panel('zones'))
vi.mock('../../components/ShippingBoxesPanel.vue', () => panel('boxes'))
vi.mock('../../components/ShippingOriginPanel.vue', () => panel('origin'))
vi.mock('../../components/OpeningHoursPanel.vue', () => panel('hours'))

const dispose: Array<() => void> = []
async function setup(tab?: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/sistema/envios', component: ShippingSettingsView }],
  })
  await router.push({ path: '/sistema/envios', query: tab ? { tab } : {} })
  const wrapper = mount(defineComponent({ setup: () => () => h('div', [h(ShippingSettingsView)]) }), {
    global: { plugins: [router] },
  })
  dispose.push(() => wrapper.unmount())
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  holder.grants = ['read:ShippingSettings', 'update:ShippingSettings', 'read:DeliveryZone']
  holder.confirm.mockReset().mockResolvedValue(true)
})
afterEach(() => dispose.splice(0).forEach((fn) => fn()))

describe('ShippingSettingsView (S2)', () => {
  it('Zonas renders the delivery zones panel with read:DeliveryZone', async () => {
    const { wrapper } = await setup('zonas')
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Zonas', 'Cajas', 'Origen', 'Horario'])
    expect(wrapper.find('[data-panel="zones"]').exists()).toBe(true)
  })

  it('without read:DeliveryZone there is no Zonas tab and ?tab=zonas opens Cajas', async () => {
    holder.grants = ['read:ShippingSettings']
    const { wrapper } = await setup('zonas')
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Cajas', 'Origen', 'Horario'])
    expect(wrapper.find('[data-panel="zones"]').exists()).toBe(false)
    expect(wrapper.get('[data-panel="boxes"]').attributes('data-can-update')).toBe('false')
  })

  it('each tab renders its panel for the tenant; edits need update:ShippingSettings', async () => {
    for (const [tab, name] of [['cajas', 'boxes'], ['origen', 'origin'], ['horario', 'hours']] as const) {
      const { wrapper } = await setup(tab)
      const found = wrapper.get(`[data-panel="${name}"]`)
      expect(found.attributes('data-tenant')).toBe('t-1')
      expect(found.attributes('data-can-update')).toBe('true')
    }
  })

  it('switching tabs with unsaved changes asks first and stays when the user keeps editing', async () => {
    holder.confirm.mockResolvedValue(false)
    const { wrapper, router } = await setup('origen')
    await wrapper.get('[data-testid="origin-dirty"]').trigger('click')
    await wrapper.get('[data-testid="shipping-tab-horario"]').trigger('click')
    await flushPromises()
    expect(holder.confirm).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.tab).toBe('origen')

    holder.confirm.mockResolvedValue(true)
    await wrapper.get('[data-testid="shipping-tab-horario"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('horario')
  })
})
