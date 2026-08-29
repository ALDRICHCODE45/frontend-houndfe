// delivery-route-actions.utils.spec.ts — STRICT-TDD tests for the pure utility.
//
// Contract (sdd delivery-routes S5a, design.md §4.1, §10.2, REQ-DRM-009):
//   - `assertReorderCoversStops(orderedStopIds, existingStopIds)`:
//       • length mismatch           → returns inline Spanish message (NOT null).
//       • unknown id in ordered     → returns inline Spanish message.
//       • duplicate id in ordered   → returns inline Spanish message.
//       • valid (exactly-once)      → returns null.
//   - `buildDeliveryRouteRowActions(row, ctx)`:
//       • returns the manager dropdown sections per the gate contract
//         (edit + start + cancel + delete + reorderStops), each item carrying
//         `label`, optional `color: 'error'`, and an `onSelect` callback.
//       • sections with zero items are filtered out (so the parent can pass
//         the result verbatim to UDropdownMenu).
//       • never includes keys the caller didn't ask for (no `disabled` items).
//   - `buildDeliveryRouteStartActions(row, ctx)`:
//       • START-only kebab content for the manager list; returns a single
//         section with `DELIVERY_ROUTE_COPY.actions.start` when the row is
//         DRAFT + canUpdate + has at least one stop (REQ-DRM-011/013), else `[]`.
//       • the parent hides the kebab on `[]` (same contract as the full builder).
//   - `buildStopProgress(stops)`:
//       • `"Sin paradas"` when stops is empty.
//       • `"{completed}/{total}"` when stops is non-empty.
//   - All builders source labels from `DELIVERY_ROUTE_COPY` (never hardcode
//     Spanish inline) — the spec pins every label via the copy tree.
//
// Pure helpers; no Vue / no axios / no Pinia. Tests run without `global.stubs`.

import { describe, it, expect, vi } from 'vitest'

import {
  assertReorderCoversStops,
  buildDeliveryRouteRowActions,
  buildDeliveryRouteStartActions,
  buildStopProgress,
} from '../delivery-route-actions.utils'
import { DELIVERY_ROUTE_COPY } from '../../copy'
import type { DeliveryRouteResponseDto } from '../../interfaces/delivery-route.types'

function makeStop(
  id: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' = 'PENDING',
) {
  return {
    id,
    saleId: `sale-${id}`,
    saleFolio: null,
    sortOrder: 0,
    status,
    checkedInAt: null,
    completedAt: null,
    customer: null,
    shippingAddress: null,
  }
}

function makeRoute(
  overrides: Partial<DeliveryRouteResponseDto> = {},
): DeliveryRouteResponseDto {
  return {
    id: 'route-1',
    status: 'DRAFT',
    driver: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
    ...overrides,
  }
}

describe('assertReorderCoversStops (sdd delivery-routes S5a, design §10.2, REQ-DRM-009)', () => {
  it('returns null when every existing stop is present exactly once (valid reorder)', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s3', 's1', 's2']
    expect(assertReorderCoversStops(ordered, existing)).toBeNull()
  })

  it('returns a non-null inline Spanish message when the length differs (dropped stop)', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's3']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).not.toBeNull()
    expect(msg).toMatch(/paradas/i)
    expect(msg!.length).toBeGreaterThan(0)
  })

  it('returns a non-null inline Spanish message when an unknown id is in the ordered list', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's2', 'unknown-id']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).not.toBeNull()
    expect(msg).toMatch(/paradas/i)
  })

  it('returns a non-null inline Spanish message when an id appears twice (duplicate)', () => {
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's2', 's2']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).not.toBeNull()
    expect(msg).toMatch(/paradas/i)
  })

  it('matches the canonical copy used by the UI (regression pin)', () => {
    // The DR-009 spec wording is "El orden debe incluir todas las paradas una
    // sola vez". We assert the Spanish copy matches the canonical phrase so a
    // future copy change is visible in this spec.
    const existing = ['s1', 's2', 's3']
    const ordered = ['s1', 's3']
    const msg = assertReorderCoversStops(ordered, existing)
    expect(msg).toMatch(/incluir todas las paradas una sola vez/i)
  })

  it('returns a non-null message when the ordered list is empty but existing has stops', () => {
    const existing = ['s1', 's2']
    const ordered: string[] = []
    expect(assertReorderCoversStops(ordered, existing)).not.toBeNull()
  })

  it('returns null when both lists are empty (vacuously satisfied)', () => {
    expect(assertReorderCoversStops([], [])).toBeNull()
  })
})

describe('buildDeliveryRouteRowActions (sdd delivery-routes S5a, design §4.1)', () => {
  const row = makeRoute({ id: 'route-1' })

  it('returns two sections (main + destructive) when all permissions are held; delete carries color: error', () => {
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: true,
      canDelete: true,
      onEdit: () => {},
      onStart: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onReorder: () => {},
    })
    // 2 sections: main (4 items) + destructive (Eliminar, color: error).
    expect(sections).toHaveLength(2)
    expect(sections[0]!.map((item) => item.label)).toEqual([
      DELIVERY_ROUTE_COPY.actions.edit,
      DELIVERY_ROUTE_COPY.actions.start,
      DELIVERY_ROUTE_COPY.actions.cancel,
      DELIVERY_ROUTE_COPY.actions.reorderStops,
    ])
    expect(sections[1]!.map((item) => item.label)).toEqual([
      DELIVERY_ROUTE_COPY.actions.delete,
    ])
    expect(sections[1]![0]!.color).toBe('error')
  })

  it('omits the destructive delete item when canDelete is false (still labels it as `color: error` when shown)', () => {
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: true,
      canDelete: false,
      onEdit: () => {},
      onStart: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onReorder: () => {},
    })
    const labels = sections[0]!.map((item) => item.label)
    expect(labels).not.toContain(DELIVERY_ROUTE_COPY.actions.delete)
    expect(labels).toContain(DELIVERY_ROUTE_COPY.actions.edit)
    expect(labels).toContain(DELIVERY_ROUTE_COPY.actions.reorderStops)
  })

  it('omits edit/start/cancel/reorder when canUpdate is false; keeps delete only if canDelete is true', () => {
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: false,
      canDelete: true,
      onEdit: () => {},
      onStart: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onReorder: () => {},
    })
    expect(sections).toHaveLength(1)
    expect(sections[0]!.map((item) => item.label)).toEqual([
      DELIVERY_ROUTE_COPY.actions.delete,
    ])
    expect(sections[0]![0]!.color).toBe('error')
  })

  it('returns an empty array when neither permission is held (parent hides the kebab)', () => {
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: false,
      canDelete: false,
      onEdit: () => {},
      onStart: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onReorder: () => {},
    })
    expect(sections).toEqual([])
  })

  it('invokes the supplied onEdit callback with the row when "Editar" is selected', () => {
    const onEdit = vi.fn()
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: true,
      canDelete: false,
      onEdit,
      onStart: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onReorder: () => {},
    })
    const editItem = sections[0]!.find((item) => item.label === DELIVERY_ROUTE_COPY.actions.edit)!
    editItem.onSelect()
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith(row)
  })

  it('invokes the supplied onReorder callback with the row when "Reordenar paradas" is selected', () => {
    const onReorder = vi.fn()
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: true,
      canDelete: false,
      onEdit: () => {},
      onStart: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onReorder,
    })
    const item = sections[0]!.find((i) => i.label === DELIVERY_ROUTE_COPY.actions.reorderStops)!
    item.onSelect()
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(row)
  })

  it('invokes the supplied onDelete callback with the row when "Eliminar" is selected', () => {
    const onDelete = vi.fn()
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: false,
      canDelete: true,
      onEdit: () => {},
      onStart: () => {},
      onCancel: () => {},
      onDelete,
      onReorder: () => {},
    })
    sections[0]![0]!.onSelect()
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(row)
  })

  it('sources every action label from DELIVERY_ROUTE_COPY.actions.* (no inline copy)', () => {
    // Regression pin: every label MUST equal the canonical copy string.
    const sections = buildDeliveryRouteRowActions(row, {
      canUpdate: true,
      canDelete: true,
      onEdit: () => {},
      onStart: () => {},
      onCancel: () => {},
      onDelete: () => {},
      onReorder: () => {},
    })
    const allLabels = sections.flatMap((section) => section.map((i) => i.label))
    const expected = [
      DELIVERY_ROUTE_COPY.actions.edit,
      DELIVERY_ROUTE_COPY.actions.start,
      DELIVERY_ROUTE_COPY.actions.cancel,
      DELIVERY_ROUTE_COPY.actions.reorderStops,
      DELIVERY_ROUTE_COPY.actions.delete,
    ]
    expect(allLabels).toEqual(expected)
  })
})

describe('buildDeliveryRouteStartActions (START-only kebab gate, REQ-DRM-011/013)', () => {
  // DRAFT + one stop — the happy path every gate test starts from.
  const startableRow = makeRoute({ id: 'route-1', stops: [makeStop('s1')] })

  it('returns a single section with the canonical start label when DRAFT + canUpdate + has stops', () => {
    const sections = buildDeliveryRouteStartActions(startableRow, {
      canUpdate: true,
      onStart: () => {},
    })
    expect(sections).toHaveLength(1)
    expect(sections[0]).toHaveLength(1)
    expect(sections[0]![0]!.label).toBe(DELIVERY_ROUTE_COPY.actions.start)
  })

  it('returns an empty array for every non-DRAFT status (status gate)', () => {
    for (const status of ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const) {
      const sections = buildDeliveryRouteStartActions(
        { ...startableRow, status },
        { canUpdate: true, onStart: () => {} },
      )
      expect(sections).toEqual([])
    }
  })

  it('returns an empty array when the route has no stops (stop gate — backend 422)', () => {
    const sections = buildDeliveryRouteStartActions(
      makeRoute({ id: 'route-1' }), // stops: []
      { canUpdate: true, onStart: () => {} },
    )
    expect(sections).toEqual([])
  })

  it('returns an empty array when the user cannot update DeliveryRoute (permission gate)', () => {
    const sections = buildDeliveryRouteStartActions(startableRow, {
      canUpdate: false,
      onStart: () => {},
    })
    expect(sections).toEqual([])
  })

  it('invokes the supplied onStart callback with the row when "Iniciar ruta" is selected', () => {
    const onStart = vi.fn()
    const sections = buildDeliveryRouteStartActions(startableRow, { canUpdate: true, onStart })
    sections[0]![0]!.onSelect()
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(startableRow)
  })

  it('sources the label verbatim from DELIVERY_ROUTE_COPY.actions.start (no inline copy)', () => {
    const sections = buildDeliveryRouteStartActions(startableRow, {
      canUpdate: true,
      onStart: () => {},
    })
    expect(sections[0]![0]!.label).toBe(DELIVERY_ROUTE_COPY.actions.start)
    expect(sections[0]![0]!.label).toBe('Iniciar ruta')
  })
})

describe('buildStopProgress (sdd delivery-routes S5a, design §4.1, REQ-DRM-001)', () => {
  it('returns "Sin paradas" when the stops array is empty', () => {
    expect(buildStopProgress([])).toBe('Sin paradas')
  })

  it('returns "{completed}/{total}" when stops are present', () => {
    const stops = [
      makeStop('s1', 'COMPLETED'),
      makeStop('s2', 'COMPLETED'),
      makeStop('s3', 'PENDING'),
      makeStop('s4', 'PENDING'),
    ]
    expect(buildStopProgress(stops)).toBe('2/4')
  })

  it('returns "{0}/{total}" when no stops have been delivered', () => {
    const stops = [makeStop('s1', 'PENDING'), makeStop('s2', 'PENDING')]
    expect(buildStopProgress(stops)).toBe('0/2')
  })

  it('returns "{total}/{total}" when all stops are COMPLETED', () => {
    const stops = [
      makeStop('s1', 'COMPLETED'),
      makeStop('s2', 'COMPLETED'),
      makeStop('s3', 'COMPLETED'),
    ]
    expect(buildStopProgress(stops)).toBe('3/3')
  })

  it('only counts COMPLETED stops (SKIPPED / IN_PROGRESS / PENDING do not contribute)', () => {
    const stops = [
      makeStop('s1', 'COMPLETED'),
      makeStop('s2', 'SKIPPED'),
      makeStop('s3', 'IN_PROGRESS'),
      makeStop('s4', 'PENDING'),
    ]
    expect(buildStopProgress(stops)).toBe('1/4')
  })
})
