import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))
import HumanDecisionsOfflineDemoView from '../HumanDecisionsOfflineDemoView.vue'

const ListPanelStub = {
  name: 'HumanDecisionsListPanel',
  props: ['data', 'totalCount', 'statusFilter', 'pagination'],
  emits: ['openDetail', 'update:statusFilter', 'update:globalFilter', 'update:pagination'],
  template: `
    <section data-testid="list-panel">
      <span data-testid="queue-count">{{ totalCount }}</span>
      <button
        v-if="data[0]"
        data-testid="open-demo-detail"
        @click="$emit('openDetail', { id: data[0].id, status: data[0].status })"
      >Abrir</button>
    </section>
  `,
}

const DetailStub = {
  name: 'HumanDecisionDetailSlideover',
  props: ['decision', 'canUpdate', 'open'],
  emits: ['resolve', 'update:open'],
  template: `
    <section v-if="open" data-testid="detail-stub">
      <span data-testid="detail-status">{{ decision?.status }}</span>
      <span data-testid="detail-can-update">{{ canUpdate }}</span>
      <button
        data-testid="resolve-unavailable"
        @click="$emit('resolve', {
          action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
          expectedVersion: decision.version,
        })"
      >Sin fecha</button>
      <button
        data-testid="resolve-estimate"
        @click="$emit('resolve', {
          action: 'PROVIDE_RESTOCK_ESTIMATE',
          restockDays: 12,
          expectedVersion: decision.version,
        })"
      >12 días</button>
    </section>
  `,
}

function mountDemo(canUpdate = true) {
  return mount(HumanDecisionsOfflineDemoView, {
    props: {
      canUpdate,
      tenantName: 'Sucursal Centro Demo',
      resolverName: 'Responsable demo',
    },
    global: {
      stubs: {
        HumanDecisionsListPanel: ListPanelStub,
        HumanDecisionDetailSlideover: DetailStub,
      },
    },
  })
}

describe('HumanDecisionsOfflineDemoView', () => {
  beforeEach(() => vi.clearAllMocks())
  it('labels the synthetic no-HTTP context and supplies identifiable snapshot data', () => {
    const wrapper = mountDemo()

    expect(wrapper.classes()).toContain('md:px-10')
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.get('[data-testid="offline-demo-label"]').text()).toBe(
      'SIMULACIÓN · datos sintéticos · sin HTTP',
    )
    expect(wrapper.text()).toContain('No contiene una conversación del cliente')
    expect(wrapper.text()).toContain('Sucursal Centro Demo')

    const decision = wrapper.getComponent(ListPanelStub).props('data')[0]
    expect(decision).toMatchObject({
      title: 'Solicitud de reposición',
      sanitizedSummary: 'Se requiere una decisión humana sobre la reposición.',
      status: 'PENDING',
      version: 1,
      snapshot: {
        branchName: 'Sucursal Centro Demo',
        productName: 'Alimento seco 15 kg',
        variantId: null,
        sku: 'ALIM-15KG-DEMO',
        requestedQuantity: 2,
        observedStockAtRequest: 0,
      },
    })
  })

  it('opens the selected detail and forwards update authorization', async () => {
    const wrapper = mountDemo(false)
    await wrapper.get('[data-testid="open-demo-detail"]').trigger('click')

    expect(wrapper.get('[data-testid="detail-status"]').text()).toBe('PENDING')
    expect(wrapper.get('[data-testid="detail-can-update"]').text()).toBe('false')
  })

  it('retains the honest unavailable response under ALL and filters it without HTTP', async () => {
    const wrapper = mountDemo()
    await wrapper.get('[data-testid="open-demo-detail"]').trigger('click')
    await wrapper.get('[data-testid="resolve-unavailable"]').trigger('click')

    expect(wrapper.get('[data-testid="detail-status"]').text()).toBe('RESOLVED')
    expect(wrapper.get('[data-testid="queue-count"]').text()).toBe('1')
    const list = wrapper.getComponent(ListPanelStub)
    expect(list.props('statusFilter')).toBe('ALL')
    expect(list.props('data')[0].status).toBe('RESOLVED')
    for (const [filter, count] of [
      ['PENDING', 0],
      ['RESOLVED', 1],
      ['ALL', 1],
    ] as const) {
      list.vm.$emit('update:statusFilter', filter)
      await wrapper.vm.$nextTick()
      expect(list.props('totalCount')).toBe(count)
      expect(wrapper.getComponent(DetailStub).props('canUpdate')).toBe(false)
    }
    expect(http.get).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
    expect(wrapper.get('[role="status"]').text()).toContain(
      'Respuesta registrada solo en esta simulación',
    )
    expect(wrapper.getComponent(DetailStub).props('decision')).toMatchObject({
      version: 2,
      allowedActions: [],
      resolution: {
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
        resolvedBy: { displayName: 'Responsable demo' },
      },
    })
  })

  it('searches only normalized product names, not SKU or branch, and resets the page on filter change', async () => {
    const wrapper = mountDemo()
    const list = wrapper.getComponent(ListPanelStub)
    for (const [search, count] of [
      ['  Alimento   seco  ', 1],
      ['Sucursal Centro Demo', 0],
      ['ALIM-15KG-DEMO', 0],
    ] as const) {
      list.vm.$emit('update:globalFilter', search)
      await wrapper.vm.$nextTick()
      expect(list.props('totalCount')).toBe(count)
    }
    list.vm.$emit('update:pagination', { pageIndex: 2, pageSize: 50 })
    list.vm.$emit('update:statusFilter', 'PENDING')
    await wrapper.vm.$nextTick()
    expect(list.props('pagination')).toEqual({ pageIndex: 0, pageSize: 50 })
    expect(http.get).not.toHaveBeenCalled()
  })

  it('does not accept resolve events without update permission', async () => {
    const wrapper = mountDemo(false)
    await wrapper.get('[data-testid="open-demo-detail"]').trigger('click')
    await wrapper.get('[data-testid="resolve-unavailable"]').trigger('click')
    expect(wrapper.getComponent(DetailStub).props('decision').status).toBe('PENDING')
    expect(http.post).not.toHaveBeenCalled()
  })

  it('records a natural-day estimate without computing a delivery date', async () => {
    const wrapper = mountDemo()
    await wrapper.get('[data-testid="open-demo-detail"]').trigger('click')
    await wrapper.get('[data-testid="resolve-estimate"]').trigger('click')

    const resolution = wrapper.getComponent(DetailStub).props('decision').resolution
    expect(resolution).toMatchObject({
      action: 'PROVIDE_RESTOCK_ESTIMATE',
      restockDays: 12,
    })
    expect(resolution).not.toHaveProperty('estimatedDate')
    expect(wrapper.text()).not.toContain('cliente notificado')
  })
})
