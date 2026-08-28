// useDriverActiveRoutes.spec.ts — STRICT-TDD tests for the driver list composable.
//
// Contract (sdd delivery-routes S6a, design.md §6.2, REQ-DRM-002 driver side):
//   - Plain `useQuery` over `GET /delivery-routes?status=ACTIVE`.
//   - NO `driverUserId` param: CASL scopes server-side; the client never sends a
//     driver-scoped filter (REQ-AUTH-DR-005, design §6.4 / §13.1).
//   - queryKey: `deliveryRouteQueryKeys.list(tenantId, { status: 'ACTIVE' })`.
//   - Returns `data: Ref<DeliveryRouteResponseDto[]>` (NOT the paginated envelope
//     used by the manager branch — the driver branch is card-first, server-scoped).
//   - NO client filter (the server returns only the driver's routes per CASL).
//   - Invalidation is shared with the rest of the module via
//     `deliveryRouteQueryKeys.listPrefix(tenantId)` (every mutation in S4c/S5a/S5b
//     invalidates that prefix; this query will refetch automatically).
//
// We mock `useQuery` so the spec owns the key shape and the queryFn signature
// without mounting a real QueryClient — mirrors `useSalePaymentMethods.spec.ts`.

// @ts-nocheck — composable binding tests mock TanStack's useQuery with a plain
// object whose typing is intentionally loose; the production source is the
// source of truth for the real Vue-Query binding.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted test state — vi.mock factories run BEFORE top-level statements,
// so all shared mock state must be created via vi.hoisted() (plain JS only —
// no `ref()`/`computed()` since those run after the factory is hoisted).
const h = vi.hoisted(() => {
  const placeholderSentinel = Symbol('placeholderData-sentinel')
  const queryReturnRefs = {
    data: { value: [] as unknown[] },
    isLoading: { value: false },
    isFetching: { value: false },
    isError: { value: false },
    error: { value: null as unknown },
    refetch: vi.fn(),
  }
  const captured: {
    queryKey: unknown
    queryFn: ((...args: unknown[]) => unknown) | undefined
    staleTime: number | undefined
    refetchOnWindowFocus: boolean | undefined
    placeholderData: unknown
  } = {
    queryKey: undefined,
    queryFn: undefined,
    staleTime: undefined,
    refetchOnWindowFocus: undefined,
    placeholderData: undefined,
  }
  return {
    authMock: { currentTenantId: 'tenant-1' },
    queryReturnRefs,
    captured,
    placeholderSentinel,
    listSpy: vi.fn(),
  }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => h.authMock,
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: (config: {
    queryKey: unknown
    queryFn: (...args: unknown[]) => unknown
    staleTime?: number
    refetchOnWindowFocus?: boolean
    placeholderData?: unknown
  }) => {
    h.captured.queryKey = config.queryKey
    h.captured.queryFn = config.queryFn
    h.captured.staleTime = config.staleTime
    h.captured.refetchOnWindowFocus = config.refetchOnWindowFocus
    h.captured.placeholderData = config.placeholderData
    return {
      data: { value: h.queryReturnRefs.data.value },
      isLoading: { value: h.queryReturnRefs.isLoading.value },
      isFetching: { value: h.queryReturnRefs.isFetching.value },
      isError: { value: h.queryReturnRefs.isError.value },
      error: { value: h.queryReturnRefs.error.value },
      refetch: h.queryReturnRefs.refetch,
    }
  },
}))

vi.mock('../../api/delivery-routes.api', () => ({
  deliveryRoutesApi: {
    list: (...args: unknown[]) => h.listSpy(...args),
  },
}))

import { useDriverActiveRoutes } from '../useDriverActiveRoutes'
import { deliveryRoutesApi } from '../../api/delivery-routes.api'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

beforeEach(() => {
  h.queryReturnRefs.data.value = []
  h.queryReturnRefs.isLoading.value = false
  h.queryReturnRefs.isFetching.value = false
  h.queryReturnRefs.isError.value = false
  h.queryReturnRefs.error.value = null
  h.queryReturnRefs.refetch.mockClear()
  h.captured.queryKey = undefined
  h.captured.queryFn = undefined
  h.captured.staleTime = undefined
  h.captured.refetchOnWindowFocus = undefined
  h.captured.placeholderData = undefined
  h.listSpy.mockReset()
  vi.clearAllMocks()
})

describe('useDriverActiveRoutes (sdd delivery-routes S6a, design §6.2, REQ-DRM-002 driver side)', () => {
  it('configures useQuery with deliveryRouteQueryKeys.list(tenantId, { status: "ACTIVE" })', () => {
    useDriverActiveRoutes()
    expect(h.captured.queryKey).toBeDefined()
    // queryKey is reactive (ComputedRef); unwrap for assertion.
    const raw = h.captured.queryKey as { value: readonly unknown[] } | readonly unknown[]
    const key = 'value' in (raw as object)
      ? (raw as { value: readonly unknown[] }).value
      : (raw as readonly unknown[])
    expect(key).toEqual(
      deliveryRouteQueryKeys.list('tenant-1', { status: 'ACTIVE' }),
    )
    // The list(tenantId, {status:'ACTIVE'}) tuple includes the literal
    // {status:'ACTIVE'} object as the LAST slot (TanStack prefix-matches via
    // the prefix listPrefix(tenantId); a different status would land in a
    // different cache slot).
    expect(key[key.length - 1]).toEqual({ status: 'ACTIVE' })
  })

  it('calls deliveryRoutesApi.list("ACTIVE") — NO driverUserId param (server-scoping, design §6.4 / §13.1)', async () => {
    h.listSpy.mockResolvedValue([])
    useDriverActiveRoutes()
    await h.captured.queryFn!()
    expect(h.listSpy).toHaveBeenCalledTimes(1)
    // Contract: list receives the literal 'ACTIVE' status; the call MUST NOT
    // include any driver-scoped filter — server CASL handles scoping.
    expect(h.listSpy).toHaveBeenCalledWith('ACTIVE')
    // TRIANGULATE — the call signature is exactly one argument; asserting it
    // doesn't accept a second object with driverUserId is a regression pin
    // against a future "convenience" that would leak a driver filter to the API.
    expect((h.listSpy.mock.calls[0] ?? []).length).toBe(1)
  })

  it('returns the projection data + isLoading + isFetching + error + refetch from useQuery', () => {
    const wrapper = useDriverActiveRoutes()
    expect(wrapper).toHaveProperty('data')
    expect(wrapper).toHaveProperty('isLoading')
    expect(wrapper).toHaveProperty('isFetching')
    expect(wrapper).toHaveProperty('isError')
    expect(wrapper).toHaveProperty('error')
    expect(wrapper).toHaveProperty('refetch')
  })

  it('does NOT apply a client-side filter on the response (REQ-DRM-002 driver side)', async () => {
    // Server returns ONLY the driver's routes (per CASL conditional rules). The
    // client MUST trust that — no .filter() on the response shape. We assert
    // the queryFn returns the response verbatim (no further client filtering).
    const driverRoutes = [
      { id: 'r1', status: 'ACTIVE', driver: { id: 'me', name: 'Yo', email: 'me@x' }, stops: [], timeline: [] },
      { id: 'r2', status: 'ACTIVE', driver: { id: 'me', name: 'Yo', email: 'me@x' }, stops: [], timeline: [] },
    ]
    h.listSpy.mockResolvedValue(driverRoutes)
    useDriverActiveRoutes()
    const result = await h.captured.queryFn!()
    // The queryFn returns the API response directly — no filter, no transform.
    expect(result).toEqual(driverRoutes)
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(2)
  })

  it('propagates the api list() error (does NOT swallow / silently fallback)', async () => {
    // The composable is a thin wrapper — the queryFn forwards the rejection so
    // the view can render the error state (no try/catch). We assert the
    // queryFn rejects with the original error.
    const boom = new Error('network down')
    h.listSpy.mockRejectedValue(boom)
    useDriverActiveRoutes()
    await expect(h.captured.queryFn!()).rejects.toBe(boom)
  })

  it('disables refetchOnWindowFocus (matches the payment-methods / sale-payment-methods precedent — no surprise refetches)', () => {
    useDriverActiveRoutes()
    expect(h.captured.refetchOnWindowFocus).toBe(false)
  })

  it('does NOT configure placeholderData (driver list does not need keepPreviousData — the detail composable owns that)', () => {
    // TRIANGULATE — only the detail composable opts into placeholderData to keep
    // a stale-but-rendered route visible during navigation; the driver list
    // can go straight to "loading" without flashing stale data. Asserting
    // `undefined` here pins the distinction between the two composables.
    useDriverActiveRoutes()
    expect(h.captured.placeholderData).toBeUndefined()
  })

  it('TRIANGULATE — the call to deliveryRoutesApi.list forwards the literal "ACTIVE" status verbatim', () => {
    h.listSpy.mockResolvedValue([])
    useDriverActiveRoutes()
    void h.captured.queryFn!()
    // The composable delegates via the API; asserting the captured spy is
    // called with the literal 'ACTIVE' is the contract pin (matches the
    // `listSpy` assertion above — same single-arg call site).
    expect(h.listSpy).toHaveBeenCalledWith('ACTIVE')
    // Touch the import to keep it referenced in the spec for clarity (no
    // assertion coupling — the captured spy is the source of truth).
    void deliveryRoutesApi.list
  })
})
