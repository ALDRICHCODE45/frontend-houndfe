// useDeliveryRouteDetail.spec.ts — STRICT-TDD tests for the detail composable.
//
// Contract (sdd delivery-routes S6a, design.md §6.2, §11):
//   - `useQuery` over `GET /delivery-routes/:id`.
//   - queryKey: `deliveryRouteQueryKeys.detail(tenantId, id)` — invalidated by
//     EVERY mutation (S4c create/update, S5a reorder, S5b delete/start/cancel/
//     append) on success.
//   - `placeholderData: keepPreviousData` — the previous route stays visible
//     while the new one loads, so the navigation never flashes a loading skeleton
//     (design §11 detail view table — full-page load is jarring on a manager
//     navigating between routes).
//   - Returns `data: Ref<DeliveryRouteResponseDto | undefined>` (single object,
//     not an array; not the paginated envelope).
//   - On 404 / driver 403: the queryFn propagates the rejection — the VIEW
//     owns the "Ruta no encontrada" full-page state via
//     `extractDeliveryRouteErrorCode`. The composable does not swallow.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted test state — vi.mock factories run BEFORE top-level statements,
// so all shared mock state must be created via vi.hoisted() (plain JS only —
// no `ref()`/`computed()` since those run after the factory is hoisted).
const h = vi.hoisted(() => {
  const placeholderSentinel = Symbol('placeholderData-sentinel')
  const queryReturnRefs = {
    data: { value: undefined as unknown },
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
    getByIdSpy: vi.fn(),
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
  // The composable imports `keepPreviousData` from `@tanstack/vue-query` to
  // pass it as `placeholderData`. We expose it as a sentinel symbol so the spec
  // can assert the composable wired it WITHOUT coupling to the real
  // implementation (which would pull a real Vue-Query runtime).
  keepPreviousData: h.placeholderSentinel,
}))

vi.mock('../../api/delivery-routes.api', () => ({
  deliveryRoutesApi: {
    getById: (...args: unknown[]) => h.getByIdSpy(...args),
  },
}))

import { useDeliveryRouteDetail } from '../useDeliveryRouteDetail'
import { deliveryRoutesApi } from '../../api/delivery-routes.api'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

beforeEach(() => {
  h.queryReturnRefs.data.value = undefined
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
  h.getByIdSpy.mockReset()
  vi.clearAllMocks()
})

describe('useDeliveryRouteDetail (sdd delivery-routes S6a, design §6.2, §11)', () => {
  it('configures useQuery with deliveryRouteQueryKeys.detail(tenantId, id)', () => {
    useDeliveryRouteDetail('route-42')
    expect(h.captured.queryKey).toBeDefined()
    const raw = h.captured.queryKey as { value: readonly unknown[] } | readonly unknown[]
    const key = 'value' in (raw as object)
      ? (raw as { value: readonly unknown[] }).value
      : (raw as readonly unknown[])
    expect(key).toEqual(deliveryRouteQueryKeys.detail('tenant-1', 'route-42'))
  })

  it('forwards the id into the cache key (different id ⇒ different cache slot)', () => {
    useDeliveryRouteDetail('route-99')
    const raw = h.captured.queryKey as { value: readonly unknown[] } | readonly unknown[]
    const key = 'value' in (raw as object)
      ? (raw as { value: readonly unknown[] }).value
      : (raw as readonly unknown[])
    expect(key[key.length - 1]).toBe('route-99')
    // The S5b mutations invalidate this exact slot on success — pinning the
    // shape here is the regression guarantee that detail invalidation works.
  })

  it('calls deliveryRoutesApi.getById(id) in the queryFn — no other args', async () => {
    const route = { id: 'route-42', status: 'DRAFT', driver: null, stops: [], timeline: [] }
    h.getByIdSpy.mockResolvedValue(route)
    useDeliveryRouteDetail('route-42')
    const result = await h.captured.queryFn!()
    expect(h.getByIdSpy).toHaveBeenCalledTimes(1)
    expect(h.getByIdSpy).toHaveBeenCalledWith('route-42')
    expect(result).toEqual(route)
  })

  it('configures placeholderData: keepPreviousData — detail keeps the previous route visible while the new one loads (design §11)', () => {
    useDeliveryRouteDetail('route-42')
    expect(h.captured.placeholderData).toBe(h.placeholderSentinel)
  })

  it('propagates the api.getById rejection — does NOT swallow (the view owns the 404/403 full-page state via extractDeliveryRouteErrorCode)', async () => {
    // 404 → ENTITY_NOT_FOUND; driver 403 → the same not-found path (no leak).
    // The composable MUST forward the rejection so the view can read the error
    // and route through `extractDeliveryRouteErrorCode`. If the composable
    // swallowed the error, the view would never know to render the
    // "Ruta no encontrada" full-page state.
    const notFound = {
      response: {
        status: 404,
        data: { error: 'ENTITY_NOT_FOUND', message: 'x' },
      },
    }
    h.getByIdSpy.mockRejectedValue(notFound)
    useDeliveryRouteDetail('route-42')
    await expect(h.captured.queryFn!()).rejects.toBe(notFound)
  })

  it('propagates the driver 403 (no special-casing in the composable — view maps to not-found for no-leak)', async () => {
    // Driver 403 (CASL conditional rule fires) is mapped to the same full-page
    // not-found state as 404 by the view, NEVER surfaced as a banner or toast
    // (design §7.2, §11). The composable MUST NOT special-case 403 either —
    // it just propagates the rejection so the view can route it correctly.
    const forbidden = {
      response: {
        status: 403,
        data: { error: 'FORBIDDEN', message: 'no es tuya' },
      },
    }
    h.getByIdSpy.mockRejectedValue(forbidden)
    useDeliveryRouteDetail('route-42')
    await expect(h.captured.queryFn!()).rejects.toBe(forbidden)
  })

  it('returns the projection data + isLoading + isFetching + error + refetch from useQuery', () => {
    const wrapper = useDeliveryRouteDetail('route-42')
    expect(wrapper).toHaveProperty('data')
    expect(wrapper).toHaveProperty('isLoading')
    expect(wrapper).toHaveProperty('isFetching')
    expect(wrapper).toHaveProperty('isError')
    expect(wrapper).toHaveProperty('error')
    expect(wrapper).toHaveProperty('refetch')
  })

  it('disables refetchOnWindowFocus (matches the driver-list composable — no surprise refetches while the manager is mid-edit)', () => {
    useDeliveryRouteDetail('route-42')
    expect(h.captured.refetchOnWindowFocus).toBe(false)
  })

  it('TRIANGULATE — composable accepts an adaptive input that does NOT trigger a re-fetch on every keystroke (placeholderData provides stable render during navigation)', () => {
    // The composable accepts a `MaybeRefOrGetter<string>` so the view can pass
    // `route.params.id` directly OR a computed derived from the route. The
    // placeholderData option keeps the previous route visible during the brief
    // window when the id flips, so the view never flashes an empty skeleton.
    // This spec asserts the wiring (placeholderData is the keepPreviousData
    // sentinel) — the input-adaptivity is covered in the `useDeliveryRouteDetail`
    // composable source contract; the unit-level guarantee here is the
    // keepPreviousData wiring.
    useDeliveryRouteDetail('route-42')
    expect(h.captured.placeholderData).toBe(h.placeholderSentinel)
  })
})
