import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HumanDecision,
  HumanDecisionListFilter,
  PendingHumanDecision,
} from '../../interfaces/human-decision.types'
import type { ExpirationDecisionResolutionInput } from '../../utils/expirationResolutionAttempt'
import {
  pendingExpiration,
  resolvedExpiration,
  unavailableExpiration,
} from '../../interfaces/__tests__/expirationDecision.fixture'
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
const resolveExpirationDecision = vi.fn()
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
    data: ref<HumanDecision | null>(decision),
    isLoading: ref(false),
    isError: ref(false),
  },
  detailOpen: ref(false),
  canUpdate: ref(true),
  resolving: ref(false),
  resolutionErrorMessage: ref<string | null>(null),
  resolutionConflict: ref(false),
  resolutionSucceeded: ref(false),
  expirationResolving: ref(false),
  expirationErrorMessage: ref<string | null>(null),
  expirationConflict: ref(false),
  expirationRequiresReauthentication: ref(false),
  openDetail,
  resolveDecision,
  resolveExpirationDecision,
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
    'requiresReauthentication',
    'resolutionErrorMessage',
  ],
  emits: ['retry', 'resolve', 'resolveExpiration', 'update:open'],
  template: '<section />',
}
const input = { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 } as const
const expirationInput: ExpirationDecisionResolutionInput = {
  action: 'REPORT_EXPIRATION_UNAVAILABLE',
  expectedVersion: 1,
}
const secondExpiration = { ...pendingExpiration, id: 'exp-2' }
function mountView() {
  return mount(HumanDecisionsView, {
    global: {
      stubs: { HumanDecisionsListPanel: ListStub, HumanDecisionDetailSlideover: DetailStub },
    },
  })
}

async function selectDetail(wrapper: ReturnType<typeof mountView>, row: HumanDecision = decision) {
  inbox.detail.data.value = row
  wrapper.getComponent(ListStub).vm.$emit('openDetail', { id: row.id, status: 'PENDING' })
  inbox.detailOpen.value = true
  await wrapper.vm.$nextTick()
  return wrapper.getComponent(DetailStub)
}

describe('HumanDecisionsView unified selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inbox.resolutionErrorMessage.value = null
    inbox.resolutionConflict.value = false
    inbox.resolving.value = false
    inbox.canUpdate.value = true
    inbox.detail.data.value = decision
    inbox.detailOpen.value = false
    inbox.expirationResolving.value = false
    inbox.expirationErrorMessage.value = null
    inbox.expirationConflict.value = false
    inbox.expirationRequiresReauthentication.value = false
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

  it('activates a pending EXPIRATION decision with the exact routed input', async () => {
    const wrapper = mountView()
    const detail = await selectDetail(wrapper, pendingExpiration)
    expect(detail.props()).toMatchObject({ decision: pendingExpiration, canUpdate: true })
    detail.vm.$emit('resolveExpiration', pendingExpiration.id, expirationInput)
    await wrapper.vm.$nextTick()
    expect(resolveExpirationDecision).toHaveBeenCalledExactlyOnceWith(expirationInput)
  })

  it('rejects an old-origin EXPIRATION event when version and action still match', async () => {
    const wrapper = mountView()
    const detail = await selectDetail(wrapper, pendingExpiration)
    await selectDetail(wrapper, secondExpiration)
    expect(detail.props('decision')).toMatchObject({ id: 'exp-2', version: 1 })
    detail.vm.$emit('resolveExpiration', pendingExpiration.id, expirationInput)
    await wrapper.vm.$nextTick()
    expect(resolveExpirationDecision).not.toHaveBeenCalled()
    detail.vm.$emit('resolveExpiration', secondExpiration.id, expirationInput)
    await wrapper.vm.$nextTick()
    expect(resolveExpirationDecision).toHaveBeenCalledExactlyOnceWith(expirationInput)
  })

  it('projects resolving, conflict and error feedback per selected decision type', async () => {
    const wrapper = mountView()
    const detail = await selectDetail(wrapper)
    inbox.resolving.value = true
    inbox.resolutionConflict.value = true
    inbox.resolutionErrorMessage.value = 'restock-error'
    inbox.expirationResolving.value = true
    inbox.expirationConflict.value = true
    inbox.expirationErrorMessage.value = 'expiration-error'
    inbox.expirationRequiresReauthentication.value = true
    await wrapper.vm.$nextTick()
    expect(detail.props()).toMatchObject({
      resolving: true,
      conflict: true,
      resolutionErrorMessage: 'restock-error',
      requiresReauthentication: false,
    })
    await selectDetail(wrapper, pendingExpiration)
    expect(detail.props()).toMatchObject({
      resolving: true,
      conflict: true,
      resolutionErrorMessage: 'expiration-error',
      requiresReauthentication: true,
    })
  })

  it.each([
    ['a closed detail', () => (inbox.detailOpen.value = false)],
    ['missing update permission', () => (inbox.canUpdate.value = false)],
    ['an in-flight resolution', () => (inbox.expirationResolving.value = true)],
    ['a conflict', () => (inbox.expirationConflict.value = true)],
    ['a required reauthentication', () => (inbox.expirationRequiresReauthentication.value = true)],
  ])('denies EXPIRATION dispatch with %s', async (_label, mutate) => {
    const wrapper = mountView()
    await selectDetail(wrapper, pendingExpiration)
    mutate()
    await wrapper.vm.$nextTick()
    wrapper
      .getComponent(DetailStub)
      .vm.$emit('resolveExpiration', pendingExpiration.id, expirationInput)
    await wrapper.vm.$nextTick()
    expect(resolveExpirationDecision).not.toHaveBeenCalled()
  })

  it('denies EXPIRATION dispatch for resolved and non-EXPIRATION details', async () => {
    const wrapper = mountView()
    const detail = await selectDetail(wrapper, resolvedExpiration(unavailableExpiration))
    detail.vm.$emit('resolveExpiration', 'exp-1', expirationInput)
    await wrapper.vm.$nextTick()
    expect(resolveExpirationDecision).not.toHaveBeenCalled()
    await selectDetail(wrapper, decision)
    detail.vm.$emit('resolveExpiration', decision.id, expirationInput)
    await wrapper.vm.$nextTick()
    expect(resolveExpirationDecision).not.toHaveBeenCalled()
  })
})
