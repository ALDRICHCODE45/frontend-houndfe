/**
 * HD2A — typed RESTOCK read transport. Mocks `http`; pins exact URLs/params and
 * the unwrapped page/detail plus the PENDING/RESOLVED projection, resolve
 * payload union, error code and bot-only field omissions.
 */

import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { humanDecisionApi } from '../human-decision.api'
import { http } from '@/core/shared/api/http'
import type {
  HumanDecisionErrorResponse,
  HumanDecisionListParams,
  HumanDecisionListResponse,
  HumanDecisionResolvePayload,
  PendingHumanDecision,
  ProvideRestockEstimateResolution,
  ReportRestockEstimateUnavailableResolution,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn() } }))

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

describe('HD2A · humanDecisionApi', () => {
  beforeEach(() => vi.mocked(http.get).mockReset())

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

  it('getById() GETs /human-decisions/:id and unwraps the resolved detail', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: resolved })

    const result = await humanDecisionApi.getById('hd-2')

    expect(http.get).toHaveBeenCalledWith('/human-decisions/hd-2')
    expect(result).toBe(resolved)
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

    expectTypeOf<PendingHumanDecision>().not.toHaveProperty('sourceRequestId')
    expectTypeOf<PendingHumanDecision>().not.toHaveProperty('supersedesDecisionId')
    expectTypeOf<ResolvedHumanDecision>().not.toHaveProperty('applyBefore')
    expectTypeOf<ResolvedHumanDecision>().not.toHaveProperty('providerMessageId')
  })
})
