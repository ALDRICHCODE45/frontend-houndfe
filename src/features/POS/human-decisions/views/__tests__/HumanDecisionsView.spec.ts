import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HumanDecisionListFilter,
  PendingHumanDecision,
} from '../../interfaces/human-decision.types'
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
const statusFilter = ref<HumanDecisionListFilter>('ALL')
const setStatusFilter = vi.fn((status: HumanDecisionListFilter) => {
  statusFilter.value = status
})
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
    statusFilter,
    setStatusFilter,
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
  props: ['data', 'loading', 'error', 'totalCount', 'pagination', 'globalFilter', 'statusFilter'],
  emits: ['openDetail', 'refresh', 'update:statusFilter'],
  template: '<section />',
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
  template: '<section />',
}
const input = { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 } as const
function mountView() {
  return mount(HumanDecisionsView, {
    global: {
      stubs: { HumanDecisionsListPanel: ListStub, HumanDecisionDetailSlideover: DetailStub },
    },
  })
}

describe('HumanDecisionsView unified selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inbox.resolutionErrorMessage.value = null
    inbox.resolutionConflict.value = false
    inbox.canUpdate.value = true
    inbox.list.data.value = [decision]
    statusFilter.value = 'ALL'
    vi.mocked(useHumanDecisionsInbox).mockReturnValue(inbox as never)
  })

  it('mounts exactly one list and forwards refresh, status and ID selection', async () => {
    const wrapper = mountView()
    expect(wrapper.classes()).toContain('md:px-10')
    expect(wrapper.findAllComponents(ListStub)).toHaveLength(1)
    const list = wrapper.getComponent(ListStub)
    expect(list.props()).toMatchObject({
      data: [decision],
      totalCount: 1,
      error: false,
      statusFilter: 'ALL',
    })
    list.vm.$emit('openDetail', { id: decision.id, status: 'PENDING' })
    list.vm.$emit('refresh')
    list.vm.$emit('update:statusFilter', 'RESOLVED')
    await wrapper.vm.$nextTick()
    expect(openDetail).toHaveBeenCalledWith(decision.id)
    expect(refresh).toHaveBeenCalledOnce()
    expect(setStatusFilter).toHaveBeenCalledWith('RESOLVED')
  })

  it.each(['RESOLVED', undefined, 'UNKNOWN'])(
    'keeps %s selection read-only despite stale PENDING detail and filter/page changes',
    async (status) => {
      const wrapper = mountView()
      const list = wrapper.getComponent(ListStub)
      list.vm.$emit('openDetail', { id: decision.id, status })
      await wrapper.vm.$nextTick()
      const detail = wrapper.getComponent(DetailStub)
      expect(detail.props()).toMatchObject({ decision, canUpdate: false })
      detail.vm.$emit('resolve', input)
      for (const filter of ['PENDING', 'ALL', 'RESOLVED']) {
        list.vm.$emit('update:statusFilter', filter)
        inbox.list.data.value = []
        inbox.list.pagination.value = { pageIndex: 4, pageSize: 50 }
        await wrapper.vm.$nextTick()
        expect(detail.props('canUpdate')).toBe(false)
        detail.vm.$emit('resolve', input)
      }
      expect(resolveDecision).not.toHaveBeenCalled()
    },
  )

  it('denies unknown initial selection and preserves pending permission guards', async () => {
    const wrapper = mountView()
    const detail = wrapper.getComponent(DetailStub)
    expect(detail.props('canUpdate')).toBe(false)
    detail.vm.$emit('resolve', input)
    expect(resolveDecision).not.toHaveBeenCalled()
    wrapper.getComponent(ListStub).vm.$emit('openDetail', { id: decision.id, status: 'PENDING' })
    await wrapper.vm.$nextTick()
    expect(detail.props('canUpdate')).toBe(true)
    detail.vm.$emit('resolve', input)
    expect(resolveDecision).toHaveBeenCalledExactlyOnceWith(input)
    inbox.canUpdate.value = false
    await wrapper.vm.$nextTick()
    expect(detail.props('canUpdate')).toBe(false)
    detail.vm.$emit('resolve', input)
    expect(resolveDecision).toHaveBeenCalledTimes(1)
  })

  it('forwards lazy detail retry and resolution conflict/error state unchanged', async () => {
    inbox.resolutionErrorMessage.value = 'No se pudo registrar la respuesta. Intenta de nuevo.'
    inbox.resolutionConflict.value = true
    const wrapper = mountView()
    const detail = wrapper.getComponent(DetailStub)
    expect(detail.props()).toMatchObject({
      decision,
      conflict: true,
      resolutionErrorMessage: inbox.resolutionErrorMessage.value,
    })
    detail.vm.$emit('retry')
    expect(retryDetail).toHaveBeenCalledOnce()
  })
})
