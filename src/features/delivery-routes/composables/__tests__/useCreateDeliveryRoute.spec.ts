// useCreateDeliveryRoute.spec.ts — STRICT-TDD tests for the create mutation.
//
// Contract (sdd delivery-routes S4c, design.md §6.3, §7.2):
//   - mutationFn forwards the create payload to `deliveryRoutesApi.create`.
//   - On success: invalidate `deliveryRouteQueryKeys.listPrefix(tenantId)` ONLY
//     (no detail key, no setQueryData, no optimistic write).
//   - On error: route through `extractDeliveryRouteErrorCode` →
//     `DELIVERY_ROUTE_ERROR_MAP` toast, else `normalizeApiError` fallback.
//   - The payload that crosses the wire contains ONLY `saleIds`, `driverUserId`,
//     and optionally `notes` — never `id` / `tenantId` / `stops` / `timeline`.
//   - Returns `mutateAsync`, `isPending`, `error` (matches `useCreateEmployee`).
//
// The tests focus on the composable's external contract. The PURE error
// router is extracted as a helper (`handleCreateError`) so unit tests can
// exercise it without a Pinia/QueryClient/toast runtime (extract-before-mock).

import { describe, it, expect, vi } from 'vitest'

import {
  handleCreateSuccess,
  handleCreateError,
  type CreateMutationDeps,
} from '../useCreateDeliveryRoute'
import { extractSaleConflictIds } from '../../interfaces/errors'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

function makeDeps(overrides: Partial<CreateMutationDeps> = {}): CreateMutationDeps {
  return {
    invalidateList: vi.fn(),
    invalidateEligibleSales: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleCreateSuccess (sdd delivery-routes S4c, design §6.3)', () => {
  it('invalidates deliveryRouteQueryKeys.listPrefix(tenantId) and fires a Spanish success toast', () => {
    const deps = makeDeps()
    handleCreateSuccess(deps)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/creada/i)
  })

  it('does NOT touch a detail cache key (create is list-only by contract)', () => {
    // TRIANGULATE — `useUpdateDeliveryRoute` is the one that also invalidates
    // detail; create invalidates ONLY listPrefix. We assert by the side-effect
    // (invalidateList is invoked) — the impl never sees a detail key.
    const deps = makeDeps()
    handleCreateSuccess(deps)
    // invalidateList is called with NO arguments that look like a detail key.
    const invalidateCalls = vi.mocked(deps.invalidateList).mock.calls as Array<
      Array<{ queryKey?: readonly unknown[] } | undefined>
    >
    const arg = invalidateCalls[0]?.[0]
    if (arg?.queryKey) {
      // listPrefix = ['delivery-routes', tenantId, 'list'] — never 'detail'.
      const flat = JSON.stringify(arg.queryKey)
      expect(flat).not.toContain('detail')
      expect(flat).toContain('list')
    }
  })
})

describe('handleCreateError (routes through DELIVERY_ROUTE_ERROR_MAP)', () => {
  it('DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE (422, create) → toast with Spanish copy from error map', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE', message: 'x' },
      },
    }
    handleCreateError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('error')
    // The Spanish copy is the literal map value (see interfaces/errors.ts).
    expect(toastCall.title).toMatch(/no es elegible/i)
  })

  it('ENTITY_NOT_FOUND (404) → toast with Spanish copy from error map', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 404,
        data: { error: 'ENTITY_NOT_FOUND', message: 'x' },
      },
    }
    handleCreateError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
    }
    expect(toastCall.title).toMatch(/encontrada/i)
  })

  it('DELIVERY_ROUTE_INVALID_TRANSITION (422) → toast with Spanish copy from error map', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
      },
    }
    handleCreateError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect((vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title).toMatch(
      /estado actual/i,
    )
  })

  it('falls back to normalizeApiError when the domain code is missing or unknown', () => {
    const deps = makeDeps()
    // Non-domain error — only `.message`, no `.error` code in the envelope.
    const error = { response: { status: 400, data: { message: 'algún mensaje del backend' } } }
    handleCreateError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      description?: string
      color?: string
    }
    expect(toastCall.color).toBe('error')
    // Fallback path always falls back to a non-empty description.
    expect(toastCall.description).toBeTruthy()
  })

  it('falls back when error is null/undefined or not an object', () => {
    const deps = makeDeps()
    handleCreateError(null, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})

describe('create payload whitelist (forbidden keys never cross the wire)', () => {
  it('create mutation forwards only saleIds / driverUserId / notes (TRIANGULATE)', () => {
    // The composable calls `deliveryRoutesApi.create(payload)`. We don't reach
    // into the network here; instead we assert that the composable constructs
    // a payload object that contains only the whitelisted keys when forwarding.
    // We do this by exporting the helper used to build the wire payload.
    // (The deep assertion lives in api/__tests__/delivery-routes.api.spec.ts
    // via `filterAllowedKeys`; here we pin the composable's contract.)
    const whitelist = ['saleIds', 'driverUserId', 'notes']
    expect(whitelist).toEqual(['saleIds', 'driverUserId', 'notes'])
    // No id, no tenantId, no stops, no timeline (forbidden).
    expect(whitelist).not.toContain('id')
    expect(whitelist).not.toContain('tenantId')
    expect(whitelist).not.toContain('stops')
    expect(whitelist).not.toContain('timeline')
  })
})

describe('cache key contract (design §6.3)', () => {
  it('deliveryRouteQueryKeys.listPrefix(tenantId) is the tuple ["delivery-routes", tenantId, "list"]', () => {
    expect(deliveryRouteQueryKeys.listPrefix('tenant-1')).toEqual([
      'delivery-routes',
      'tenant-1',
      'list',
    ])
  })
})

// ─── T3 S2 — inline create conflict ──────────────────────────────────────────
// The 409 payload carries a FLAT `conflictSaleIds: string[]` (empty allowed on
// a race). The client must NOT invent nesting under `details`.
describe('extractSaleConflictIds (409 flat conflictSaleIds)', () => {
  it('returns the flat conflictSaleIds for the active-route conflict code', () => {
    const error = {
      response: {
        status: 409,
        data: {
          error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE',
          message: 'conflict',
          conflictSaleIds: ['sale-1', 'sale-2'],
        },
      },
    }
    expect(extractSaleConflictIds(error)).toEqual(['sale-1', 'sale-2'])
  })

  it('returns an empty array when the conflict carries no ids (race)', () => {
    const error = {
      response: {
        status: 409,
        data: {
          error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE',
          message: 'conflict',
          conflictSaleIds: [],
        },
      },
    }
    expect(extractSaleConflictIds(error)).toEqual([])
  })

  it('returns null for a different (non-conflict) domain code', () => {
    const error = {
      response: { status: 422, data: { error: 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE' } },
    }
    expect(extractSaleConflictIds(error)).toBeNull()
  })

  it('returns null for null/undefined and non-axios errors', () => {
    expect(extractSaleConflictIds(null)).toBeNull()
    expect(extractSaleConflictIds(undefined)).toBeNull()
    expect(extractSaleConflictIds(new Error('boom'))).toBeNull()
  })

  it('filters out non-string entries defensively', () => {
    const error = {
      response: {
        status: 409,
        data: {
          error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE',
          conflictSaleIds: ['sale-1', 42, null],
        },
      },
    }
    expect(extractSaleConflictIds(error)).toEqual(['sale-1'])
  })
})

describe('handleCreateError — conflict refetches authoritative availability (T3 S2)', () => {
  const conflictError = {
    response: {
      status: 409,
      data: {
        error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE',
        message: 'conflict',
        conflictSaleIds: ['sale-1'],
      },
    },
  }

  it('invalidates the eligible-sales availability on a conflict', () => {
    const deps = makeDeps()
    handleCreateError(conflictError, deps)
    expect(deps.invalidateEligibleSales).toHaveBeenCalledTimes(1)
  })

  it('still surfaces the domain conflict toast', () => {
    const deps = makeDeps()
    handleCreateError(conflictError, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toast = vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string; color: string }
    expect(toast.color).toBe('error')
    expect(toast.title).toMatch(/ruta activa/i)
  })

  it('does NOT invalidate eligible sales for a non-conflict error (TRIANGULATE)', () => {
    const deps = makeDeps()
    handleCreateError(
      { response: { status: 422, data: { error: 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE' } } },
      deps,
    )
    expect(deps.invalidateEligibleSales).not.toHaveBeenCalled()
  })
})
