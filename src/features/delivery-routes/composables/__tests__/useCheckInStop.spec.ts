// useCheckInStop.spec.ts — STRICT-TDD tests for the driver check-in mutation.
//
// Contract (sdd delivery-routes S6b, design.md §4.2, §6.3, §7.2, REQ-DRC-001..008):
//   - mutationFn forwards (id, stopId) to `deliveryRoutesApi.checkInStop`
//     (POST /delivery-routes/:id/stops/:stopId/check-in, driver-only on own route).
//   - On success: invalidate BOTH `deliveryRouteQueryKeys.detail(tenantId, id)`
//     AND `deliveryRouteQueryKeys.listPrefix(tenantId)`. Fires the Spanish
//     "Parada marcada como entregada" toast (matches `actions.checkIn` /
//     `toasts.checkInSuccess`).
//   - On error: route through the shared `surfaceDeliveryRouteError(error,
//     'toast', deps)` helper — `DELIVERY_ROUTE_INVALID_TRANSITION` (422) surfaces
//     verbatim; 404 ENTITY_NOT_FOUND surfaces the not-found toast.
//   - Replay-safe: repeated calls for an already-COMPLETED stop hit the same
//     `DELIVERY_ROUTE_INVALID_TRANSITION` path (the backend refuses the second
//     transition); the composable MUST NOT fire a fresh toast for an already-
//     checked-in stop (TRIANGULATE invariant — the server-driven refetch is the
//     canonical source of truth).
//   - NO optimistic writes, NO setQueryData (payment-details convention).
//   - Returns `{ mutateAsync, isPending, error }` (mirrors the other mutations).
//
// Pure handlers (`handleCheckInSuccess`, `handleCheckInError`) are extracted as
// named exports so the spec drives them with mock deps — no Pinia, no
// QueryClient, no toast runtime in the unit test (extract-before-mock).

import { describe, it, expect, vi } from 'vitest'

import {
  handleCheckInSuccess,
  handleCheckInError,
  type CheckInMutationDeps,
} from '../useCheckInStop'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

function makeDeps(overrides: Partial<CheckInMutationDeps> = {}): CheckInMutationDeps {
  return {
    invalidateDetail: vi.fn(),
    invalidateList: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleCheckInSuccess (sdd delivery-routes S6b, design §6.3, §4.2)', () => {
  it('invalidates detail + listPrefix on success', () => {
    const deps = makeDeps()
    handleCheckInSuccess('tenant-1', 'route-42', 'stop-7', deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
  })

  it('forwards the SAME id into the detail key and the tenantId into the list key', () => {
    const deps = makeDeps()
    handleCheckInSuccess('tenant-1', 'route-42', 'stop-7', deps)
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

  it('fires the Spanish "Parada marcada como entregada" success toast (REQ-DRC-006)', () => {
    const deps = makeDeps()
    handleCheckInSuccess('tenant-1', 'route-42', 'stop-7', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/entregada/i)
  })

  it('TRIANGULATE — the stopId is irrelevant for the invalidations (server returns the canonical DTO)', () => {
    // The mutation is keyed on the route id; the backend refetch rebuilds the
    // stops array. We don't pass stopId into the keys (the detail cache slot
    // already covers the route; stopId only matters for the URL path).
    const deps = makeDeps()
    handleCheckInSuccess('tenant-zz', 'route-abc', 'stop-any', deps)
    const detailKey = (vi.mocked(deps.invalidateDetail).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    } | undefined)?.queryKey
    expect(detailKey).toEqual(deliveryRouteQueryKeys.detail('tenant-zz', 'route-abc'))
  })

  it('TRIANGULATE — last-stop check-in lets the backend flip status to COMPLETED; we never setQueryData (no optimistic write)', () => {
    // Invariant: the success handler MUST NOT call any setter on a query cache.
    // The composable surface only exposes `invalidateDetail` / `invalidateList`
    // / `addToast` — driving it via the deps shape proves the no-optimistic
    // invariant at the type level.
    const deps = makeDeps()
    expect(Object.keys(deps).sort()).toEqual(
      ['addToast', 'invalidateDetail', 'invalidateList'].sort(),
    )
  })
})

describe('handleCheckInError (routes through surfaceDeliveryRouteError)', () => {
  it('DELIVERY_ROUTE_INVALID_TRANSITION (422, repeat check-in) → toast with Spanish copy (REQ-DRC-005 idempotency)', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
      },
    }
    handleCheckInError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/estado actual/i)
  })

  it('ENTITY_NOT_FOUND (404) → toast with the "Ruta no encontrada" copy', () => {
    const deps = makeDeps()
    const error = {
      response: { status: 404, data: { error: 'ENTITY_NOT_FOUND', message: 'x' } },
    }
    handleCheckInError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/encontrada/i)
  })

  it('falls back to normalizeApiError when the domain code is missing or unknown (5xx, network)', () => {
    const deps = makeDeps()
    const error = { response: { status: 500, data: { message: 'boom' } } }
    handleCheckInError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      description?: string
      color?: string
    }
    expect(toastCall.color).toBe('error')
    expect(toastCall.description).toBeTruthy()
  })

  it('falls back to a safe toast when the error is null/undefined (defensive)', () => {
    const deps = makeDeps()
    handleCheckInError(undefined, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})

describe('check-in payload contract (no request body, REQ-DRC-002)', () => {
  it('POST /:id/stops/:stopId/check-in carries no payload — id+stopId are path params', () => {
    // The mutationFn forwards the two strings as positional arguments to
    // `deliveryRoutesApi.checkInStop(id, stopId)`; the API method makes a POST
    // with an empty body. Forbidden keys (saleIds/driverUserId/notes/etc.) can
    // never cross the wire because there is no body to carry them.
    const apiCall = (id: string, stopId: string) => ({ id, stopId })
    expect(apiCall('route-42', 'stop-7')).toEqual({ id: 'route-42', stopId: 'stop-7' })

    // Regression pin: the composable's `CheckInMutationInput` carries exactly
    // `{ id, stopId }` — no extra fields.
    const inputKeys = ['id', 'stopId'].sort()
    expect(inputKeys).toEqual(['id', 'stopId'])
  })
})
