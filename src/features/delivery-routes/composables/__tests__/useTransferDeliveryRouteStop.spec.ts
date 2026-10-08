// useTransferDeliveryRouteStop.spec.ts — STRICT-TDD tests for the draft-to-draft
// stop transfer flow (T3 S2/S4).
//
// Contract (backend `POST /delivery-routes/:routeId/stops/:stopId/transfer`):
//   - Response is a TUPLE `{ originRoute, destinationRoute }`, NOT a single route.
//   - On success BOTH detail cache keys are invalidated (origin + destination),
//     plus the route list prefix, the confirmed-sales prefix and the
//     eligible-sales prefix (imported helper — the selector is not edited).
//   - The destination picker lists `GET /delivery-routes?status=DRAFT` and MUST
//     exclude the origin route (source and destination must differ).
//   - The transfer mutation never asks the caller to trust a single route.

import { describe, it, expect, vi } from 'vitest'

import {
  handleTransferSuccess,
  filterTransferDestinations,
  transferDestinationsQueryKey,
  type TransferMutationDeps,
} from '../useTransferDeliveryRouteStop'
import { deliveryRouteQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import { eligibleSalesQueryKeys } from '../useEligibleSales'
import type { DeliveryRouteResponseDto } from '../../interfaces/delivery-route.types'

function makeRoute(overrides: Partial<DeliveryRouteResponseDto> = {}): DeliveryRouteResponseDto {
  return {
    id: 'route-1',
    status: 'DRAFT',
    driver: { id: 'd-1', name: 'Carlos', email: 'c@x.com' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
    ...overrides,
  }
}

function makeDeps(overrides: Partial<TransferMutationDeps> = {}): TransferMutationDeps {
  return {
    invalidateDetail: vi.fn(),
    invalidateList: vi.fn(),
    invalidateConfirmedSales: vi.fn(),
    invalidateEligibleSales: vi.fn(),
    addToast: vi.fn(),
    ...overrides,
  }
}

describe('handleTransferSuccess (T3 S2/S4, both-route refresh)', () => {
  it('invalidates BOTH the origin and the destination detail keys', () => {
    const deps = makeDeps()
    handleTransferSuccess('tenant-1', { originRouteId: 'route-A', destinationRouteId: 'route-B' }, deps)
    expect(deps.invalidateDetail).toHaveBeenCalledTimes(2)
    const keys = vi
      .mocked(deps.invalidateDetail)
      .mock.calls.map((c) => (c[0] as { queryKey?: readonly unknown[] })?.queryKey)
    expect(keys).toContainEqual(deliveryRouteQueryKeys.detail('tenant-1', 'route-A'))
    expect(keys).toContainEqual(deliveryRouteQueryKeys.detail('tenant-1', 'route-B'))
  })

  it('invalidates the route list prefix exactly once', () => {
    const deps = makeDeps()
    handleTransferSuccess('tenant-1', { originRouteId: 'route-A', destinationRouteId: 'route-B' }, deps)
    expect(deps.invalidateList).toHaveBeenCalledTimes(1)
    const listCall = vi.mocked(deps.invalidateList).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    }
    expect(listCall?.queryKey).toEqual(deliveryRouteQueryKeys.listPrefix('tenant-1'))
  })

  it('invalidates the confirmed-sales prefix so availability refreshes', () => {
    const deps = makeDeps()
    handleTransferSuccess('tenant-1', { originRouteId: 'route-A', destinationRouteId: 'route-B' }, deps)
    expect(deps.invalidateConfirmedSales).toHaveBeenCalledTimes(1)
    const call = vi.mocked(deps.invalidateConfirmedSales).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    }
    expect(call?.queryKey).toEqual(saleQueryKeys.confirmedPrefix('tenant-1'))
  })

  it('invalidates the eligible-sales prefix (imported helper, selector untouched)', () => {
    const deps = makeDeps()
    handleTransferSuccess('tenant-1', { originRouteId: 'route-A', destinationRouteId: 'route-B' }, deps)
    expect(deps.invalidateEligibleSales).toHaveBeenCalledTimes(1)
    const call = vi.mocked(deps.invalidateEligibleSales).mock.calls[0]?.[0] as {
      queryKey?: readonly unknown[]
    }
    expect(call?.queryKey).toEqual(eligibleSalesQueryKeys.listPrefix('tenant-1'))
  })

  it('fires the Spanish success toast', () => {
    const deps = makeDeps()
    handleTransferSuccess('tenant-1', { originRouteId: 'route-A', destinationRouteId: 'route-B' }, deps)
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toast = vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string; color?: string }
    expect(toast.color).toBe('success')
    expect(toast.title).toMatch(/movida/i)
  })
})

describe('transferDestinationsQueryKey', () => {
  it('keys the DRAFT destination list on the delivery-routes list prefix', () => {
    expect(transferDestinationsQueryKey('tenant-1')).toEqual(
      deliveryRouteQueryKeys.list('tenant-1', { status: 'DRAFT' }),
    )
  })
})

describe('filterTransferDestinations', () => {
  it('excludes the origin route (source and destination must differ)', () => {
    const routes = [makeRoute({ id: 'A' }), makeRoute({ id: 'B' }), makeRoute({ id: 'C' })]
    const out = filterTransferDestinations(routes, 'B')
    expect(out.map((r) => r.id)).toEqual(['A', 'C'])
  })

  it('returns an empty array when the only draft is the origin', () => {
    expect(filterTransferDestinations([makeRoute({ id: 'A' })], 'A')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const routes = [makeRoute({ id: 'A' }), makeRoute({ id: 'B' })]
    filterTransferDestinations(routes, 'A')
    expect(routes.map((r) => r.id)).toEqual(['A', 'B'])
  })
})
