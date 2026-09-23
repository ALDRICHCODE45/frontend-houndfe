// useDashboardConfirmedSales.spec.ts — shared security/state boundary for the two
// fixed dashboard sales slots (ODD dashboard-operational-insights OI-5B2 S1).
//
// Two layers run against ONE module graph:
//   1. Config-inspection tests capture the real `useQuery` options, pinning the
//      exact fixed request, the exact key and the signal identity for BOTH kinds.
//   2. Real-transition tests mount the helper inside a VueQueryPlugin QueryClient
//      and drive ACTUAL tenant/permission transitions with deferred promises,
//      proving rows never leak across tenants, revoked data is masked immediately,
//      and the guarded refetch never leaks a late result or error.
//
// Mutation-sensitive: changing a key namespace, sending tenant/branch identity,
// hardcoding a different page size, widening the fixed filters, dropping the
// permission gate, re-introducing placeholder retention, dropping staleTime,
// adding retries, ignoring the TanStack signal, re-sorting rows, exposing any
// public surface (data/items/flags/error) while disabled, returning the raw
// observer result, or dropping the invocation-tenant capture fails these tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, type MaybeRefOrGetter, type Ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin, useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import {
  useDashboardConfirmedSalesQuery,
  type DashboardConfirmedSalesKind,
} from '../useDashboardConfirmedSalesQuery'
import type {
  ConfirmedSaleRow,
  ConfirmedSalesListResponse,
} from '@/features/POS/sales/interfaces/sale.types'

const queryMockState = vi.hoisted(() => ({
  delegateToReal: false,
  capturedResult: null as unknown,
}))

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn((options: unknown) =>
      queryMockState.delegateToReal
        ? (actual.useQuery as unknown as (opts: unknown) => unknown)(options)
        : queryMockState.capturedResult,
    ),
  }
})

vi.mock('@/features/POS/sales/api/sale.api', () => ({
  saleApi: { listConfirmed: vi.fn() },
}))

// The exact, module-owned fixed requests. Hardcoded here (not imported) so a
// drift in the implementation is caught rather than mirrored.
const RECENT_REQUEST = {
  page: 1,
  limit: 5,
  status: ['CONFIRMED'],
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
}

const DEBT_REQUEST = {
  page: 1,
  limit: 5,
  status: ['CONFIRMED'],
  paymentStatus: ['PARTIAL', 'CREDIT'],
  debtMin: 1,
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
}

function row(id: string, overrides: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow {
  return {
    id,
    folio: `A-202605-${id}`,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    totalCents: 10000,
    debtCents: 0,
    confirmedAt: '2026-05-06T14:43:00.000Z',
    dueDate: null,
    customer: null,
    cashier: { id: 'cashier-1', name: 'Caja 1' },
    seller: null,
    paymentMethods: ['CASH'],
    ...overrides,
  }
}

function payload(rows: ConfirmedSaleRow[]): ConfirmedSalesListResponse {
  return {
    data: rows,
    pagination: { page: 1, limit: 5, total: rows.length, totalPages: rows.length > 0 ? 1 : 0 },
    counts: { all: rows.length, pendingPayments: 0, notDelivered: 0 },
    summary: { salesCount: rows.length, totalSoldCents: 0, outstandingDebtCents: 0 },
  }
}

const PAYLOAD = payload([row('sale-1'), row('sale-2')])

interface CapturedQueryOptions {
  queryKey: { value: unknown }
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
  enabled: { value: boolean }
  staleTime: number
  placeholderData: unknown
  retry: unknown
}

interface CapturedQueryResult {
  data: Ref<ConfirmedSalesListResponse | undefined>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<unknown>
  refetch: ReturnType<typeof vi.fn>
}

function setupQueryResult(): CapturedQueryResult {
  const result: CapturedQueryResult = {
    data: ref<ConfirmedSalesListResponse | undefined>(undefined),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref<unknown>(null),
    refetch: vi.fn().mockResolvedValue(undefined),
  }
  queryMockState.delegateToReal = false
  queryMockState.capturedResult = result
  return result
}

function useRealQueryRuntime(): void {
  queryMockState.delegateToReal = true
  queryMockState.capturedResult = null
}

function capturedOptions(): CapturedQueryOptions {
  const calls = vi.mocked(useQuery).mock.calls
  const call = calls[calls.length - 1]
  if (!call) throw new Error('useQuery was not called')
  return call[0] as unknown as CapturedQueryOptions
}

describe('useDashboardConfirmedSalesQuery (ODD dashboard-operational-insights OI-5B2 S1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMockState.delegateToReal = false
  })

  it('pins the exact dashboard-recent key and the exact fixed recent request', async () => {
    setupQueryResult()
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(PAYLOAD)
    const controller = new AbortController()
    const tenant = ref('tenant-1')

    useDashboardConfirmedSalesQuery('recent', { tenantId: () => tenant.value, enabled: true })
    const options = capturedOptions()

    expect(options.queryKey.value).toEqual(['sales', 'tenant-1', 'dashboard-recent'])
    tenant.value = 'tenant-2'
    expect(options.queryKey.value).toEqual(saleQueryKeys.dashboardRecent('tenant-2'))

    await options.queryFn({ signal: controller.signal })
    const [params, opts] = vi.mocked(saleApi.listConfirmed).mock.calls[0] ?? []
    expect(params).toEqual(RECENT_REQUEST)
    expect(Object.keys(params as object)).toEqual([
      'page',
      'limit',
      'status',
      'sortBy',
      'sortOrder',
    ])
    expect(opts?.signal).toBe(controller.signal)
  })

  it('pins the exact dashboard-debt key and the exact fixed debt request', async () => {
    setupQueryResult()
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(PAYLOAD)
    const controller = new AbortController()
    const tenant = ref('tenant-1')

    useDashboardConfirmedSalesQuery('debt', { tenantId: () => tenant.value, enabled: true })
    const options = capturedOptions()

    expect(options.queryKey.value).toEqual(['sales', 'tenant-1', 'dashboard-debt'])
    tenant.value = 'tenant-2'
    expect(options.queryKey.value).toEqual(saleQueryKeys.dashboardDebt('tenant-2'))

    await options.queryFn({ signal: controller.signal })
    const [params, opts] = vi.mocked(saleApi.listConfirmed).mock.calls[0] ?? []
    expect(params).toEqual(DEBT_REQUEST)
    expect(Object.keys(params as object)).toEqual([
      'page',
      'limit',
      'status',
      'paymentStatus',
      'debtMin',
      'sortBy',
      'sortOrder',
    ])
    expect(opts?.signal).toBe(controller.signal)
  })

  it('trims the tenant before it participates in the key', () => {
    setupQueryResult()
    useDashboardConfirmedSalesQuery('recent', { tenantId: '  tenant-1  ', enabled: true })
    expect(capturedOptions().queryKey.value).toEqual(['sales', 'tenant-1', 'dashboard-recent'])
  })

  it('enables only with a non-empty trimmed tenant AND the caller permission flag', () => {
    const cases: Array<{ label: string; tenant: string; enabled: boolean; expected: boolean }> = [
      { label: 'tenant + permission', tenant: 'tenant-1', enabled: true, expected: true },
      { label: 'empty tenant', tenant: '', enabled: true, expected: false },
      { label: 'whitespace tenant', tenant: '   ', enabled: true, expected: false },
      { label: 'permission denied', tenant: 'tenant-1', enabled: false, expected: false },
      { label: 'both missing', tenant: '', enabled: false, expected: false },
    ]

    for (const testCase of cases) {
      setupQueryResult()
      useDashboardConfirmedSalesQuery('recent', {
        tenantId: testCase.tenant,
        enabled: testCase.enabled,
      })
      expect(capturedOptions().enabled.value, testCase.label).toBe(testCase.expected)
    }
  })

  it('reacts to a maybe-reactive permission flag without a new query identity', () => {
    setupQueryResult()
    const permission = ref(false)

    useDashboardConfirmedSalesQuery('debt', {
      tenantId: 'tenant-1',
      enabled: () => permission.value,
    })
    const options = capturedOptions()

    expect(options.enabled.value).toBe(false)
    permission.value = true
    expect(options.enabled.value).toBe(true)
    permission.value = false
    expect(options.enabled.value).toBe(false)
    // Permission is a gate, not an identity: the key must not move.
    expect(options.queryKey.value).toEqual(['sales', 'tenant-1', 'dashboard-debt'])
  })

  it('uses staleTime 30s, no placeholder retention and no automatic retry', () => {
    setupQueryResult()
    useDashboardConfirmedSalesQuery('recent', { tenantId: 'tenant-1', enabled: true })
    const options = capturedOptions()

    expect(options.staleTime).toBe(30_000)
    // Placeholder retention would keep tenant A rows visible while tenant B
    // loads — a cross-tenant disclosure. It must NOT be configured.
    expect(options.placeholderData).toBeUndefined()
    expect(options.retry).toBe(false)
  })

  it('exposes the reviewed surface, masks every field while disabled and preserves backend order', () => {
    const result = setupQueryResult()
    const permission = ref(true)
    const api = useDashboardConfirmedSalesQuery('recent', {
      tenantId: 'tenant-1',
      enabled: () => permission.value,
    })

    expect(new Set(Object.keys(api))).toEqual(
      new Set([
        'data',
        'items',
        'isEmpty',
        'isInitialLoading',
        'isRefetching',
        'isFetching',
        'isError',
        'error',
        'refetch',
        'retry',
      ]),
    )

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    result.data.value = PAYLOAD
    result.isFetching.value = true

    expect(api.data.value).toEqual(PAYLOAD)
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['sale-1', 'sale-2'])
    expect(api.isEmpty.value).toBe(false)
    expect(api.isRefetching.value).toBe(true)
    expect(api.isFetching.value).toBe(true)

    result.isLoading.value = true
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isRefetching.value).toBe(false)

    permission.value = false
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
  })

  it('surfaces error state independently without discarding prior rows', () => {
    const result = setupQueryResult()
    const api = useDashboardConfirmedSalesQuery('debt', { tenantId: 'tenant-1', enabled: true })

    result.data.value = PAYLOAD
    const failure = new Error('contract violation')
    result.isError.value = true
    result.error.value = failure

    expect(api.isError.value).toBe(true)
    expect(api.error.value).toBe(failure)
    expect(api.items.value).toHaveLength(2)
  })

  it('exposes one guarded function under both refetch and retry', async () => {
    const result = setupQueryResult()
    const api = useDashboardConfirmedSalesQuery('recent', { tenantId: 'tenant-1', enabled: true })

    expect(api.refetch).toBe(api.retry)

    result.isFetching.value = true
    await api.refetch()
    expect(result.refetch).not.toHaveBeenCalled()

    result.isFetching.value = false
    await expect(api.refetch()).resolves.toBeUndefined()
    expect(result.refetch).toHaveBeenCalledTimes(1)
  })

  it('rethrows an authorized same-tenant unexpected rejection', async () => {
    const result = setupQueryResult()
    const api = useDashboardConfirmedSalesQuery('recent', { tenantId: 'tenant-1', enabled: true })

    result.refetch.mockRejectedValueOnce(new Error('still authorized'))
    await expect(api.refetch()).rejects.toThrow('still authorized')
  })

  it('swallows an A rejection after a direct switch to authorized tenant B mid-refetch', async () => {
    const result = setupQueryResult()
    const tenant = ref('tenant-A')
    const refetchDeferred = deferred<ConfirmedSalesListResponse>()
    // The underlying transport promise genuinely REJECTS (not a resolved error
    // result) once the tenant has already switched.
    result.refetch.mockReturnValueOnce(refetchDeferred.promise)

    const api = useDashboardConfirmedSalesQuery('recent', {
      tenantId: () => tenant.value,
      enabled: true,
    })

    const pending = api.refetch()
    expect(result.refetch).toHaveBeenCalledTimes(1)

    // Direct switch to a non-empty AUTHORIZED tenant B: `enabled` stays TRUE, so
    // the ONLY reason to swallow the pending rejection is the invocation-tenant
    // capture. Removing `tenantId.value === invocationTenant` fails this test.
    tenant.value = 'tenant-B'

    const lateAError = new Error('late A boom')
    refetchDeferred.reject(lateAError)
    await flushPromises()

    await expect(pending).resolves.toBeUndefined()
    expect(api.isError.value).toBe(false)
    // Tenant A's rejection must never surface under the current tenant B.
    expect(api.error.value).not.toBe(lateAError)
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
  })

  it('never starts a manual request without both tenant and permission', async () => {
    const cases: Array<{ label: string; tenant: string; enabled: boolean }> = [
      { label: 'empty tenant', tenant: '', enabled: true },
      { label: 'whitespace tenant', tenant: '   ', enabled: true },
      { label: 'permission denied', tenant: 'tenant-1', enabled: false },
      { label: 'neither', tenant: '', enabled: false },
    ]

    for (const testCase of cases) {
      const result = setupQueryResult()
      const api = useDashboardConfirmedSalesQuery('recent', {
        tenantId: testCase.tenant,
        enabled: testCase.enabled,
      })

      await api.refetch()
      await api.retry()

      expect(result.refetch, testCase.label).not.toHaveBeenCalled()
    }
  })
})

// ── Real QueryClient transitions ─────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

/** Deterministic hand-off for an in-flight request: nothing resolves until asked. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const mountedWrappers: Array<{ unmount: () => void }> = []

function mountDashboard(
  kind: DashboardConfirmedSalesKind,
  tenantId: MaybeRefOrGetter<string | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
  options: { gcTime?: number; seed?: (client: QueryClient) => void } = {},
) {
  let api: ReturnType<typeof useDashboardConfirmedSalesQuery> | undefined

  const TestComponent = defineComponent({
    setup() {
      api = useDashboardConfirmedSalesQuery(kind, { tenantId, enabled })
      return () => h('div')
    },
  })

  const queryClient = new QueryClient({
    // Default 0 keeps single-key tests self-contained; the "B already cached"
    // scenario raises it so the seeded (inactive until adoption) B query is not
    // evicted before the observer adopts it.
    defaultOptions: { queries: { retry: false, gcTime: options.gcTime ?? 0 } },
  })
  options.seed?.(queryClient)

  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  mountedWrappers.push(wrapper)

  return { api: api as ReturnType<typeof useDashboardConfirmedSalesQuery>, wrapper }
}

const TENANT_A_PAYLOAD = payload([row('A-1'), row('A-2')])
const TENANT_B_PAYLOAD = payload([row('B-1')])

describe('useDashboardConfirmedSalesQuery real QueryClient transitions (OI-5B2 S1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.listConfirmed).mockReset()
    useRealQueryRuntime()
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('issues no request at all for an empty tenant or a denied permission', async () => {
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(TENANT_A_PAYLOAD)

    mountDashboard('recent', ref(''), ref(true))
    await flushPromises()
    mountDashboard('debt', ref('tenant-A'), ref(false))
    await flushPromises()

    expect(vi.mocked(saleApi.listConfirmed)).not.toHaveBeenCalled()
  })

  it('never exposes tenant A rows while tenant B is loading, then shows only B order', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const bDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => bDeferred.promise)

    const { api } = mountDashboard('recent', tenant, permission)

    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['A-1', 'A-2'])
    expect(vi.mocked(saleApi.listConfirmed)).toHaveBeenCalledTimes(1)

    tenant.value = 'tenant-B'

    // Synchronous (no flush/tick): a RAW observer read would still expose tenant
    // A rows because the observer only switches keys on the next watcher flush.
    // The public surface must not.
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isError.value).toBe(false)

    await flushPromises()

    // Tenant B is still in flight: tenant A rows must already be gone.
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    bDeferred.resolve(TENANT_B_PAYLOAD)
    await flushPromises()

    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
    expect(vi.mocked(saleApi.listConfirmed)).toHaveBeenCalledTimes(2)
  })

  it('masks tenant A initial-error surfaces synchronously on a direct switch to B', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const bDeferred = deferred<ConfirmedSalesListResponse>()
    const aError = new Error('A initial boom')

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => Promise.reject(aError))
      .mockImplementationOnce(() => bDeferred.promise)

    const { api } = mountDashboard('recent', tenant, permission)
    await flushPromises()

    expect(api.isError.value).toBe(true)
    expect(api.error.value).toBe(aError)

    tenant.value = 'tenant-B'

    // Synchronous, before any tick/flush: A's error and every flag must be gone.
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    await flushPromises()

    // B owns its own independent initial state.
    expect(api.isError.value).toBe(false)
    // No tenant A error survives; the enabled+adopted surface reports the raw
    // no-error sentinel (`null`), not the previous tenant's error.
    expect(api.error.value).not.toBe(aError)
    expect(api.error.value).toBeNull()
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isFetching.value).toBe(true)

    bDeferred.resolve(TENANT_B_PAYLOAD)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
  })

  it('masks tenant A initial-loading surfaces synchronously on a direct switch to B', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const aDeferred = deferred<ConfirmedSalesListResponse>()
    const bDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => aDeferred.promise)
      .mockImplementationOnce(() => bDeferred.promise)

    const { api } = mountDashboard('recent', tenant, permission)
    await flushPromises()

    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isFetching.value).toBe(true)

    tenant.value = 'tenant-B'

    // Synchronous, before any tick/flush: A's loading must not appear under B.
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    await flushPromises()

    // After adoption B's own loading state is accurate.
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isFetching.value).toBe(true)

    bDeferred.resolve(TENANT_B_PAYLOAD)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])

    aDeferred.resolve(TENANT_A_PAYLOAD)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
  })

  it('masks tenant A refetch rows and flags synchronously on a direct switch to B', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const aRefetchDeferred = deferred<ConfirmedSalesListResponse>()
    const bDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => aRefetchDeferred.promise)
      .mockImplementationOnce(() => bDeferred.promise)

    const { api } = mountDashboard('debt', tenant, permission)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['A-1', 'A-2'])

    const pendingA = api.refetch()
    await flushPromises()
    expect(api.isRefetching.value).toBe(true)
    expect(api.isFetching.value).toBe(true)

    tenant.value = 'tenant-B'

    // Synchronous, before any tick/flush: no A rows, no A refetch flags/error.
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()

    await flushPromises()
    expect(api.isFetching.value).toBe(true)

    bDeferred.resolve(TENANT_B_PAYLOAD)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])

    aRefetchDeferred.resolve(TENANT_A_PAYLOAD)
    await flushPromises()
    await expect(pendingA).resolves.toBeUndefined()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
  })

  it('shows no tenant A surface when B is already cached, then adopts cached B state', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const aDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed).mockImplementationOnce(() => aDeferred.promise)

    const { api } = mountDashboard('recent', tenant, permission, {
      gcTime: 5 * 60_000,
      seed: (client) => {
        client.setQueryData(saleQueryKeys.dashboardRecent('tenant-B'), TENANT_B_PAYLOAD)
      },
    })

    await flushPromises()
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isFetching.value).toBe(true)

    tenant.value = 'tenant-B'

    // Synchronous: B is cached, but the observer is still on A. A data-reference
    // or enabled-only guard would leak A's loading flags/data here.
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()

    await flushPromises()

    // After adoption the cached B data/state is exposed correctly.
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
    expect(api.isEmpty.value).toBe(false)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isError.value).toBe(false)

    aDeferred.resolve(TENANT_A_PAYLOAD)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
  })

  it('masks every public surface immediately on permission revoke, with no extra request', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountDashboard('debt', tenant, permission)

    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['A-1', 'A-2'])
    const callsAfterLoad = vi.mocked(saleApi.listConfirmed).mock.calls.length

    permission.value = false

    // Synchronous (no flush/tick): the mask must apply immediately, before the
    // observer reacts. A RAW read here would still expose tenant A rows/error.
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()

    await flushPromises()

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(vi.mocked(saleApi.listConfirmed).mock.calls.length).toBe(callsAfterLoad)
  })

  it('masks rows when the tenant becomes empty and issues no request for it', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountDashboard('recent', tenant, permission)

    await flushPromises()
    expect(api.items.value).toHaveLength(2)
    const callsAfterLoad = vi.mocked(saleApi.listConfirmed).mock.calls.length

    tenant.value = ''

    // Synchronous (no flush/tick): the empty tenant must mask the surface before
    // the observer reacts. A RAW read would still expose tenant A rows.
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()

    await flushPromises()

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(vi.mocked(saleApi.listConfirmed).mock.calls.length).toBe(callsAfterLoad)
  })

  it('resolves to void on an authorized manual refetch and keeps retry identity', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    vi.mocked(saleApi.listConfirmed).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountDashboard('recent', tenant, permission)
    await flushPromises()

    const result = await api.refetch()

    expect(result).toBeUndefined()
    expect(api.refetch).toBe(api.retry)
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['A-1', 'A-2'])
  })

  it('returns void and stays masked when permission is revoked during an in-flight manual refetch', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const refetchDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => refetchDeferred.promise)

    const { api } = mountDashboard('debt', tenant, permission)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['A-1', 'A-2'])

    const pending = api.refetch()
    await flushPromises()
    expect(vi.mocked(saleApi.listConfirmed)).toHaveBeenCalledTimes(2)
    expect(api.isFetching.value).toBe(true)

    permission.value = false

    // Synchronous (no flush/tick): the raw observer is STILL fetching, so a raw
    // isFetching would be TRUE here. Every public flag/data/error must already be
    // masked before the observer reacts.
    expect(api.isFetching.value).toBe(false)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    await flushPromises()

    refetchDeferred.resolve(TENANT_A_PAYLOAD)
    await flushPromises()

    // The public promise carries NO QueryObserverResult and no data.
    await expect(pending).resolves.toBeUndefined()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(vi.mocked(saleApi.listConfirmed)).toHaveBeenCalledTimes(2)
  })

  it('never surfaces a raw refetch error when permission is revoked mid-flight', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const refetchDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => refetchDeferred.promise)

    const { api } = mountDashboard('recent', tenant, permission)
    await flushPromises()

    const pending = api.refetch()
    await flushPromises()
    permission.value = false
    await flushPromises()

    refetchDeferred.reject(new Error('late boom'))
    await flushPromises()

    await expect(pending).resolves.toBeUndefined()
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
  })

  it('direct A→B with A refetch in flight: A rejects late, promise stays void, no A error under B', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const refetchDeferred = deferred<ConfirmedSalesListResponse>()
    const bDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => refetchDeferred.promise)
      .mockImplementationOnce(() => bDeferred.promise)

    const { api } = mountDashboard('debt', tenant, permission)
    await flushPromises()

    const pending = api.refetch()
    await flushPromises()
    expect(vi.mocked(saleApi.listConfirmed)).toHaveBeenCalledTimes(2)

    tenant.value = 'tenant-B'
    await flushPromises()
    expect(vi.mocked(saleApi.listConfirmed)).toHaveBeenCalledTimes(3)

    const lateError = new Error('late A boom')
    refetchDeferred.reject(lateError)
    await flushPromises()

    await expect(pending).resolves.toBeUndefined()
    expect(api.isError.value).toBe(false)
    // Tenant A's late rejection must never surface under tenant B.
    expect(api.error.value).not.toBe(lateError)
    expect(api.items.value).toEqual([])

    bDeferred.resolve(TENANT_B_PAYLOAD)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
  })

  it('direct A→B resolve-late: A refetch resolves after the switch without mixing rows', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const refetchDeferred = deferred<ConfirmedSalesListResponse>()
    const bDeferred = deferred<ConfirmedSalesListResponse>()

    vi.mocked(saleApi.listConfirmed)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => refetchDeferred.promise)
      .mockImplementationOnce(() => bDeferred.promise)

    const { api } = mountDashboard('recent', tenant, permission)
    await flushPromises()

    const pending = api.refetch()
    await flushPromises()

    tenant.value = 'tenant-B'
    await flushPromises()

    bDeferred.resolve(TENANT_B_PAYLOAD)
    await flushPromises()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])

    refetchDeferred.resolve(payload([row('A-late')]))
    await flushPromises()

    await expect(pending).resolves.toBeUndefined()
    expect(api.items.value.map((r: ConfirmedSaleRow) => r.id)).toEqual(['B-1'])
  })
})
