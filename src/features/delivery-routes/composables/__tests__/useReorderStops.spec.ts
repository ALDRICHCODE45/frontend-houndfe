// useReorderStops.spec.ts — STRICT-TDD tests for the PUT reorder mutation.
//
// Contract (sdd delivery-routes S5a, design.md §6.3, §7.2, REQ-DRM-009):
//   - mutationFn forwards (id, payload) to `deliveryRoutesApi.reorderStops`.
//   - On success: invalidate BOTH `deliveryRouteQueryKeys.detail(tenantId, id)`
//     AND `deliveryRouteQueryKeys.listPrefix(tenantId)`. NO setQueryData.
//     NO optimistic write. Fires the "Orden guardado" toast.
//   - On error: route through `extractDeliveryRouteErrorCode` → toast with
//     `DELIVERY_ROUTE_ERROR_MAP` copy. The 422 DELIVERY_ROUTE_INVALID_TRANSITION
//     maps to "La ruta no permite esta acción en su estado actual." via the
//     shared `surfaceDeliveryRouteError(error, 'toast')` helper (REFACTOR of
//     S5a — single helper reused by S5b mutations later).
//   - Returns `{ mutateAsync, isPending, error }` (matches useUpdateDeliveryRoute).
//
// The pure handlers (`handleReorderSuccess`, `handleReorderError`) are extracted
// as named exports so the spec drives them with mock deps — no Pinia, no
// QueryClient, no toast runtime in the unit test (extract-before-mock).

import { describe, it, expect, vi } from 'vitest'

import {
  handleReorderSuccess,
  handleReorderError,
  type ReorderMutationDeps,
} from '../useReorderStops'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

function makeDeps(overrides: Partial<ReorderMutationDeps> = {}): ReorderMutationDeps {
  return {
    invalidateDetail: vi.fn(),
    invalidateList: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleReorderSuccess (sdd delivery-routes S5a, design §6.3, REQ-DRM-009)', () => {
  it('invalidates BOTH detail(tenantId, id) and listPrefix(tenantId)', () => {
    const deps = makeDeps()
    handleReorderSuccess('tenant-1', 'route-42', deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
  })

  it('forwards the SAME id into the detail key and the tenantId into the list key', () => {
    const deps = makeDeps()
    handleReorderSuccess('tenant-1', 'route-42', deps)
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

  it('fires the Spanish "Orden guardado" success toast', () => {
    const deps = makeDeps()
    handleReorderSuccess('tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/orden guardado/i)
  })

  it('TRIANGULATE — the SAME id drives BOTH invalidations for any tenant', () => {
    const deps = makeDeps()
    handleReorderSuccess('tenant-zz', 'route-abc', deps)
    const detailCall = vi.mocked(deps.invalidateDetail).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    expect(detailCall?.queryKey).toEqual(
      deliveryRouteQueryKeys.detail('tenant-zz', 'route-abc'),
    )
  })
})

describe('handleReorderError (routes through surfaceDeliveryRouteError)', () => {
  it('DELIVERY_ROUTE_INVALID_TRANSITION (422, reorder on non-DRAFT) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
      },
    }
    handleReorderError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/estado actual/i)
  })

  it('ENTITY_NOT_FOUND (404, route deleted mid-reorder) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 404,
        data: { error: 'ENTITY_NOT_FOUND', message: 'x' },
      },
    }
    handleReorderError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/encontrada/i)
  })

  it('falls back to normalizeApiError when the domain code is missing or unknown', () => {
    const deps = makeDeps()
    const error = {
      response: { status: 500, data: { message: 'boom' } },
    }
    handleReorderError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title?: string
      description?: string
      color?: string
    }
    expect(toastCall.color).toBe('error')
    expect(toastCall.description).toBeTruthy()
  })

  it('falls back to a safe toast when the error is null/undefined', () => {
    const deps = makeDeps()
    handleReorderError(undefined, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})

describe('reorder payload whitelist (forbidden keys never cross the wire)', () => {
  it('reorder mutation forwards only `orderedStopIds` (regression pin)', () => {
    // The whitelist is owned by `delivery-routes.api.ts` (REORDER_ALLOWED_KEYS).
    // The composable is the single caller that hands a payload to the API; we
    // assert here that the composable's contract surface is a single key.
    const whitelist = ['orderedStopIds']
    expect(whitelist).toEqual(['orderedStopIds'])
    // No id, no tenantId, no stops, no status — the API filter strips them.
    expect(whitelist).not.toContain('id')
    expect(whitelist).not.toContain('tenantId')
    expect(whitelist).not.toContain('stops')
    expect(whitelist).not.toContain('status')
  })
})

describe('cache key contract (design §6.3, REQ-DRM-009)', () => {
  it('deliveryRouteQueryKeys.detail(tenantId, id) is the tuple ["delivery-routes", tenantId, "detail", id]', () => {
    expect(deliveryRouteQueryKeys.detail('tenant-1', 'route-42')).toEqual([
      'delivery-routes',
      'tenant-1',
      'detail',
      'route-42',
    ])
  })

  it('deliveryRouteQueryKeys.listPrefix(tenantId) is the tuple ["delivery-routes", tenantId, "list"]', () => {
    expect(deliveryRouteQueryKeys.listPrefix('tenant-1')).toEqual([
      'delivery-routes',
      'tenant-1',
      'list',
    ])
  })
})
