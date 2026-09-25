import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { AxiosError } from 'axios'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { humanDecisionApi } from '../../api/human-decision.api'
import type {
  HumanDecisionErrorResponse,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'
import {
  createHumanDecisionResolutionAttempt,
  type HumanDecisionResolutionAttempt,
} from '../../utils/humanDecisionResolutionAttempt'
import { useResolveHumanDecision } from '../useResolveHumanDecision'

vi.mock('../../api/human-decision.api', () => ({
  humanDecisionApi: { resolve: vi.fn() },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

const resolved: ResolvedHumanDecision = {
  id: 'decision-1',
  type: 'RESTOCK',
  title: 'Solicitud de reposición',
  sanitizedSummary: 'Se solicitó una estimación.',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'RESOLVED',
  version: 2,
  allowedActions: [],
  resolution: {
    action: 'PROVIDE_RESTOCK_ESTIMATE',
    restockDays: 3,
    resolvedAt: '2026-01-01T01:00:00.000Z',
    resolvedBy: { id: 'user-1', displayName: 'Ana' },
  },
  snapshot: {
    branchId: 'branch-1',
    branchName: 'Centro',
    productId: 'product-1',
    productName: 'Alimento',
    variantId: null,
    sku: null,
    requestedQuantity: 2,
    observedStockAtRequest: null,
    stockObservedAt: null,
  },
}

function mountMutation(queryClient = new QueryClient()) {
  let result!: ReturnType<typeof useResolveHumanDecision>
  const Host = defineComponent({
    setup() {
      result = useResolveHumanDecision()
      return () => h('div')
    },
  })
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { result, queryClient, wrapper }
}

function conflict(
  code: 'VERSION_CONFLICT' | 'ALREADY_RESOLVED' | 'IDEMPOTENCY_CONFLICT',
): AxiosError<HumanDecisionErrorResponse> {
  return {
    response: {
      status: 409,
      data: { statusCode: 409, code, message: 'Conflict' },
    },
  } as AxiosError<HumanDecisionErrorResponse>
}

describe('createHumanDecisionResolutionAttempt', () => {
  it('creates one positive UUID identity and exact CAS payload', () => {
    const generateId = vi.fn(() => '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197')
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3, expectedVersion: 1 },
      generateId,
    )
    expect(generateId).toHaveBeenCalledTimes(1)
    expect(attempt).toEqual({
      decisionId: 'decision-1',
      payload: {
        action: 'PROVIDE_RESTOCK_ESTIMATE',
        restockDays: 3,
        expectedVersion: 1,
        resolutionRequestId: '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197',
      },
    })
  })

  it('omits restockDays from the negative attempt', () => {
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 },
      () => '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
    )
    expect(attempt.payload).toEqual({
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
      resolutionRequestId: '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
    })
    expect(attempt.payload).not.toHaveProperty('restockDays')
  })
})

describe('useResolveHumanDecision', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not update optimistically, then stores server detail and invalidates stable keys', async () => {
    let finish!: (value: ResolvedHumanDecision) => void
    vi.mocked(humanDecisionApi.resolve).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result, queryClient, wrapper } = mountMutation()
    const setQueryData = vi.spyOn(queryClient, 'setQueryData')
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3, expectedVersion: 1 },
      () => '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197',
    )

    const request = result.mutateAsync(attempt)
    expect(setQueryData).not.toHaveBeenCalled()
    finish(resolved)
    await expect(request).resolves.toBe(resolved)

    expect(humanDecisionApi.resolve).toHaveBeenCalledWith('decision-1', attempt.payload)
    expect(setQueryData).toHaveBeenCalledWith(
      humanDecisionQueryKeys.detail('tenant-1', 'decision-1'),
      resolved,
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: humanDecisionQueryKeys.listPrefix('tenant-1'),
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: humanDecisionQueryKeys.detail('tenant-1', 'decision-1'),
    })
    wrapper.unmount()
  })

  it.each(['VERSION_CONFLICT', 'ALREADY_RESOLVED'] as const)(
    'refetches list and detail on %s and keeps the attempt reusable',
    async (code) => {
      const attempt: HumanDecisionResolutionAttempt = createHumanDecisionResolutionAttempt(
        'decision-1',
        { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 },
        () => '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
      )
      vi.mocked(humanDecisionApi.resolve).mockRejectedValue(conflict(code))
      const { result, queryClient, wrapper } = mountMutation()
      const refetch = vi.spyOn(queryClient, 'refetchQueries')

      await expect(result.mutateAsync(attempt)).rejects.toBeDefined()
      expect(refetch).toHaveBeenCalledWith({
        queryKey: humanDecisionQueryKeys.listPrefix('tenant-1'),
      })
      expect(refetch).toHaveBeenCalledWith({
        queryKey: humanDecisionQueryKeys.detail('tenant-1', 'decision-1'),
      })
      expect(attempt.payload.resolutionRequestId).toBe('7d4101dd-c50e-43e6-8ff8-9b4229b912f0')
      wrapper.unmount()
    },
  )

  it('reuses the same UUID when the caller retries one logical attempt', async () => {
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3, expectedVersion: 1 },
      () => '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197',
    )
    vi.mocked(humanDecisionApi.resolve).mockResolvedValue(resolved)
    const { result, wrapper } = mountMutation()
    await result.mutateAsync(attempt)
    await result.mutateAsync(attempt)
    expect(humanDecisionApi.resolve).toHaveBeenNthCalledWith(1, 'decision-1', attempt.payload)
    expect(humanDecisionApi.resolve).toHaveBeenNthCalledWith(2, 'decision-1', attempt.payload)
    wrapper.unmount()
  })

  it('does not refetch current state for an idempotency conflict', async () => {
    const attempt = createHumanDecisionResolutionAttempt(
      'decision-1',
      { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 },
      () => '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
    )
    vi.mocked(humanDecisionApi.resolve).mockRejectedValue(conflict('IDEMPOTENCY_CONFLICT'))
    const { result, queryClient, wrapper } = mountMutation()
    const refetch = vi.spyOn(queryClient, 'refetchQueries')
    await expect(result.mutateAsync(attempt)).rejects.toBeDefined()
    expect(refetch).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
