// useStartDeliveryRoute.spec.ts — STRICT-TDD tests for the POST start mutation.
//
// Contract (sdd delivery-routes S5b, design.md §6.3, §7.2, §10.1):
//   - mutationFn forwards the id to `deliveryRoutesApi.start` (POST :id/start).
//   - On success: invalidate BOTH `detail(tenantId, id)` AND
//     `listPrefix(tenantId)`. Fires the Spanish "Ruta iniciada" toast.
//   - On 409 `DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE`: specific toast
//     + invalidate BOTH detail and listPrefix (resync stale DRAFT) + NO
//     auto-retry (TanStack mutations default to retry: 0 — the manager must
//     resolve the conflict and re-start manually).
//   - Other errors route through `surfaceDeliveryRouteError(error, 'toast')`.
//
// Pure handlers (`handleStartSuccess`, `handleStartError`) are extracted so the
// spec drives them with mock deps. One integration test mounts the real
// composable to pin the no-auto-retry invariant at the QueryClient boundary.

import { describe, it, expect, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import {
  handleStartSuccess,
  handleStartError,
  useStartDeliveryRoute,
  type StartMutationDeps,
} from '../useStartDeliveryRoute'
import { deliveryRoutesApi } from '../../api/delivery-routes.api'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

vi.mock('../../api/delivery-routes.api', () => ({
  deliveryRoutesApi: {
    start: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

vi.mock('@nuxt/ui/composables/useToast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

function makeDeps(overrides: Partial<StartMutationDeps> = {}): StartMutationDeps {
  return {
    invalidateDetail: vi.fn(),
    invalidateList: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

function mountStart() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, retryDelay: 0 },
    },
  })
  let result: ReturnType<typeof useStartDeliveryRoute> | undefined

  const TestComponent = defineComponent({
    setup() {
      result = useStartDeliveryRoute()
      return () => h('div')
    },
  })

  mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })

  return { composable: result! }
}

describe('handleStartSuccess (sdd delivery-routes S5b, design §6.3)', () => {
  it('invalidates BOTH detail(tenantId, id) and listPrefix(tenantId)', () => {
    const deps = makeDeps()
    handleStartSuccess('tenant-1', 'route-42', deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
  })

  it('forwards the SAME id into the detail key and the tenantId into the list key', () => {
    const deps = makeDeps()
    handleStartSuccess('tenant-1', 'route-42', deps)
    const detailCall = vi.mocked(deps.invalidateDetail).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    const listCall = vi.mocked(deps.invalidateList).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    expect(detailCall?.queryKey).toEqual(
      deliveryRouteQueryKeys.detail('tenant-1', 'route-42'),
    )
    expect(listCall?.queryKey).toEqual(
      deliveryRouteQueryKeys.listPrefix('tenant-1'),
    )
  })

  it('fires the Spanish "Ruta iniciada" success toast', () => {
    const deps = makeDeps()
    handleStartSuccess('tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/iniciada/i)
  })
})

describe('handleStartError (409 race + shared error router)', () => {
  it('409 DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE → specific toast', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 409,
        data: { error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE', message: 'x' },
      },
    }
    handleStartError(error, 'tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/otra ruta activa/i)
  })

  it('TRIANGULATE — 409 invalidation hits BOTH detail and listPrefix (assert two invalidate calls)', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 409,
        data: { error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE', message: 'x' },
      },
    }
    handleStartError(error, 'tenant-1', 'route-42', deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
    const detailCall = vi.mocked(deps.invalidateDetail).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    const listCall = vi.mocked(deps.invalidateList).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    expect(detailCall?.queryKey).toEqual(
      deliveryRouteQueryKeys.detail('tenant-1', 'route-42'),
    )
    expect(listCall?.queryKey).toEqual(
      deliveryRouteQueryKeys.listPrefix('tenant-1'),
    )
  })

  it('DELIVERY_ROUTE_INVALID_TRANSITION (422) → toast, NO extra invalidation', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
      },
    }
    handleStartError(error, 'tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/estado actual/i)
    expect(deps.invalidateDetail).not.toHaveBeenCalled()
    expect(deps.invalidateList).not.toHaveBeenCalled()
  })

  it('falls back to normalizeApiError when the domain code is missing', () => {
    const deps = makeDeps()
    const error = { response: { status: 500, data: { message: 'boom' } } }
    handleStartError(error, 'tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      description?: string
      color?: string
    }
    expect(toastCall.color).toBe('error')
    expect(toastCall.description).toBeTruthy()
  })

  it('falls back to a safe toast when the error is null/undefined', () => {
    const deps = makeDeps()
    handleStartError(undefined, 'tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})

describe('no auto-retry invariant (QueryClient boundary)', () => {
  it('TRIANGULATE — 409 does NOT auto-retry (start called exactly once)', async () => {
    vi.mocked(deliveryRoutesApi.start).mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE', message: 'x' },
      },
    })

    const { composable } = mountStart()

    await expect(composable.mutateAsync('route-42')).rejects.toBeDefined()

    expect(deliveryRoutesApi.start).toHaveBeenCalledTimes(1)
  })
})
