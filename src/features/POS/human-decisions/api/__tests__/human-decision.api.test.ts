/**
 * HD2A — typed RESTOCK read transport. Mocks `http`; pins exact URLs/params and
 * the unwrapped page/detail plus the PENDING/RESOLVED projection, resolve
 * payload union, error code and bot-only field omissions.
 */

import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { humanDecisionApi } from '../human-decision.api'
import { http } from '@/core/shared/api/http'
import type {
  HumanDecision,
  HumanDecisionErrorCode,
  HumanDecisionErrorResponse,
  HumanDecisionListParams,
  HumanDecisionListResponse,
  HumanDecisionResolvePayload,
  HumanDecisionType,
  PendingHumanDecision,
  ProvideRestockEstimateResolution,
  ReportRestockEstimateUnavailableResolution,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'
import {
  pendingExpiration,
  provideExpiration,
  resolvedExpiration,
} from '../../interfaces/__tests__/expirationDecision.fixture'
import type { ExpirationDecisionResolvePayload } from '../../interfaces/expiration-decision.types'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))

const resolver = { id: 'user-1', displayName: 'Ana' }

const pending: PendingHumanDecision = {
  id: 'hd-1',
  type: 'RESTOCK',
  title: 'Reposición solicitada',
  sanitizedSummary: 'Kibble 15kg',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'PENDING',
  version: 1,
  resolution: null,
  allowedActions: ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'],
  snapshot: {
    branchId: 'branch-1',
    branchName: null,
    productId: 'product-1',
    productName: 'Kibble 15kg',
    variantId: null,
    sku: 'KIB-15',
    requestedQuantity: 2,
    observedStockAtRequest: 0,
    stockObservedAt: '2026-01-01T00:00:00.000Z',
  },
}

const negativeResolution: ReportRestockEstimateUnavailableResolution = {
  action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
  resolvedAt: '2026-01-01T01:00:00.000Z',
  resolvedBy: resolver,
}

const positiveResolution: ProvideRestockEstimateResolution = {
  action: 'PROVIDE_RESTOCK_ESTIMATE',
  restockDays: 3,
  resolvedAt: '2026-01-01T01:00:00.000Z',
  resolvedBy: resolver,
}

const resolved: ResolvedHumanDecision = {
  ...pending,
  id: 'hd-2',
  status: 'RESOLVED',
  version: 2,
  allowedActions: [],
  resolution: negativeResolution,
}

describe('HD2A/HD4A · humanDecisionApi', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(http.post).mockReset()
  })

  it('list() GETs /human-decisions with exact PENDING params and unwraps', async () => {
    const response: HumanDecisionListResponse = {
      data: [pending],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    }
    vi.mocked(http.get).mockResolvedValue({ data: response })
    const params = {
      status: 'PENDING',
      page: 1,
      limit: 20,
      search: 'kibble',
      sortBy: 'createdAt',
      sortOrder: 'asc',
    } satisfies HumanDecisionListParams

    const result = await humanDecisionApi.list(params)

    expect(http.get).toHaveBeenCalledWith('/human-decisions', { params })
    expect(result).toBe(response)
  })

  it('list() sends ALL without sort fields and preserves the mixed envelope', async () => {
    const response = {
      data: [pending, resolved],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 42, pageCount: 3 },
    }
    vi.mocked(http.get).mockResolvedValue({ data: response })
    expect(await humanDecisionApi.list({ status: 'ALL', page: 1, limit: 20 })).toBe(response)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/human-decisions', {
      params: { status: 'ALL', page: 1, limit: 20 },
    })
  })

  it('list() sends the fixed resolved contract and unwraps the page', async () => {
    const response = {
      data: [resolved],
      pagination: { pageIndex: 1, pageSize: 50, totalCount: 51, pageCount: 2 },
    }
    vi.mocked(http.get).mockResolvedValue({ data: response })
    const params = {
      status: 'RESOLVED',
      page: 2,
      limit: 50,
      search: 'kibble',
      sortBy: 'resolvedAt',
      sortOrder: 'desc',
    } as const
    expect(await humanDecisionApi.list(params)).toBe(response)
    expect(http.get).toHaveBeenCalledWith('/human-decisions', { params })
  })

  it('getById() GETs /human-decisions/:id and unwraps the resolved detail', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: resolved })

    const result = await humanDecisionApi.getById('hd-2')

    expect(http.get).toHaveBeenCalledWith('/human-decisions/hd-2', expect.anything())
    expect(result).toBe(resolved)
  })

  it('list() forwards only the read signal and keeps URLs/params intact', async () => {
    const response: HumanDecisionListResponse = {
      data: [pending],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    }
    vi.mocked(http.get).mockResolvedValue({ data: response })
    const controller = new AbortController()
    const params = {
      status: 'PENDING',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    } satisfies HumanDecisionListParams

    await humanDecisionApi.list(params, { signal: controller.signal })

    expect(http.get).toHaveBeenCalledExactlyOnceWith('/human-decisions', {
      params,
      signal: controller.signal,
    })
  })

  it('getById() forwards the read signal and keeps the exact URL', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: pending })
    const controller = new AbortController()

    await humanDecisionApi.getById('hd-1', { signal: controller.signal })

    expect(http.get).toHaveBeenCalledExactlyOnceWith('/human-decisions/hd-1', {
      signal: controller.signal,
    })
  })

  it('preserves the mixed server order and unwraps an EXPIRATION page', async () => {
    const response = {
      data: [pending, pendingExpiration, resolved, resolvedExpiration(provideExpiration)],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 4, pageCount: 1 },
    }
    vi.mocked(http.get).mockResolvedValue({ data: response })
    const result = await humanDecisionApi.list({ status: 'ALL', page: 1, limit: 20 })
    expect(result).toBe(response)
    expect(result.data.map((row) => row.type)).toEqual([
      'RESTOCK',
      'EXPIRATION',
      'RESTOCK',
      'EXPIRATION',
    ])
  })

  it.each([pendingExpiration, resolvedExpiration(provideExpiration)])(
    'getById() unwraps the EXPIRATION $id detail',
    async (row) => {
      vi.mocked(http.get).mockResolvedValue({ data: row })
      const result = await humanDecisionApi.getById(row.id)
      expect(result).toBe(row)
      expect(result.type).toBe('EXPIRATION')
    },
  )

  it.each([
    {
      payload: {
        action: 'PROVIDE_RESTOCK_ESTIMATE',
        restockDays: 3,
        expectedVersion: 1,
        resolutionRequestId: '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197',
      } as const,
      response: { ...resolved, resolution: positiveResolution },
    },
    {
      payload: {
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
        expectedVersion: 1,
        resolutionRequestId: '7d4101dd-c50e-43e6-8ff8-9b4229b912f0',
      } as const,
      response: resolved,
    },
  ])(
    'resolve() POSTs the exact $payload.action body and unwraps',
    async ({ payload, response }) => {
      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await humanDecisionApi.resolve('hd-2', payload)

      expect(http.post).toHaveBeenCalledWith('/human-decisions/hd-2/resolve', payload)
      expect(result).toBe(response)
    },
  )
  it('resolveExpiration() POSTs the exact EXPIRATION payload with the opt-in flag and unwraps', async () => {
    const response = resolvedExpiration(provideExpiration)
    vi.mocked(http.post).mockResolvedValue({ data: response })
    const payload = {
      action: 'PROVIDE_EXPIRATION_TEXT',
      expirationText: 'Consumir antes del 20 de marzo de 2026.',
      expectedVersion: 1,
      resolutionRequestId: 'a1b2c3d4-0000-4000-8000-000000000001',
    } satisfies ExpirationDecisionResolvePayload

    const result = await humanDecisionApi.resolveExpiration('exp-1', payload)

    expect(http.post).toHaveBeenCalledWith('/human-decisions/exp-1/resolve', payload, {
      expirationResolveIsolation: true,
    })
    expect(result).toBe(response)
  })

  it('resolve() RESTOCK call carries no EXPIRATION opt-in flag', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: resolved })

    await humanDecisionApi.resolve('hd-2', {
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
      resolutionRequestId: 'b1b2c3d4-0000-4000-8000-000000000002',
    })

    expect(http.post).toHaveBeenCalledWith('/human-decisions/hd-2/resolve', expect.anything())
    expect(vi.mocked(http.post).mock.calls[0]).toHaveLength(2)
  })

  it('resolveExpiration() propagates the API error untouched', async () => {
    const error = new Error('unauthorized')
    vi.mocked(http.post).mockRejectedValue(error)

    await expect(
      humanDecisionApi.resolveExpiration('exp-1', {
        action: 'REPORT_EXPIRATION_UNAVAILABLE',
        expectedVersion: 1,
        resolutionRequestId: 'c1b2c3d4-0000-4000-8000-000000000003',
      }),
    ).rejects.toBe(error)
  })
})

describe('WU3 · public read union', () => {
  it('admits EXPIRATION rows while RESTOCK rows stay pinned', () => {
    expectTypeOf<HumanDecisionType>().toEqualTypeOf<'RESTOCK' | 'EXPIRATION'>()
    expectTypeOf(pending.type).toEqualTypeOf<'RESTOCK'>()
    const restock: HumanDecision[] = [pending, resolved]
    const expired: HumanDecision[] = [pendingExpiration, resolvedExpiration(provideExpiration)]
    expect([...restock, ...expired].map((row) => row.type)).toEqual([
      'RESTOCK',
      'RESTOCK',
      'EXPIRATION',
      'EXPIRATION',
    ])
    const expiration = expired[0]
    if (expiration?.type === 'EXPIRATION') {
      expectTypeOf(expiration.snapshot.unit).toEqualTypeOf<string>()
    }
  })
})

describe('HD2A · typed RESTOCK contract', () => {
  it('pins both discriminants, the resolve union, error code and omissions', () => {
    expectTypeOf(pending.status).toEqualTypeOf<'PENDING'>()
    expectTypeOf(pending.version).toEqualTypeOf<1>()
    expectTypeOf(pending.resolution).toBeNull()

    expectTypeOf(resolved.status).toEqualTypeOf<'RESOLVED'>()
    expectTypeOf(resolved.version).toEqualTypeOf<2>()
    expectTypeOf(resolved.allowedActions).toEqualTypeOf<[]>()
    expectTypeOf(positiveResolution.restockDays).toEqualTypeOf<number>()
    expectTypeOf(negativeResolution).not.toHaveProperty('restockDays')

    const providePayload = {
      action: 'PROVIDE_RESTOCK_ESTIMATE',
      restockDays: 3,
      expectedVersion: 1,
      resolutionRequestId: 'uuid-1',
    } satisfies HumanDecisionResolvePayload
    const unavailablePayload = {
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
      resolutionRequestId: 'uuid-2',
    } satisfies HumanDecisionResolvePayload
    expectTypeOf(providePayload.restockDays).toEqualTypeOf<number>()
    expectTypeOf(unavailablePayload).not.toHaveProperty('restockDays')

    const error = {
      statusCode: 409,
      code: 'VERSION_CONFLICT',
      message: 'Conflict',
    } satisfies HumanDecisionErrorResponse
    expectTypeOf(error.code).toEqualTypeOf<'VERSION_CONFLICT'>()
    const wireCodes = [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'IDEMPOTENCY_CONFLICT',
      'VERSION_CONFLICT',
      'ALREADY_RESOLVED',
      'CONFLICT',
      'RATE_LIMITED',
      'REQUEST_ERROR',
      'INTERNAL_ERROR',
    ] satisfies HumanDecisionErrorCode[]
    expectTypeOf<HumanDecisionErrorCode>().toEqualTypeOf<(typeof wireCodes)[number]>()
    expect(wireCodes).toHaveLength(11)

    expectTypeOf<PendingHumanDecision>().not.toHaveProperty('sourceRequestId')
    expectTypeOf<PendingHumanDecision>().not.toHaveProperty('supersedesDecisionId')
    expectTypeOf<ResolvedHumanDecision>().not.toHaveProperty('applyBefore')
    expectTypeOf<ResolvedHumanDecision>().not.toHaveProperty('providerMessageId')
  })
})
