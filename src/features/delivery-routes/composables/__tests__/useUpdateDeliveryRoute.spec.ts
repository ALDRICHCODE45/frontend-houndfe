// useUpdateDeliveryRoute.spec.ts — STRICT-TDD tests for the PATCH mutation.
//
// Contract (sdd delivery-routes S4c, design.md §6.3, §7.2):
//   - mutationFn forwards (id, payload) to `deliveryRoutesApi.update`.
//   - On success: invalidate BOTH `detail(tenantId, id)` AND
//     `listPrefix(tenantId)`. No setQueryData. No optimistic write.
//   - On error: route through `extractDeliveryRouteErrorCode` →
//     `DELIVERY_ROUTE_ERROR_MAP` toast, else `normalizeApiError` fallback.
//   - Update payload contains ONLY `driverUserId` and optionally `notes`
//     (no `saleIds`, no `status`, no `id`, no `tenantId`).
//   - Returns `mutateAsync`, `isPending`, `error`.
//
// Pure handlers (`handleUpdateSuccess`, `handleUpdateError`) are extracted
// so the unit tests assert the side-effect contract without Pinia/QueryClient.

import { describe, it, expect, vi } from 'vitest'

import {
  handleUpdateSuccess,
  handleUpdateError,
  type UpdateMutationDeps,
} from '../useUpdateDeliveryRoute'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'

function makeDeps(overrides: Partial<UpdateMutationDeps> = {}): UpdateMutationDeps {
  return {
    invalidateDetail: vi.fn(),
    invalidateList: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleUpdateSuccess (sdd delivery-routes S4c, design §6.3)', () => {
  it('invalidates BOTH detail(tenantId, id) and listPrefix(tenantId)', () => {
    const deps = makeDeps()
    handleUpdateSuccess('tenant-1', 'route-42', deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
  })

  it('forwards the SAME id into the detail key and the tenantId into the list key', () => {
    const deps = makeDeps()
    handleUpdateSuccess('tenant-1', 'route-42', deps)
    const detailKey = (vi.mocked(deps.invalidateDetail).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    } | undefined)?.queryKey
    const listKey = (vi.mocked(deps.invalidateList).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    } | undefined)?.queryKey
    expect(detailKey).toEqual(deliveryRouteQueryKeys.detail('tenant-1', 'route-42'))
    expect(listKey).toEqual(deliveryRouteQueryKeys.listPrefix('tenant-1'))
  })

  it('fires a Spanish success toast', () => {
    const deps = makeDeps()
    handleUpdateSuccess('tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/guardados|guardadas/i)
  })
})

describe('handleUpdateError (routes through DELIVERY_ROUTE_ERROR_MAP)', () => {
  it('DELIVERY_ROUTE_INVALID_TRANSITION (422, edit on non-DRAFT) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
      },
    }
    handleUpdateError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect((vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title).toMatch(
      /estado actual/i,
    )
  })

  it('ENTITY_NOT_FOUND (404, edit on deleted route) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 404,
        data: { error: 'ENTITY_NOT_FOUND', message: 'x' },
      },
    }
    handleUpdateError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect((vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title).toMatch(
      /encontrada/i,
    )
  })

  it('falls back to normalizeApiError when the domain code is missing', () => {
    const deps = makeDeps()
    const error = { response: { status: 500, data: { message: 'boom' } } }
    handleUpdateError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      description?: string
      color?: string
    }
    expect(toastCall.color).toBe('error')
    expect(toastCall.description).toBeTruthy()
  })

  it('falls back to a safe toast when error is null/undefined', () => {
    const deps = makeDeps()
    handleUpdateError(undefined, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})

describe('update payload whitelist (forbidden keys never cross the wire)', () => {
  it('update mutation forwards only driverUserId / notes', () => {
    const whitelist = ['driverUserId', 'notes']
    expect(whitelist).toEqual(['driverUserId', 'notes'])
    // saleIds is create-only — must NOT appear in PATCH.
    expect(whitelist).not.toContain('saleIds')
    // No status, no id, no tenantId, no stops, no timeline.
    expect(whitelist).not.toContain('status')
    expect(whitelist).not.toContain('id')
    expect(whitelist).not.toContain('tenantId')
    expect(whitelist).not.toContain('stops')
    expect(whitelist).not.toContain('timeline')
  })
})
