import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HumanDecisionsOfflineDemoRouteView from '../HumanDecisionsOfflineDemoRouteView.vue'

const mockAuthStore = {
  currentTenant: { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' } as {
    id: string
    name: string
    slug: string
  } | null,
  user: { id: 'user-1', name: 'Ana Responsable' } as { id: string; name: string } | null,
  userCan: vi.fn().mockReturnValue(true),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

const DemoStub = {
  name: 'HumanDecisionsOfflineDemoView',
  props: ['canUpdate', 'tenantName', 'resolverName'],
  template: '<div data-testid="offline-demo-stub" />',
}

function mountRouteView() {
  return mount(HumanDecisionsOfflineDemoRouteView, {
    global: { stubs: { HumanDecisionsOfflineDemoView: DemoStub } },
  })
}

describe('HumanDecisionsOfflineDemoRouteView', () => {
  beforeEach(() => {
    mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' }
    mockAuthStore.user = { id: 'user-1', name: 'Ana Responsable' }
    mockAuthStore.userCan.mockReset().mockReturnValue(true)
  })

  it('passes tenant identity and exact update permission to the offline composition', () => {
    const wrapper = mountRouteView()
    expect(mockAuthStore.userCan).toHaveBeenCalledWith('update', 'HumanDecision')
    expect(wrapper.getComponent(DemoStub).props()).toMatchObject({
      canUpdate: true,
      tenantName: 'Sucursal Centro',
      resolverName: 'Ana Responsable',
    })
  })

  it('keeps the synthetic case hidden without a tenant context', () => {
    mockAuthStore.currentTenant = null
    const wrapper = mountRouteView()

    expect(wrapper.findComponent(DemoStub).exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Selecciona una sucursal')
  })
})
