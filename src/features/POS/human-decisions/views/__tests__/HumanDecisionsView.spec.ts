import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PendingHumanDecision } from '../../interfaces/human-decision.types'
import { useHumanDecisionsInbox } from '../../composables/useHumanDecisionsInbox'
import HumanDecisionsView from '../HumanDecisionsView.vue'

vi.mock('../../composables/useHumanDecisionsInbox', () => ({ useHumanDecisionsInbox: vi.fn() }))

const decision: PendingHumanDecision = {
  id: 'decision-1',
  type: 'RESTOCK',
  title: 'Solicitud de reposición',
  sanitizedSummary: 'Se requiere una decisión humana.',
  createdAt: '2026-09-25T10:00:00.000Z',
  status: 'PENDING',
  version: 1,
  resolution: null,
  allowedActions: ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'],
  snapshot: {
    branchId: 'branch-1',
    branchName: 'Centro',
    productId: 'product-1',
    productName: 'Alimento',
    variantId: null,
    sku: 'SKU-1',
    requestedQuantity: 2,
    observedStockAtRequest: 0,
    stockObservedAt: '2026-09-25T09:55:00.000Z',
  },
}

const openDetail = vi.fn()
const resolveDecision = vi.fn()
const retryDetail = vi.fn()
const refresh = vi.fn()
const inbox = {
  list: {
    data: ref([decision]),
    pagination: ref({ pageIndex: 0, pageSize: 20 }),
    globalFilter: ref(''),
    totalCount: ref(1),
    pageCount: ref(1),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    pageSizeOptions: [20, 50],
    showingFrom: ref(1),
    showingTo: ref(1),
    refresh,
  },
  detail: {
    data: ref<PendingHumanDecision | null>(decision),
    isLoading: ref(false),
    isError: ref(false),
  },
  detailOpen: ref(false),
  canUpdate: ref(true),
  resolving: ref(false),
  resolutionErrorMessage: ref<string | null>(null),
  resolutionConflict: ref(false),
  resolutionSucceeded: ref(false),
  openDetail,
  resolveDecision,
  retryDetail,
}

const ListStub = {
  name: 'HumanDecisionsListPanel',
  props: ['data', 'loading', 'error', 'totalCount'],
  emits: ['openDetail', 'refresh'],
  template: `
    <section data-testid="list-stub">
      <span>{{ data.length }} / {{ totalCount }} / {{ loading }} / {{ error }}</span>
      <button data-testid="open-detail" @click="$emit('openDetail', data[0].id)">Abrir</button>
      <button data-testid="refresh-list" @click="$emit('refresh')">Actualizar</button>
    </section>
  `,
}
const DetailStub = {
  name: 'HumanDecisionDetailSlideover',
  props: [
    'decision',
    'open',
    'loading',
    'error',
    'canUpdate',
    'resolving',
    'conflict',
    'resolutionErrorMessage',
  ],
  emits: ['retry', 'resolve', 'update:open'],
  template: `
    <section data-testid="detail-stub">
      <span>{{ decision?.id }} / {{ canUpdate }} / {{ conflict }}</span>
      <p data-testid="resolution-error">{{ resolutionErrorMessage }}</p>
      <button data-testid="retry-detail" @click="$emit('retry')">Reintentar</button>
      <button
        data-testid="resolve-detail"
        @click="$emit('resolve', {
          action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
          expectedVersion: decision.version,
        })"
      >Resolver</button>
    </section>
  `,
}

function mountView() {
  return mount(HumanDecisionsView, {
    global: {
      stubs: {
        HumanDecisionsListPanel: ListStub,
        HumanDecisionDetailSlideover: DetailStub,
      },
    },
  })
}

describe('HumanDecisionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inbox.resolutionErrorMessage.value = null
    inbox.resolutionConflict.value = false
    vi.mocked(useHumanDecisionsInbox).mockReturnValue(inbox as never)
  })

  it('mounts the live list state and forwards list actions', async () => {
    const wrapper = mountView()
    const list = wrapper.getComponent(ListStub)
    expect(list.props()).toMatchObject({ data: [decision], totalCount: 1, error: false })

    await wrapper.get('[data-testid="open-detail"]').trigger('click')
    await wrapper.get('[data-testid="refresh-list"]').trigger('click')
    expect(openDetail).toHaveBeenCalledWith('decision-1')
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('mounts lazy detail, authorization and resolution state', async () => {
    inbox.resolutionErrorMessage.value = 'No se pudo registrar la respuesta. Intenta de nuevo.'
    inbox.resolutionConflict.value = true
    const wrapper = mountView()
    const detail = wrapper.getComponent(DetailStub)
    expect(detail.props()).toMatchObject({
      decision,
      canUpdate: true,
      conflict: true,
      resolutionErrorMessage: 'No se pudo registrar la respuesta. Intenta de nuevo.',
    })

    await wrapper.get('[data-testid="retry-detail"]').trigger('click')
    await wrapper.get('[data-testid="resolve-detail"]').trigger('click')
    expect(retryDetail).toHaveBeenCalledOnce()
    expect(resolveDecision).toHaveBeenCalledWith({
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
    })
  })
})
