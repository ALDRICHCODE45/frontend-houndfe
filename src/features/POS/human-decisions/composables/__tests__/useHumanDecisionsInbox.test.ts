import { effectScope, reactive, ref, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HumanDecision,
  PendingHumanDecision,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'
import {
  pendingExpiration,
  resolvedExpiration,
  unavailableExpiration,
} from '../../interfaces/__tests__/expirationDecision.fixture'
import { useHumanDecisionsListTable } from '../useHumanDecisionsListTable'
import { useHumanDecisionDetail } from '../useHumanDecisionDetail'
import { useResolveHumanDecision } from '../useResolveHumanDecision'
import {
  useResolveExpirationDecision,
  type ExpirationDecisionDispatchOutcome,
} from '../useResolveExpirationDecision'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useHumanDecisionsInbox } from '../useHumanDecisionsInbox'

vi.mock('../useHumanDecisionsListTable', () => ({ useHumanDecisionsListTable: vi.fn() }))
vi.mock('../useHumanDecisionDetail', () => ({ useHumanDecisionDetail: vi.fn() }))
vi.mock('../useResolveHumanDecision', () => ({ useResolveHumanDecision: vi.fn() }))
vi.mock('../useResolveExpirationDecision', () => ({ useResolveExpirationDecision: vi.fn() }))
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
const expirationDispatch = vi.fn()
const expirationPending = ref(false)
const expirationOwnerError = ref<unknown>(null)
const expirationReauth = ref(false)
const currentUser = ref<{ id: string } | null>({ id: 'user-1' })
const authTenantId = ref('tenant-1')
const authStoreMock = reactive({
  user: currentUser,
  currentTenantId: authTenantId,
  userCan: vi.fn(() => updateAllowed.value),
})

function setup(generateId = vi.fn(() => 'request-1')) {
  return useHumanDecisionsInbox(generateId)
}

function apiError(code?: string, status = 500) {
  return code ? { response: { status, data: { code } } } : new Error('network')
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
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
    vi.mocked(useAuthStore).mockReturnValue(authStoreMock as never)
    expirationPending.value = false
    expirationOwnerError.value = null
    expirationReauth.value = false
    currentUser.value = { id: 'user-1' }
    authTenantId.value = 'tenant-1'
    expirationDispatch.mockReset()
    vi.mocked(useResolveExpirationDecision).mockReturnValue({
      dispatch: expirationDispatch,
      isPending: expirationPending,
      error: expirationOwnerError,
      requiresReauthentication: expirationReauth,
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

  describe('EXPIRATION integration', () => {
    const report = { action: 'REPORT_EXPIRATION_UNAVAILABLE', expectedVersion: 1 } as const
    const stale = 'ya no está disponible'
    const noActions = { ...pendingExpiration, allowedActions: [] } as HumanDecision

    function openExpiration(inbox: ReturnType<typeof useHumanDecisionsInbox>) {
      detailState.data.value = pendingExpiration
      inbox.openDetail('exp-1')
    }

    function openFresh() {
      const inbox = setup()
      detailState.data.value = pendingExpiration
      inbox.openDetail('exp-1')
      return inbox
    }

    function resolvedOutcome(): ExpirationDecisionDispatchOutcome {
      return { status: 'resolved', decision: resolvedExpiration(unavailableExpiration) }
    }

    function rejectWith(error: unknown, reauth = false) {
      expirationDispatch.mockImplementation(async () => {
        expirationOwnerError.value = error
        expirationReauth.value = reauth
        return { status: 'rejected' }
      })
    }

    it.each([
      ['permission', false, pendingExpiration, 'exp-1', report, 'permiso'],
      ['non-EXPIRATION', true, pending, 'exp-1', report, stale],
      ['resolved', true, resolvedExpiration(unavailableExpiration), 'exp-1', report, stale],
      ['mismatched selection', true, pendingExpiration, 'other-id', report, stale],
      ['version', true, pendingExpiration, 'exp-1', { ...report, expectedVersion: 2 }, stale],
      ['action', true, noActions, 'exp-1', report, stale],
    ] as const)('blocks %s before dispatch', async (_l, allowed, decision, id, input, copy) => {
      const inbox = setup()
      updateAllowed.value = allowed
      detailState.data.value = decision
      inbox.openDetail(id)
      await inbox.resolveExpirationDecision(input)
      expect(inbox.expirationErrorMessage.value).toContain(copy)
      expect(expirationDispatch).not.toHaveBeenCalled()
    })

    it('delegates the decision id and input once, keeps success, and starts no fetch', async () => {
      const generateId = vi.fn(() => 'request-1')
      expirationDispatch.mockResolvedValue(resolvedOutcome())
      const inbox = setup(generateId)
      openExpiration(inbox)

      await inbox.resolveExpirationDecision(report)

      expect(expirationDispatch).toHaveBeenCalledTimes(1)
      expect(expirationDispatch).toHaveBeenCalledWith('exp-1', report)
      expect(generateId).not.toHaveBeenCalled()
      expect(inbox.expirationSucceeded.value).toBe(true)
      expect(inbox.expirationErrorMessage.value).toBeNull()
      expect(inbox.expirationConflict.value).toBe(false)

      detailState.data.value = resolvedExpiration(unavailableExpiration)
      expect(inbox.expirationSucceeded.value).toBe(true)
      expect(detailState.refetch).not.toHaveBeenCalled()
      expect(listState.refresh).not.toHaveBeenCalled()
    })

    it.each([
      ['401', apiError('UNAUTHORIZED', 401), true, 'sesión expiró'],
      ['IDEMPOTENCY_CONFLICT', apiError('IDEMPOTENCY_CONFLICT', 409), false, 'reutilizar'],
      ['CONFLICT', apiError('CONFLICT', 409), false, 'No se pudo registrar'],
      ['network', new Error('network'), false, 'No se pudo registrar'],
      ['unknown null', null, false, 'No se pudo registrar'],
      ['unknown undefined', undefined, false, 'No se pudo registrar'],
      ['unknown empty', {}, false, 'No se pudo registrar'],
      ['unknown response', { response: {} }, false, 'No se pudo registrar'],
    ] as const)(
      'maps %s to feedback without leaking raw owner state',
      async (_l, error, reauth, copy) => {
        const inbox = setup()
        rejectWith(error, reauth)
        openExpiration(inbox)

        await expect(inbox.resolveExpirationDecision(report)).resolves.toBeUndefined()

        expect(expirationDispatch).toHaveBeenCalledTimes(1)
        expect(inbox.expirationConflict.value).toBe(false)
        expect(inbox.expirationRequiresReauthentication.value).toBe(reauth)
        expect(inbox.expirationErrorMessage.value).toContain(copy)
      },
    )

    it.each(['VERSION_CONFLICT', 'ALREADY_RESOLVED'] as const)(
      'maps %s to a read-only conflict',
      async (code) => {
        const inbox = setup()
        rejectWith(apiError(code, 409))
        openExpiration(inbox)

        await inbox.resolveExpirationDecision(report)

        expect(inbox.expirationConflict.value).toBe(true)
        expect(inbox.expirationErrorMessage.value).toBeNull()
        expect(inbox.expirationRequiresReauthentication.value).toBe(false)
      },
    )

    it('treats a definitive conflict as read-only and does not retry it', async () => {
      const inbox = setup()
      rejectWith(apiError('VERSION_CONFLICT', 409))
      openExpiration(inbox)

      await inbox.resolveExpirationDecision(report)
      expect(inbox.expirationConflict.value).toBe(true)

      await inbox.resolveExpirationDecision(report)
      expect(expirationDispatch).toHaveBeenCalledTimes(1)
    })

    it.each<[string, (inbox: ReturnType<typeof useHumanDecisionsInbox>) => void]>([
      ['a same-id reopen', (inbox) => inbox.openDetail('exp-1')],
      [
        'an A-B-A tenant switch',
        () => {
          authTenantId.value = 'tenant-2'
          authTenantId.value = 'tenant-1'
        },
      ],
      [
        'an auth switch before the inbox continues',
        () => {
          authTenantId.value = 'tenant-2'
        },
      ],
    ])('discards a late completion after %s', async (_l, act) => {
      const gate = deferred<ExpirationDecisionDispatchOutcome>()
      expirationDispatch.mockReturnValue(gate.promise)
      const inbox = setup()
      openExpiration(inbox)
      const pending = inbox.resolveExpirationDecision(report)
      gate.resolve(resolvedOutcome())
      act(inbox)
      await pending
      expect(inbox.expirationSucceeded.value).toBe(false)
      expect(inbox.expirationErrorMessage.value).toBeNull()
    })

    it('discards a late completion after a revoke and accepts a new attempt after restore', async () => {
      const gate = deferred<ExpirationDecisionDispatchOutcome>()
      expirationDispatch.mockReturnValueOnce(gate.promise).mockResolvedValueOnce(resolvedOutcome())
      const inbox = setup()
      openExpiration(inbox)
      const pending = inbox.resolveExpirationDecision(report)
      updateAllowed.value = false
      updateAllowed.value = true
      gate.resolve(resolvedOutcome())
      await pending
      expect(inbox.expirationSucceeded.value).toBe(false)

      await inbox.resolveExpirationDecision(report)
      expect(expirationDispatch).toHaveBeenCalledTimes(2)
      expect(inbox.expirationSucceeded.value).toBe(true)
    })

    it('never dispatches a duplicate while the owner lock is busy', async () => {
      const gate = deferred<ExpirationDecisionDispatchOutcome>()
      expirationDispatch.mockImplementation(() => {
        expirationPending.value = true
        return gate.promise
      })
      const inbox = setup()
      openExpiration(inbox)
      const first = inbox.resolveExpirationDecision(report)
      await inbox.resolveExpirationDecision(report)
      expect(expirationDispatch).toHaveBeenCalledTimes(1)

      expirationPending.value = false
      gate.resolve(resolvedOutcome())
      await first
      expect(inbox.expirationSucceeded.value).toBe(true)
    })

    it('discards a completion after disposal without touching feedback', async () => {
      const gate = deferred<ExpirationDecisionDispatchOutcome>()
      expirationDispatch.mockReturnValue(gate.promise)
      const scope = effectScope()
      const inbox = scope.run(() => useHumanDecisionsInbox())!
      detailState.data.value = pendingExpiration
      inbox.openDetail('exp-1')
      const pending = inbox.resolveExpirationDecision(report)
      scope.stop()
      gate.resolve(resolvedOutcome())
      await pending
      expect(inbox.expirationSucceeded.value).toBe(false)
      expect(inbox.expirationErrorMessage.value).toBeNull()
      expect(inbox.expirationConflict.value).toBe(false)
    })

    it('keeps RESTOCK feedback separate from EXPIRATION feedback', async () => {
      expirationDispatch.mockResolvedValue(resolvedOutcome())
      const inbox = setup()
      detailState.data.value = pendingExpiration
      inbox.openDetail('exp-1')

      await inbox.resolveDecision({
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
        expectedVersion: 1,
      })
      expect(inbox.resolutionErrorMessage.value).toContain('ya no está disponible')

      await inbox.resolveExpirationDecision(report)
      expect(inbox.expirationSucceeded.value).toBe(true)
      expect(inbox.resolutionErrorMessage.value).toContain('ya no está disponible')
      expect(inbox.resolutionSucceeded.value).toBe(false)
      expect(mutateAsync).not.toHaveBeenCalled()
    })

    it('never dispatches or writes feedback from a closed or disposed inbox', async () => {
      const closed = setup()
      detailState.data.value = pendingExpiration
      await closed.resolveExpirationDecision(report)
      const scope = effectScope()
      const disposed = scope.run(() => useHumanDecisionsInbox())!
      disposed.openDetail('exp-1')
      updateAllowed.value = false
      scope.stop()
      await disposed.resolveExpirationDecision(report)
      expect(expirationDispatch).not.toHaveBeenCalled()
      expect(closed.expirationErrorMessage.value).toBeNull()
      expect(disposed.expirationErrorMessage.value).toBeNull()
    })

    it('revalidates permission after the reset callback and skips transport', async () => {
      const inbox = openFresh()
      detailState.data.value = resolvedExpiration(unavailableExpiration)
      await inbox.resolveExpirationDecision(report)
      expect(inbox.expirationErrorMessage.value).toContain(stale)
      detailState.data.value = pendingExpiration
      watch(inbox.expirationErrorMessage, () => (updateAllowed.value = false), { flush: 'sync' })
      await inbox.resolveExpirationDecision(report)
      expect(expirationDispatch).not.toHaveBeenCalled()
    })

    it('publishes 401 feedback atomically across a context switch', async () => {
      rejectWith(apiError('UNAUTHORIZED', 401), true)
      const inbox = openFresh()
      watch(inbox.expirationErrorMessage, () => inbox.openDetail('exp-2'), { flush: 'sync' })
      await inbox.resolveExpirationDecision(report)
      expect(inbox.expirationErrorMessage.value).toBeNull()
      expect(inbox.expirationRequiresReauthentication.value).toBe(false)
    })

    it('blocks a same-context re-entry racing owner cleanup', async () => {
      let calls = 0
      expirationDispatch.mockImplementation(async () => {
        calls++
        expirationPending.value = true
        expirationOwnerError.value = calls === 1 ? apiError('UNAUTHORIZED', 401) : null
        expirationReauth.value = calls === 1
        expirationPending.value = false
        return { status: 'rejected' }
      })
      const inbox = openFresh()
      let reentry: Promise<void> | undefined
      let reentered = false
      watch(
        expirationPending,
        (busy) => {
          if (busy || reentered) return
          reentered = true
          reentry = inbox.resolveExpirationDecision(report)
        },
        { flush: 'sync' },
      )
      const first = inbox.resolveExpirationDecision(report)
      await Promise.allSettled([first, reentry ?? Promise.resolve()])
      expect(expirationDispatch).toHaveBeenCalledTimes(1)
      expect(inbox.expirationRequiresReauthentication.value).toBe(true)
      expect(inbox.expirationErrorMessage.value).toContain('sesión expiró')
    })

    it('lets an old completion leave the replacement lock held', async () => {
      const origin = deferred<ExpirationDecisionDispatchOutcome>()
      const replacement = deferred<ExpirationDecisionDispatchOutcome>()
      expirationDispatch
        .mockReturnValueOnce(origin.promise)
        .mockReturnValueOnce(replacement.promise)
      const inbox = openFresh()
      const first = inbox.resolveExpirationDecision(report)
      authTenantId.value = 'tenant-2'
      const second = inbox.resolveExpirationDecision(report)
      expect(inbox.expirationResolving.value).toBe(true)
      origin.resolve(resolvedOutcome())
      await first
      expect(inbox.expirationResolving.value).toBe(true)
      replacement.resolve(resolvedOutcome())
      await second
      expect(inbox.expirationSucceeded.value).toBe(true)
    })

    it('preserves feedback published by a sync callback during a context reset', async () => {
      const gate = deferred<ExpirationDecisionDispatchOutcome>()
      expirationDispatch.mockReturnValue(gate.promise)
      const inbox = openFresh()
      const pending = inbox.resolveExpirationDecision(report)
      expect(inbox.expirationResolving.value).toBe(true)
      let reentry: Promise<void> | undefined
      let reentered = false
      watch(
        inbox.expirationResolving,
        (busy) => {
          if (busy || reentered) return
          reentered = true
          reentry = inbox.resolveExpirationDecision(report)
        },
        { flush: 'sync' },
      )
      updateAllowed.value = false
      gate.resolve(resolvedOutcome())
      await Promise.allSettled([pending, reentry ?? Promise.resolve()])
      expect(expirationDispatch).toHaveBeenCalledTimes(1)
      expect(inbox.expirationErrorMessage.value).toContain('permiso')
      expect(inbox.expirationSucceeded.value).toBe(false)
    })
  })
})
