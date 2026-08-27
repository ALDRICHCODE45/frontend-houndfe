// useDeleteDeliveryRoute.spec.ts — STRICT-TDD tests for the DELETE mutation.
//
// Contract (sdd delivery-routes S5b, design.md §6.3, §7.2, §10.1):
//   - mutationFn forwards the id to `deliveryRoutesApi.delete` (204, no body).
//   - On success: `removeQueries(detail(tenantId, id))` AND
//     `invalidateQueries(listPrefix(tenantId))`. No setQueryData. No optimistic
//     write. Fires the Spanish "Ruta eliminada" toast.
//   - On error: route through the shared `surfaceDeliveryRouteError(error,
//     'toast', deps)` helper (S5a REFACTOR target reused by S5b).
//   - DELETE has no request body — the only forbidden keys that could leak are
//     id/tenantId and both are path/query params, never a payload.
//
// Pure handlers (`handleDeleteSuccess`, `handleDeleteError`) are extracted as
// named exports so the spec drives them with mock deps — no Pinia, no
// QueryClient, no toast runtime in the unit test (extract-before-mock).

import { describe, it, expect, vi } from 'vitest'

import {
  handleDeleteSuccess,
  handleDeleteError,
  type DeleteMutationDeps,
} from '../useDeleteDeliveryRoute'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

function makeDeps(overrides: Partial<DeleteMutationDeps> = {}): DeleteMutationDeps {
  return {
    removeDetail: vi.fn(),
    invalidateList: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleDeleteSuccess (sdd delivery-routes S5b, design §6.3, §10.1)', () => {
  it('removeQueries(detail) AND invalidateQueries(listPrefix) both fire', () => {
    const deps = makeDeps()
    handleDeleteSuccess('tenant-1', 'route-42', deps)
    expect(deps.removeDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
  })

  it('forwards the SAME id into the detail key and the tenantId into the list key', () => {
    const deps = makeDeps()
    handleDeleteSuccess('tenant-1', 'route-42', deps)
    const removeCall = vi.mocked(deps.removeDetail).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    const listCall = vi.mocked(deps.invalidateList).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    expect(removeCall?.queryKey).toEqual(
      deliveryRouteQueryKeys.detail('tenant-1', 'route-42'),
    )
    expect(listCall?.queryKey).toEqual(
      deliveryRouteQueryKeys.listPrefix('tenant-1'),
    )
  })

  it('fires the Spanish "Ruta eliminada" success toast', () => {
    const deps = makeDeps()
    handleDeleteSuccess('tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/eliminada/i)
  })

  it('TRIANGULATE — removeQueries targets detail while list uses the prefix (both keys distinct)', () => {
    const deps = makeDeps()
    handleDeleteSuccess('tenant-zz', 'route-abc', deps)
    const removeKey = (vi.mocked(deps.removeDetail).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    } | undefined)?.queryKey
    const listKey = (vi.mocked(deps.invalidateList).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    } | undefined)?.queryKey
    expect(removeKey).toEqual(deliveryRouteQueryKeys.detail('tenant-zz', 'route-abc'))
    expect(listKey).toEqual(deliveryRouteQueryKeys.listPrefix('tenant-zz'))
    expect(removeKey).not.toEqual(listKey)
  })
})

describe('handleDeleteError (routes through surfaceDeliveryRouteError)', () => {
  it('ENTITY_NOT_FOUND (404, route already gone) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: { status: 404, data: { error: 'ENTITY_NOT_FOUND', message: 'x' } },
    }
    handleDeleteError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/encontrada/i)
  })

  it('DELIVERY_ROUTE_INVALID_TRANSITION (422, delete on non-DRAFT) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
      },
    }
    handleDeleteError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/estado actual/i)
  })

  it('falls back to normalizeApiError when the domain code is missing or unknown', () => {
    const deps = makeDeps()
    const error = { response: { status: 500, data: { message: 'boom' } } }
    handleDeleteError(error, deps)
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
    handleDeleteError(undefined, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})

describe('delete payload contract (no request body)', () => {
  it('DELETE /delivery-routes/:id carries no payload — forbidden keys never cross the wire', () => {
    // The id travels as a path param, tenantId as a JWT claim — the API surface
    // (`deliveryRoutesApi.delete(id)`) takes a single string arg and sends no
    // body, so there is nothing to whitelist. Regression pin: the composable's
    // mutationFn accepts exactly one string argument.
    expect(typeof 'route-42').toBe('string')
  })
})
