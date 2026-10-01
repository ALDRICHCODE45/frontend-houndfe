import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HumanDecision,
  PendingHumanDecision,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'
import { pendingExpiration } from '../../interfaces/__tests__/expirationDecision.fixture'
import { useHumanDecisionsListTable } from '../useHumanDecisionsListTable'
import { useHumanDecisionDetail } from '../useHumanDecisionDetail'
import { useResolveHumanDecision } from '../useResolveHumanDecision'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useHumanDecisionsInbox } from '../useHumanDecisionsInbox'

vi.mock('../useHumanDecisionsListTable', () => ({ useHumanDecisionsListTable: vi.fn() }))
vi.mock('../useHumanDecisionDetail', () => ({ useHumanDecisionDetail: vi.fn() }))
vi.mock('../useResolveHumanDecision', () => ({ useResolveHumanDecision: vi.fn() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: vi.fn() }))

const pending: PendingHumanDecision = {
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

const resolved: ResolvedHumanDecision = {
  ...pending,
  status: 'RESOLVED',
  version: 2,
  allowedActions: [],
  resolution: {
    action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
    resolvedAt: '2026-09-25T10:05:00.000Z',
    resolvedBy: { id: 'user-1', displayName: 'Ana' },
  },
}

const listState = {
  data: ref([pending]),
  pagination: ref({ pageIndex: 0, pageSize: 20 }),
  globalFilter: ref(''),
  totalCount: ref(1),
  pageCount: ref(1),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref(null),
  pageSizeOptions: [20, 50],
  showingFrom: ref(1),
  showingTo: ref(1),
  refresh: vi.fn(),
}
const detailState = {
  data: ref<HumanDecision>(pending),
  isLoading: ref(false),
  isError: ref(false),
  error: ref(null),
  refetch: vi.fn(),
}
const mutateAsync = vi.fn()
const updateAllowed = ref(true)

function setup(generateId = vi.fn(() => 'request-1')) {
  return useHumanDecisionsInbox(generateId)
}

function apiError(code?: string, status = 500) {
  return code ? { response: { status, data: { code } } } : new Error('network')
}

describe('useHumanDecisionsInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listState.data.value = [pending]
    detailState.data.value = pending
    updateAllowed.value = true
    vi.mocked(useHumanDecisionsListTable).mockReturnValue(listState as never)
    vi.mocked(useHumanDecisionDetail).mockReturnValue(detailState as never)
    vi.mocked(useResolveHumanDecision).mockReturnValue({
      mutateAsync,
      isPending: ref(false),
      error: ref(null),
    })
    vi.mocked(useAuthStore).mockReturnValue({
      userCan: vi.fn(() => updateAllowed.value),
    } as never)
  })

  it('selects lazy detail and exposes list plus update authorization', () => {
    const inbox = setup()
    expect(inbox.list).toBe(listState)
    expect(inbox.canUpdate.value).toBe(true)

    inbox.openDetail('decision-1')
    expect(inbox.selectedDecisionId.value).toBe('decision-1')
    expect(inbox.detailOpen.value).toBe(true)
  })

  it('blocks resolve without update permission or a matching server action', async () => {
    const inbox = setup()
    inbox.openDetail('decision-1')
    updateAllowed.value = false
    await inbox.resolveDecision({
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
    })
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(inbox.resolutionErrorMessage.value).toContain('permiso')

    updateAllowed.value = true
    detailState.data.value = { ...pending, allowedActions: [] }
    await inbox.resolveDecision({
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
    })
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(inbox.resolutionErrorMessage.value).toContain('ya no está disponible')

    detailState.data.value = pending
    inbox.openDetail('decision-2')
    await inbox.resolveDecision({
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
    })
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(inbox.resolutionErrorMessage.value).toContain('ya no está disponible')
  })

  it.each([
    { action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3, expectedVersion: 1 },
    { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 },
  ] as const)('refuses $action on EXPIRATION before UUID or mutation', async (input) => {
    const generateId = vi.fn(() => 'request-1')
    mutateAsync.mockResolvedValue(resolved)
    const inbox = setup(generateId)
    detailState.data.value = pendingExpiration
    inbox.openDetail('exp-1')
    await inbox.resolveDecision(input)
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(generateId).not.toHaveBeenCalled()
    expect(inbox.resolutionErrorMessage.value).toContain('ya no está disponible')
  })

  it('reuses one request id when the same ambiguous attempt is retried', async () => {
    const generateId = vi.fn(() => 'request-1')
    mutateAsync.mockRejectedValueOnce(apiError()).mockResolvedValueOnce(resolved)
    const inbox = setup(generateId)
    inbox.openDetail('decision-1')
    const input = {
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' as const,
      expectedVersion: 1,
    }

    await inbox.resolveDecision(input)
    await inbox.resolveDecision(input)

    expect(generateId).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        payload: expect.objectContaining({ resolutionRequestId: 'request-1' }),
      }),
    )
    expect(inbox.resolutionSucceeded.value).toBe(true)
    expect(inbox.resolutionErrorMessage.value).toBeNull()
  })

  it('creates a fresh request id when the answer changes', async () => {
    const generateId = vi.fn().mockReturnValueOnce('request-1').mockReturnValueOnce('request-2')
    mutateAsync.mockRejectedValue(apiError())
    const inbox = setup(generateId)
    inbox.openDetail('decision-1')

    await inbox.resolveDecision({
      action: 'PROVIDE_RESTOCK_ESTIMATE',
      restockDays: 5,
      expectedVersion: 1,
    })
    await inbox.resolveDecision({
      action: 'PROVIDE_RESTOCK_ESTIMATE',
      restockDays: 6,
      expectedVersion: 1,
    })

    expect(generateId).toHaveBeenCalledTimes(2)
    expect(mutateAsync.mock.calls[1]![0].payload.resolutionRequestId).toBe('request-2')
  })

  it.each(['VERSION_CONFLICT', 'ALREADY_RESOLVED'])(
    'surfaces %s as read-only and does not retry it',
    async (code) => {
      mutateAsync.mockRejectedValue(apiError(code, 409))
      const generateId = vi.fn(() => 'request-1')
      const inbox = setup(generateId)
      inbox.openDetail('decision-1')
      const input = {
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' as const,
        expectedVersion: 1,
      }

      await inbox.resolveDecision(input)
      await inbox.resolveDecision(input)

      expect(inbox.resolutionConflict.value).toBe(true)
      expect(mutateAsync).toHaveBeenCalledTimes(1)
      expect(generateId).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps idempotency conflicts distinct and clears their attempt', async () => {
    const generateId = vi.fn().mockReturnValueOnce('request-1').mockReturnValueOnce('request-2')
    mutateAsync.mockRejectedValue(apiError('IDEMPOTENCY_CONFLICT', 409))
    const inbox = setup(generateId)
    inbox.openDetail('decision-1')
    const input = {
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' as const,
      expectedVersion: 1,
    }

    await inbox.resolveDecision(input)
    expect(inbox.resolutionConflict.value).toBe(false)
    expect(inbox.resolutionErrorMessage.value).toContain('reutilizar este intento')
    await inbox.resolveDecision(input)
    expect(generateId).toHaveBeenCalledTimes(2)
    expect(mutateAsync.mock.calls[1]![0].payload.resolutionRequestId).toBe('request-2')
  })
})
