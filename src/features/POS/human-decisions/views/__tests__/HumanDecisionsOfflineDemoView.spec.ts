import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HumanDecisionsOfflineDemoView from '../HumanDecisionsOfflineDemoView.vue'

const ListPanelStub = {
  name: 'HumanDecisionsListPanel',
  props: ['data', 'totalCount'],
  emits: ['openDetail'],
  template: `
    <section data-testid="list-panel">
      <span data-testid="queue-count">{{ totalCount }}</span>
      <button
        v-if="data[0]"
        data-testid="open-demo-detail"
        @click="$emit('openDetail', data[0].id)"
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
  it('labels the synthetic no-HTTP context and supplies identifiable snapshot data', () => {
    const wrapper = mountDemo()

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

  it('records the honest unavailable response in memory and removes the pending row', async () => {
    const wrapper = mountDemo()
    await wrapper.get('[data-testid="open-demo-detail"]').trigger('click')
    await wrapper.get('[data-testid="resolve-unavailable"]').trigger('click')

    expect(wrapper.get('[data-testid="detail-status"]').text()).toBe('RESOLVED')
    expect(wrapper.get('[data-testid="queue-count"]').text()).toBe('0')
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
