// useEligibleSales.spec.ts — STRICT-TDD tests for the server-searched,
// server-paginated eligible-sales composable (T3 S3, backend contract
// GET /delivery-routes/eligible-sales).
//
// Contract under test:
//   - GET /delivery-routes/eligible-sales with { page, limit, q?, contextRouteId? }.
//   - page defaults to 1, limit defaults to 20 and is clamped to 1..100,
//     q is trimmed and clamped to 200 chars.
//   - Exposes the authoritative pagination envelope { page, limit, total, totalPages }.
//   - Cache key prefix ['delivery-routes', tenantId, 'eligible-sales'] is the
//     slot the create mutation invalidates on a 409 conflict.
//
// The tests mock the HTTP layer (`http.get`) so the REAL composable runs — the
// network is never touched.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

const { getMock, tenantIdRef } = vi.hoisted(() => ({
  getMock: vi.fn(),
  tenantIdRef: { value: 'tenant-1' },
}))

vi.mock('@/core/shared/api/http', () => ({
  http: { get: getMock },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: tenantIdRef.value }),
}))

import {
  useEligibleSales,
  eligibleSalesQueryKeys,
  normalizeEligibleSalesQuery,
  settleRefreshResult,
} from '../useEligibleSales'
import type { EligibleSaleRow, EligibleSalesResponse } from '../../interfaces/eligible-sales.types'

function makeRow(overrides: Partial<EligibleSaleRow> = {}): EligibleSaleRow {
  return {
    id: 'sale-1',
    folio: 'A-202610-000003',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'PENDING',
    totalCents: 127000,
    debtCents: 0,
    confirmedAt: '2026-10-07T15:37:46.000Z',
    dueDate: null,
    customer: { id: 'cust-1', name: 'Cliente A' },
    shippingAddress: {
      id: 'addr-1',
      label: 'Casa',
      street: 'Av. Reforma',
      exteriorNumber: '10',
      interiorNumber: null,
      neighborhood: 'Centro',
      municipality: 'Cuauhtémoc',
      city: 'CDMX',
      state: 'CDMX',
      zipCode: '06000',
    },
    productSummary: ['Cemento 50kg'],
    availability: { state: 'AVAILABLE' },
    ...overrides,
  }
}

function makeResponse(overrides: Partial<EligibleSalesResponse> = {}): EligibleSalesResponse {
  return {
    data: [makeRow()],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    ...overrides,
  }
}

const wrappers: VueWrapper[] = []

type RunOpts = {
  page?: number | Ref<number>
  limit?: number | Ref<number>
  q?: string | Ref<string>
  contextRouteId?: string
}

function run(opts: RunOpts = {}) {
  const page = typeof opts.page === 'object' ? opts.page : ref(opts.page ?? 1)
  const limit = typeof opts.limit === 'object' ? opts.limit : ref(opts.limit ?? 20)
  const q = typeof opts.q === 'object' ? opts.q : ref(opts.q ?? '')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } },
  })
  let result!: ReturnType<typeof useEligibleSales>
  const Test = defineComponent({
    setup() {
      result = useEligibleSales(() => ({
        page: page.value,
        limit: limit.value,
        q: q.value,
        contextRouteId: opts.contextRouteId,
      }))
      return () => h('div')
    },
  })
  const wrapper = mount(Test, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  wrappers.push(wrapper)
  return { result, queryClient, page, limit, q }
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockResolvedValue({ data: makeResponse() })
  tenantIdRef.value = 'tenant-1'
})

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
})

describe('normalizeEligibleSalesQuery (pure param contract)', () => {
  it('defaults page=1 and limit=20 and omits an empty q', () => {
    expect(normalizeEligibleSalesQuery({})).toMatchObject({ page: 1, limit: 20 })
    expect(normalizeEligibleSalesQuery({}).q).toBeUndefined()
  })

  it('clamps page to >= 1 and limit into 1..100', () => {
    expect(normalizeEligibleSalesQuery({ page: 0 }).page).toBe(1)
    expect(normalizeEligibleSalesQuery({ page: -5 }).page).toBe(1)
    expect(normalizeEligibleSalesQuery({ limit: 0 }).limit).toBe(1)
    expect(normalizeEligibleSalesQuery({ limit: 500 }).limit).toBe(100)
  })

  it('trims the query and clamps it to 200 chars', () => {
    expect(normalizeEligibleSalesQuery({ q: '  A-000003  ' }).q).toBe('A-000003')
    expect(normalizeEligibleSalesQuery({ q: 'x'.repeat(250) }).q).toHaveLength(200)
  })

  it('keeps contextRouteId only when provided', () => {
    expect(normalizeEligibleSalesQuery({ contextRouteId: 'route-1' }).contextRouteId).toBe('route-1')
    expect(normalizeEligibleSalesQuery({}).contextRouteId).toBeUndefined()
  })
})

describe('useEligibleSales — server contract', () => {
  it('calls GET /delivery-routes/eligible-sales with page + limit defaults', async () => {
    const { result } = run()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))

    expect(getMock).toHaveBeenCalledTimes(1)
    const [url, config] = getMock.mock.calls[0] as [string, { params: Record<string, unknown> }]
    expect(url).toBe('/delivery-routes/eligible-sales')
    expect(config.params).toEqual({ page: 1, limit: 20 })
  })

  it('exposes the authoritative pagination envelope', async () => {
    getMock.mockResolvedValue({
      data: makeResponse({ pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }),
    })
    const { result } = run()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))
    expect(result.pagination.value).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 })
    expect(result.totalCount.value).toBe(45)
    expect(result.pageCount.value).toBe(3)
  })

  it('sends q and contextRouteId when present', async () => {
    const { result } = run({ q: 'Reforma', contextRouteId: 'route-9' })
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))

    const [, config] = getMock.mock.calls[0] as [string, { params: Record<string, unknown> }]
    expect(config.params).toEqual({ page: 1, limit: 20, q: 'Reforma', contextRouteId: 'route-9' })
  })

  it('re-queries with the new page when the page ref changes', async () => {
    const { result, page } = run()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))

    page.value = 2
    await nextTick()
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))

    const [, config] = getMock.mock.calls[1] as [string, { params: Record<string, unknown> }]
    expect(config.params).toMatchObject({ page: 2 })
  })

  it('surfaces isError when the request fails', async () => {
    getMock.mockRejectedValue(new Error('boom'))
    const { result } = run()
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    expect(result.data.value).toEqual([])
  })

  it('uses the tenant-prefixed cache key the mutation invalidates on conflict', async () => {
    const { result, queryClient } = run()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))
    const keys = queryClient.getQueryCache().findAll().map((q) => q.queryKey)
    expect(keys).toHaveLength(1)
    expect(keys[0]!.slice(0, 3)).toEqual(['delivery-routes', 'tenant-1', 'eligible-sales'])
    expect(eligibleSalesQueryKeys.listPrefix('tenant-1')).toEqual([
      'delivery-routes',
      'tenant-1',
      'eligible-sales',
    ])
  })

  it('refresh() refetches the current page', async () => {
    const { result } = run()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))
    result.refresh()
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
  })
})

// ─── Fix 1 — refresh must REPORT failure instead of discarding the result ────
describe('refresh failure signaling (fix 1)', () => {
  it('settleRefreshResult maps a REJECTED refetch promise to ok:false', async () => {
    const outcome = await settleRefreshResult(async () => {
      throw new Error('rejected')
    })
    expect(outcome.ok).toBe(false)
  })

  it('settleRefreshResult maps a RESOLVED error result to ok:false (no masking)', async () => {
    const outcome = await settleRefreshResult(async () => ({ isError: true }))
    expect(outcome.ok).toBe(false)
  })

  it('settleRefreshResult maps a resolved success result to ok:true with data', async () => {
    const outcome = await settleRefreshResult<EligibleSalesResponse>(async () => ({
      isError: false,
      data: makeResponse(),
    }))
    expect(outcome.ok).toBe(true)
    expect(outcome.data?.data).toHaveLength(1)
  })

  it('refresh() reports ok:false when the authoritative request rejects', async () => {
    const { result } = run()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))
    getMock.mockRejectedValue(new Error('network'))
    await expect(result.refresh()).resolves.toMatchObject({ ok: false })
  })

  it('refresh() reports ok:true with fresh rows on success', async () => {
    const { result } = run()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))
    await expect(result.refresh()).resolves.toMatchObject({ ok: true })
  })
})
