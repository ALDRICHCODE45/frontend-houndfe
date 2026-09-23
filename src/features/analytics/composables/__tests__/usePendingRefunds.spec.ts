// usePendingRefunds.spec.ts — query identity, tenant/permission guards, fixed
// request shape, signal forwarding, cross-tenant masking and the single guarded
// manual (re)fetch for the pending-refund queue.
//
// Two layers run in this file against ONE module graph:
//   1. Config-inspection tests capture the real `useQuery` options, pinning the
//      key, the fixed request, the guards, the signal and the retry identity.
//   2. Real-transition tests mount the composable inside a VueQueryPlugin
//      QueryClient and drive ACTUAL tenant/permission transitions with deferred
//      promises, proving rows never leak across tenants and revoked data is
//      masked immediately.
//
// Mutation-sensitive: changing the key shape, sending tenant identity to the
// API, hardcoding a page size other than 1/5, ignoring the caller permission
// flag, re-introducing placeholder-data retention, dropping staleTime, adding
// automatic retries, ignoring the TanStack signal, re-sorting rows, exposing any
// public state surface (data/items/flags/error) while disabled, returning the raw
// QueryObserverResult from refetch/retry, or exposing a raw unguarded refetch
// fails these tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, type MaybeRefOrGetter, type Ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin, useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { usePendingRefunds } from '../usePendingRefunds'
import type {
  PendingRefundRow,
  PendingRefundsResponse,
} from '@/features/POS/sales/interfaces/pending-refund.types'

// Shared mock state, hoisted above the module graph so the `useQuery` factory can
// read it at call time: config-inspection tests install a captured fake, while
// transition tests delegate to the REAL useQuery inside a mounted QueryClient.
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
  saleApi: {
    listPendingRefunds: vi.fn(),
  },
}))

const PAYLOAD: PendingRefundsResponse = {
  data: [
    {
      id: 'refund-older',
      saleId: 'sale-1',
      method: 'card_debit',
      amountCents: 50000,
      settledCents: 20000,
      outstandingCents: 30000,
      reason: 'CUSTOMER_REQUEST',
      status: 'PENDING',
      createdAt: '2026-05-06T14:43:00.000Z',
    },
    {
      id: 'refund-newer',
      saleId: 'sale-2',
      method: 'cash',
      amountCents: 12000,
      settledCents: 0,
      outstandingCents: 12000,
      reason: 'OTHER',
      status: 'PENDING',
      createdAt: '2026-05-07T09:15:30.500Z',
    },
  ],
  pagination: { page: 1, limit: 5, total: 2, totalPages: 1 },
}

interface CapturedQueryOptions {
  queryKey: { value: unknown }
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
  enabled: { value: boolean }
  staleTime: number
  placeholderData: unknown
  retry: unknown
}

interface CapturedQueryResult {
  data: Ref<PendingRefundsResponse | undefined>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<unknown>
  refetch: ReturnType<typeof vi.fn>
}

function setupQueryResult(): CapturedQueryResult {
  const result: CapturedQueryResult = {
    data: ref<PendingRefundsResponse | undefined>(undefined),
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

/** Point the shared `useQuery` mock at the REAL runtime for transition tests. */
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

describe('usePendingRefunds (ODD dashboard-operational-insights OI-5B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMockState.delegateToReal = false
  })

  it('normalizes a getter tenant and tracks it independently in the key', () => {
    setupQueryResult()
    const tenant = ref('tenant-1')

    // tenantId arrives as a GETTER: a ref-only implementation
    // (options.tenantId.value) would resolve it to undefined and key on ''.
    usePendingRefunds({ tenantId: () => tenant.value, enabled: true })
    const options = capturedOptions()

    expect(options.queryKey.value).toEqual(['sales', 'tenant-1', 'pending-refunds', 1, 5])

    tenant.value = 'tenant-2'
    expect(options.queryKey.value).toEqual(
      saleQueryKeys.pendingRefunds('tenant-2', { page: 1, limit: 5 }),
    )
  })

  it('trims the tenant before it participates in the key', () => {
    setupQueryResult()

    usePendingRefunds({ tenantId: '  tenant-1  ', enabled: true })

    expect(capturedOptions().queryKey.value).toEqual(['sales', 'tenant-1', 'pending-refunds', 1, 5])
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
      usePendingRefunds({ tenantId: testCase.tenant, enabled: testCase.enabled })
      expect(capturedOptions().enabled.value, testCase.label).toBe(testCase.expected)
    }
  })

  it('reacts to a maybe-reactive permission flag without a new query identity', () => {
    setupQueryResult()
    const permission = ref(false)

    usePendingRefunds({ tenantId: 'tenant-1', enabled: () => permission.value })
    const options = capturedOptions()

    expect(options.enabled.value).toBe(false)
    permission.value = true
    expect(options.enabled.value).toBe(true)
    permission.value = false
    expect(options.enabled.value).toBe(false)
    // Permission is a gate, not an identity: the key must not move.
    expect(options.queryKey.value).toEqual(['sales', 'tenant-1', 'pending-refunds', 1, 5])
  })

  it('requests the fixed { page: 1, limit: 5 } and never the tenant identity', async () => {
    setupQueryResult()
    vi.mocked(saleApi.listPendingRefunds).mockResolvedValue(PAYLOAD)

    usePendingRefunds({ tenantId: 'tenant-1', enabled: true })
    const result = await capturedOptions().queryFn({
      signal: new AbortController().signal,
    })

    expect(result).toBe(PAYLOAD)
    expect(vi.mocked(saleApi.listPendingRefunds)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(saleApi.listPendingRefunds).mock.calls[0]?.[0]
    expect(args).toEqual({ page: 1, limit: 5 })
    expect(Object.keys(args as object)).toEqual(['page', 'limit'])
  })

  it('forwards the TanStack AbortSignal to the transport', async () => {
    setupQueryResult()
    vi.mocked(saleApi.listPendingRefunds).mockResolvedValue(PAYLOAD)
    const controller = new AbortController()

    usePendingRefunds({ tenantId: 'tenant-1', enabled: true })
    await capturedOptions().queryFn({ signal: controller.signal })

    const options = vi.mocked(saleApi.listPendingRefunds).mock.calls[0]?.[1]
    expect(options?.signal).toBe(controller.signal)
  })

  it('uses staleTime 30s, no placeholder-data retention and no automatic retry', () => {
    setupQueryResult()

    usePendingRefunds({ tenantId: 'tenant-1', enabled: true })
    const options = capturedOptions()

    expect(options.staleTime).toBe(30_000)
    // Placeholder retention would keep the PREVIOUS tenant's rows visible while a
    // new tenant loads — a cross-tenant disclosure. It must NOT be configured.
    expect(options.placeholderData).toBeUndefined()
    expect(options.retry).toBe(false)
  })

  it('exposes derived flags and preserves backend row order', () => {
    const result = setupQueryResult()

    const api = usePendingRefunds({ tenantId: 'tenant-1', enabled: true })

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    result.data.value = PAYLOAD
    result.isFetching.value = true
    result.isLoading.value = false

    expect(api.data.value).toEqual(PAYLOAD)
    expect(api.items.value.map((row: PendingRefundRow) => row.id)).toEqual([
      'refund-older',
      'refund-newer',
    ])
    expect(api.isEmpty.value).toBe(false)
    expect(api.isRefetching.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isFetching.value).toBe(true)

    result.isLoading.value = true
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.isRefetching.value).toBe(false)
  })

  it('surfaces error state independently without discarding prior rows', () => {
    const result = setupQueryResult()
    const api = usePendingRefunds({ tenantId: 'tenant-1', enabled: true })

    result.data.value = PAYLOAD
    const failure = new Error('contract violation')
    result.isError.value = true
    result.error.value = failure

    expect(api.isError.value).toBe(true)
    expect(api.error.value).toBe(failure)
    expect(api.items.value).toHaveLength(2)
  })

  it('exposes one guarded function under both refetch and retry names', () => {
    setupQueryResult()

    const api = usePendingRefunds({ tenantId: 'tenant-1', enabled: true })

    expect(api.refetch).toBe(api.retry)
  })

  it('guards the public refetch against in-flight requests and disabled states', async () => {
    const result = setupQueryResult()
    const api = usePendingRefunds({ tenantId: 'tenant-1', enabled: true })

    result.isFetching.value = true
    await api.refetch()
    expect(result.refetch).not.toHaveBeenCalled()

    result.isFetching.value = false
    // The enabled path resolves to void — never the observer result (which carries data).
    await expect(api.refetch()).resolves.toBeUndefined()
    expect(result.refetch).toHaveBeenCalledTimes(1)

    // While the effective guard is still enabled, the underlying rejection is the
    // established error behavior and must keep propagating.
    result.refetch.mockRejectedValueOnce(new Error('still authorized'))
    await expect(api.refetch()).rejects.toThrow('still authorized')
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
      const api = usePendingRefunds({ tenantId: testCase.tenant, enabled: testCase.enabled })

      await api.refetch()
      await api.retry()

      expect(result.refetch, testCase.label).not.toHaveBeenCalled()
    }
  })
})

// ── Real QueryClient transitions (OI-5B1 remediation) ────────────────────────
//
// These tests run the REAL @tanstack/vue-query runtime inside a mounted
// QueryClient (config-inspection tests capture the mocked options instead). They
// drive genuine tenant and permission transitions with deferred promises — no
// sleeps — to prove the two disclosures the verifier found cannot happen:
// tenant A rows must never surface through tenant B's composable state, and
// revoked-permission data must be masked immediately.

function refundRow(id: string, saleId: string, createdAt: string): PendingRefundRow {
  return {
    id,
    saleId,
    method: 'cash',
    amountCents: 10000,
    settledCents: 0,
    outstandingCents: 10000,
    reason: 'OTHER',
    status: 'PENDING',
    createdAt,
  }
}

const TENANT_A_PAYLOAD: PendingRefundsResponse = {
  data: [
    refundRow('A-1', 'sale-a1', '2026-05-06T14:43:00.000Z'),
    refundRow('A-2', 'sale-a2', '2026-05-06T15:00:00.000Z'),
  ],
  pagination: { page: 1, limit: 5, total: 2, totalPages: 1 },
}

const TENANT_B_PAYLOAD: PendingRefundsResponse = {
  data: [refundRow('B-1', 'sale-b1', '2026-05-07T09:15:30.500Z')],
  pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
}

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

function mountPendingRefunds(
  tenantId: MaybeRefOrGetter<string | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  let api: ReturnType<typeof usePendingRefunds> | undefined

  const TestComponent = defineComponent({
    setup() {
      api = usePendingRefunds({ tenantId, enabled })
      return () => h('div')
    },
  })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  mountedWrappers.push(wrapper)

  return { api: api as ReturnType<typeof usePendingRefunds>, wrapper }
}

describe('usePendingRefunds real QueryClient transitions (OI-5B1 remediation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.listPendingRefunds).mockReset()
    useRealQueryRuntime()
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('never exposes tenant A rows while tenant B is loading, then shows only B order', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const bDeferred = deferred<PendingRefundsResponse>()

    // First request (tenant A) resolves immediately; the request the tenant
    // switch triggers (tenant B) stays pending until this test resolves it.
    vi.mocked(saleApi.listPendingRefunds)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => bDeferred.promise)

    const { api } = mountPendingRefunds(tenant, permission)

    await flushPromises()
    expect(api.data.value).toEqual(TENANT_A_PAYLOAD)
    expect(api.items.value.map((row) => row.id)).toEqual(['A-1', 'A-2'])
    expect(vi.mocked(saleApi.listPendingRefunds)).toHaveBeenCalledTimes(1)

    tenant.value = 'tenant-B'
    await flushPromises()

    // Tenant B is still in flight: tenant A rows must already be gone from the
    // public surface (this is the cross-tenant disclosure the verifier found).
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)

    bDeferred.resolve(TENANT_B_PAYLOAD)
    await flushPromises()

    expect(api.data.value).toEqual(TENANT_B_PAYLOAD)
    expect(api.items.value.map((row) => row.id)).toEqual(['B-1'])
    expect(vi.mocked(saleApi.listPendingRefunds)).toHaveBeenCalledTimes(2)
  })

  it('masks data and items immediately when the permission is revoked, with no extra request', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)

    vi.mocked(saleApi.listPendingRefunds).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountPendingRefunds(tenant, permission)

    await flushPromises()
    expect(api.items.value.map((row) => row.id)).toEqual(['A-1', 'A-2'])
    const callsAfterLoad = vi.mocked(saleApi.listPendingRefunds).mock.calls.length

    permission.value = false
    await flushPromises()

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    // Revocation is a pure read-side mask: it must never trigger a request.
    expect(vi.mocked(saleApi.listPendingRefunds).mock.calls.length).toBe(callsAfterLoad)
  })

  it('re-exposes authorized data when the permission is restored, without cross-tenant mixing', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)

    vi.mocked(saleApi.listPendingRefunds).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountPendingRefunds(tenant, permission)

    await flushPromises()
    expect(api.items.value.map((row) => row.id)).toEqual(['A-1', 'A-2'])

    permission.value = false
    await flushPromises()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])

    permission.value = true
    await flushPromises()

    // Authorized tenant-A data is visible again and nothing from another tenant
    // has been mixed in (tenant identity never changed).
    expect(api.items.value.map((row) => row.id)).toEqual(['A-1', 'A-2'])
  })

  it('masks rows when the tenant becomes empty and issues no request for it', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)

    vi.mocked(saleApi.listPendingRefunds).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountPendingRefunds(tenant, permission)

    await flushPromises()
    expect(api.items.value).toHaveLength(2)
    const callsAfterLoad = vi.mocked(saleApi.listPendingRefunds).mock.calls.length

    tenant.value = ''
    await flushPromises()

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(vi.mocked(saleApi.listPendingRefunds).mock.calls.length).toBe(callsAfterLoad)
  })

  // ── In-flight revocation: the public boundary must reveal NOTHING ────────
  //
  // Revocation can land while an authorized request is already in flight. The
  // manual refetch must not hand back the QueryObserverResult (it carries the
  // previous tenant's data), and every public state surface must collapse to its
  // masked value even though TanStack keeps filling its cache underneath.

  it('returns void and stays masked when permission is revoked during an in-flight manual refetch', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const refetchDeferred = deferred<PendingRefundsResponse>()

    vi.mocked(saleApi.listPendingRefunds)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => refetchDeferred.promise)

    const { api } = mountPendingRefunds(tenant, permission)
    await flushPromises()
    expect(api.items.value.map((row) => row.id)).toEqual(['A-1', 'A-2'])

    const pending = api.refetch()
    await flushPromises()
    expect(vi.mocked(saleApi.listPendingRefunds)).toHaveBeenCalledTimes(2)
    expect(api.isFetching.value).toBe(true)

    permission.value = false
    await flushPromises()

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()

    refetchDeferred.resolve(TENANT_A_PAYLOAD)
    await flushPromises()

    // The public promise carries NO QueryObserverResult and no data.
    await expect(pending).resolves.toBeUndefined()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isFetching.value).toBe(false)
    expect(vi.mocked(saleApi.listPendingRefunds)).toHaveBeenCalledTimes(2)
  })

  it('never surfaces a raw refetch error when permission is revoked mid-flight', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const refetchDeferred = deferred<PendingRefundsResponse>()

    vi.mocked(saleApi.listPendingRefunds)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => refetchDeferred.promise)

    const { api } = mountPendingRefunds(tenant, permission)
    await flushPromises()
    expect(api.items.value.map((row) => row.id)).toEqual(['A-1', 'A-2'])

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
    expect(api.isFetching.value).toBe(false)
  })

  it('masks error state the moment permission is revoked after an authorized failure', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const failure = new Error('contract violation')

    vi.mocked(saleApi.listPendingRefunds).mockRejectedValue(failure)

    const { api } = mountPendingRefunds(tenant, permission)
    await flushPromises()

    // Authorized path still reports the real failure.
    expect(api.isError.value).toBe(true)
    expect(api.error.value).toBe(failure)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)

    permission.value = false
    await flushPromises()

    // Revoked path reveals neither the error nor any activity flag.
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
  })

  it('masks every public flag and returns void when the tenant becomes empty mid-flight', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)
    const refetchDeferred = deferred<PendingRefundsResponse>()

    vi.mocked(saleApi.listPendingRefunds)
      .mockImplementationOnce(() => Promise.resolve(TENANT_A_PAYLOAD))
      .mockImplementationOnce(() => refetchDeferred.promise)

    const { api } = mountPendingRefunds(tenant, permission)
    await flushPromises()
    expect(api.items.value).toHaveLength(2)
    const callsAfterLoad = vi.mocked(saleApi.listPendingRefunds).mock.calls.length

    const pending = api.refetch()
    await flushPromises()
    expect(vi.mocked(saleApi.listPendingRefunds).mock.calls.length).toBe(callsAfterLoad + 1)

    tenant.value = ''
    await flushPromises()

    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.isRefetching.value).toBe(false)
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()

    refetchDeferred.resolve(TENANT_A_PAYLOAD)
    await flushPromises()

    await expect(pending).resolves.toBeUndefined()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(vi.mocked(saleApi.listPendingRefunds).mock.calls.length).toBe(callsAfterLoad + 1)
  })

  it('resolves to void (no observer result) on an authorized manual refetch and keeps retry identity', async () => {
    const tenant = ref('tenant-A')
    const permission = ref(true)

    vi.mocked(saleApi.listPendingRefunds).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountPendingRefunds(tenant, permission)
    await flushPromises()

    const result = await api.refetch()

    expect(result).toBeUndefined()
    expect(api.refetch).toBe(api.retry)
    expect(api.items.value.map((row) => row.id)).toEqual(['A-1', 'A-2'])
  })

  it('keeps the guarded manual refetch a no-op for an unauthorized tenant', async () => {
    const tenant = ref('')
    const permission = ref(false)

    vi.mocked(saleApi.listPendingRefunds).mockResolvedValue(TENANT_A_PAYLOAD)

    const { api } = mountPendingRefunds(tenant, permission)
    await flushPromises()

    const result = await api.refetch()

    expect(result).toBeUndefined()
    expect(vi.mocked(saleApi.listPendingRefunds)).not.toHaveBeenCalled()
    expect(api.isFetching.value).toBe(false)
    expect(api.isError.value).toBe(false)
    expect(api.error.value).toBeUndefined()
    expect(api.data.value).toBeUndefined()
    expect(api.items.value).toEqual([])
    expect(api.isEmpty.value).toBe(true)
  })
})
