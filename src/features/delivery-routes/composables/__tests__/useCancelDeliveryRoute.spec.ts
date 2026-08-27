// useCancelDeliveryRoute.spec.ts — STRICT-TDD tests for the POST cancel mutation.
//
// Contract (sdd delivery-routes S5b, design.md §6.3, §7.2):
//   - mutationFn forwards the id to `deliveryRoutesApi.cancel` (POST :id/cancel).
//   - On success: invalidate BOTH `detail(tenantId, id)` AND
//     `listPrefix(tenantId)`. Fires the Spanish "Ruta cancelada" toast.
//   - On 422 `DELIVERY_ROUTE_INVALID_TRANSITION`: specific toast (resync stale
//     status) via the shared `surfaceDeliveryRouteError(error, 'toast')` helper.
//   - Other errors route through the same shared helper.
//
// Pure handlers (`handleCancelSuccess`, `handleCancelError`) are extracted as
// named exports so the spec drives them with mock deps — no Pinia, no
// QueryClient, no toast runtime in the unit test (extract-before-mock).

import { describe, it, expect, vi } from 'vitest'

import {
  handleCancelSuccess,
  handleCancelError,
  type CancelMutationDeps,
} from '../useCancelDeliveryRoute'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

function makeDeps(overrides: Partial<CancelMutationDeps> = {}): CancelMutationDeps {
  return {
    invalidateDetail: vi.fn(),
    invalidateList: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleCancelSuccess (sdd delivery-routes S5b, design §6.3)', () => {
  it('invalidates BOTH detail(tenantId, id) and listPrefix(tenantId)', () => {
    const deps = makeDeps()
    handleCancelSuccess('tenant-1', 'route-42', deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
  })

  it('forwards the SAME id into the detail key and the tenantId into the list key', () => {
    const deps = makeDeps()
    handleCancelSuccess('tenant-1', 'route-42', deps)
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

  it('fires the Spanish "Ruta cancelada" success toast', () => {
    const deps = makeDeps()
    handleCancelSuccess('tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/cancelada/i)
  })
})

describe('handleCancelError (routes through surfaceDeliveryRouteError)', () => {
  it('DELIVERY_ROUTE_INVALID_TRANSITION (422, cancel on non-ACTIVE) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
      },
    }
    handleCancelError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/estado actual/i)
  })

  it('ENTITY_NOT_FOUND (404, route deleted mid-cancel) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: { status: 404, data: { error: 'ENTITY_NOT_FOUND', message: 'x' } },
    }
    handleCancelError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/encontrada/i)
  })

  it('falls back to normalizeApiError when the domain code is missing', () => {
    const deps = makeDeps()
    const error = { response: { status: 500, data: { message: 'boom' } } }
    handleCancelError(error, deps)
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
    handleCancelError(undefined, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})
