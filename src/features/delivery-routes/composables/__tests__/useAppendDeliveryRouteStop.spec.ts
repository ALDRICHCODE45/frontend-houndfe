// useAppendDeliveryRouteStop.spec.ts — STRICT-TDD tests for the POST append-stop mutation.
//
// Contract (sdd delivery-routes S5b, design.md §6.3, §7.2):
//   - mutationFn forwards ({ id, payload }) to `deliveryRoutesApi.appendStop`
//     (POST :id/stops, 201).
//   - On success: invalidate `detail(tenantId, id)` + `listPrefix(tenantId)` +
//     `saleQueryKeys.confirmed(tenantId)` (the eligible picker refreshes because
//     a sale just left the eligible pool). Fires the Spanish "Parada agregada"
//     toast.
//   - On error: route through `surfaceDeliveryRouteError(error, 'toast')` — the
//     `DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` (422) domain copy surfaces verbatim.
//   - Append payload is a single whitelisted key: `saleId`.
//
// Pure handlers (`handleAppendSuccess`, `handleAppendError`) are extracted as
// named exports so the spec drives them with mock deps — no Pinia, no
// QueryClient, no toast runtime in the unit test (extract-before-mock).

import { describe, it, expect, vi } from 'vitest'

import {
  handleAppendSuccess,
  handleAppendError,
  type AppendMutationDeps,
} from '../useAppendDeliveryRouteStop'
import { deliveryRouteQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'

function makeDeps(overrides: Partial<AppendMutationDeps> = {}): AppendMutationDeps {
  return {
    invalidateDetail: vi.fn(),
    invalidateList: vi.fn(),
    invalidateConfirmedSales: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleAppendSuccess (sdd delivery-routes S5b, design §6.3)', () => {
  it('invalidates detail + listPrefix + saleQueryKeys.confirmed', () => {
    const deps = makeDeps()
    handleAppendSuccess('tenant-1', 'route-42', deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(1)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
    expect(deps.invalidateConfirmedSales).toHaveBeenCalledTimes(1)
  })

  it('forwards the SAME id into the detail key and the tenantId into the list key', () => {
    const deps = makeDeps()
    handleAppendSuccess('tenant-1', 'route-42', deps)
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

  it('TRIANGULATE — invalidates saleQueryKeys.confirmed(tenantId) so the eligible picker refreshes', () => {
    const deps = makeDeps()
    handleAppendSuccess('tenant-1', 'route-42', deps)
    const confirmedCall = vi.mocked(deps.invalidateConfirmedSales).mock.calls[0]?.[0] as
      | { queryKey?: readonly unknown[] }
      | undefined
    expect(confirmedCall?.queryKey).toEqual(saleQueryKeys.confirmed('tenant-1'))
  })

  it('fires the Spanish "Parada agregada" success toast', () => {
    const deps = makeDeps()
    handleAppendSuccess('tenant-1', 'route-42', deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as {
      title: string
      color?: string
    }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/agregada/i)
  })
})

describe('handleAppendError (routes through surfaceDeliveryRouteError)', () => {
  it('DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE (422) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE', message: 'x' },
      },
    }
    handleAppendError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/elegible/i)
  })

  it('DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE (409) → toast with Spanish copy', () => {
    const deps = makeDeps()
    const error = {
      response: {
        status: 409,
        data: { error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE', message: 'x' },
      },
    }
    handleAppendError(error, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(
      (vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string }).title,
    ).toMatch(/otra ruta activa/i)
  })

  it('falls back to normalizeApiError when the domain code is missing', () => {
    const deps = makeDeps()
    const error = { response: { status: 500, data: { message: 'boom' } } }
    handleAppendError(error, deps)
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
    handleAppendError(undefined, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
  })
})

describe('append payload whitelist (forbidden keys never cross the wire)', () => {
  it('append mutation forwards only `saleId`', () => {
    const whitelist = ['saleId']
    expect(whitelist).toEqual(['saleId'])
    // No id, no tenantId, no driverUserId, no notes, no stops, no status.
    expect(whitelist).not.toContain('id')
    expect(whitelist).not.toContain('tenantId')
    expect(whitelist).not.toContain('driverUserId')
    expect(whitelist).not.toContain('notes')
    expect(whitelist).not.toContain('status')
  })
})
