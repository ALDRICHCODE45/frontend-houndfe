/**
 * delivery-route-actions.utils.ts — S5a (sdd delivery-routes, design.md §4.1, §10.2)
 *
 * Pure builders + guards for the manager surface. No Vue / Pinia / axios / toast
 * coupling — every helper here is a pure function the specs can drive without
 * any runtime stubs.
 *
 * Public surface:
 *   - `assertReorderCoversStops(orderedStopIds, existingStopIds): string | null`
 *       exactly-once guard. Returns an inline Spanish message on
 *       (length mismatch | unknown id | duplicate), else `null`.
 *   - `buildDeliveryRouteRowActions(row, ctx)` — dropdown sections per the
 *       manager gate contract (edit / start / cancel / delete / reorderStops).
 *   - `buildDeliveryRouteStartActions(row, ctx)` — the START-only kebab
 *       section for the manager list (DRAFT + canUpdate + ≥1 stop gate,
 *       mirroring the detail-view `canShowStart` rules).
 *   - `buildStopProgress(stops)` — the `x/y` delivered-stops counter
 *       (`"Sin paradas"` when empty, `"{completed}/{total}"` otherwise).
 *
 * Copy is sourced exclusively from `DELIVERY_ROUTE_COPY`; nothing in here
 * hardcodes Spanish. The DR-009 guard copy lives in the canonical Spanish
 * string below (matches the spec/delivery-route-management REQ-DRM-009 wording).
 */

import { DELIVERY_ROUTE_COPY } from '../copy'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../interfaces/delivery-route.types'

/**
 * Canonical Spanish copy for the inline reorder guard.
 *
 * Pinned by REQ-DRM-009 (`spec/delivery-route-management/spec.md`):
 *   "El orden debe incluir todas las paradas una sola vez"
 *
 * Exported for direct unit-test access and for callers that want to surface the
 * exact same text in a non-panel surface (e.g. an inline summary above the panel).
 */
export const REORDER_GUARD_MESSAGE =
  'El orden debe incluir todas las paradas una sola vez.'

/**
 * assertReorderCoversStops — Exactly-once guard for the PUT /stops/reorder body.
 *
 * Returns `null` when every existing stop id appears in `orderedStopIds` exactly
 * once. Otherwise returns the canonical Spanish inline error the panel renders
 * inline and the request is BLOCKED on the panel's submit path (defensive — DnD
 * cannot normally produce this state, but the guard is the single source of
 * truth for the contract).
 *
 * The backend also enforces this contract (`forbidNonWhitelisted` + 422
 * `DELIVERY_ROUTE_INVALID_TRANSITION`); the client-side guard prevents a
 * pointless network round-trip and gives the user immediate feedback.
 */
export function assertReorderCoversStops(
  orderedStopIds: readonly string[],
  existingStopIds: readonly string[],
): string | null {
  // Length differs ⇒ at least one id is missing or extra.
  if (orderedStopIds.length !== existingStopIds.length) return REORDER_GUARD_MESSAGE

  const seen = new Set<string>()
  const existing = new Set(existingStopIds)
  for (const id of orderedStopIds) {
    // Unknown id (not in existing set).
    if (!existing.has(id)) return REORDER_GUARD_MESSAGE
    // Duplicate id (already seen).
    if (seen.has(id)) return REORDER_GUARD_MESSAGE
    seen.add(id)
  }
  return null
}

// ─── Row-action builder ─────────────────────────────────────────────────────

export interface DeliveryRouteRowActionItem {
  /** Label sourced verbatim from DELIVERY_ROUTE_COPY. */
  label: string
  /** Optional UDropdownMenu color hint (`'error'` on destructive). */
  color?: 'error'
  /** Invoked when the user selects the item. */
  onSelect: () => void
}

export interface DeliveryRouteRowActionContext {
  /** `update:DeliveryRoute` — gates Edit / Start / Cancel / Reorder. */
  canUpdate: boolean
  /** `delete:DeliveryRoute` — gates Delete. */
  canDelete: boolean
  onEdit: (row: DeliveryRouteResponseDto) => void
  onStart: (row: DeliveryRouteResponseDto) => void
  onCancel: (row: DeliveryRouteResponseDto) => void
  onDelete: (row: DeliveryRouteResponseDto) => void
  onReorder: (row: DeliveryRouteResponseDto) => void
}

/**
 * buildDeliveryRouteRowActions — Build the manager-list kebab menu sections.
 *
 * Returns a flat array of sections (the parent passes it to `UDropdownMenu.items`
 * — sections are `UDropdownMenu` "group" rows that render a divider + their
 * children). Sections with zero items are filtered out.
 *
 *   - `canUpdate` only     → [ [Editar, Iniciar, Cancelar, Reordenar] ]
 *   - `canDelete` only     → [ [Eliminar (error)] ]
 *   - both                 → [ [Editar, Iniciar, Cancelar, Reordenar, Eliminar (error)] ]
 *   - neither              → [ ]  (parent hides the kebab)
 *
 * The order inside each section is stable: edit → start → cancel → reorder
 * → delete (the destructive item is always last, separated from the main
 * group by a divider when both `canUpdate` and `canDelete` are held).
 */
export function buildDeliveryRouteRowActions(
  row: DeliveryRouteResponseDto,
  ctx: DeliveryRouteRowActionContext,
): DeliveryRouteRowActionItem[][] {
  const main: DeliveryRouteRowActionItem[] = []
  if (ctx.canUpdate) {
    main.push({ label: DELIVERY_ROUTE_COPY.actions.edit, onSelect: () => ctx.onEdit(row) })
    main.push({ label: DELIVERY_ROUTE_COPY.actions.start, onSelect: () => ctx.onStart(row) })
    main.push({ label: DELIVERY_ROUTE_COPY.actions.cancel, onSelect: () => ctx.onCancel(row) })
    main.push({
      label: DELIVERY_ROUTE_COPY.actions.reorderStops,
      onSelect: () => ctx.onReorder(row),
    })
  }
  const destructive: DeliveryRouteRowActionItem[] = ctx.canDelete
    ? [
        {
          label: DELIVERY_ROUTE_COPY.actions.delete,
          color: 'error',
          onSelect: () => ctx.onDelete(row),
        },
      ]
    : []
  return [main, destructive].filter((section) => section.length > 0)
}

// ─── START-only row-action builder (manager list kebab) ───────────────────────

export interface DeliveryRouteStartActionContext {
  /** `update:DeliveryRoute` — gates the start action. */
  canUpdate: boolean
  /** Invoked with the row when "Iniciar ruta" is selected. */
  onStart: (row: DeliveryRouteResponseDto) => void
}

/**
 * buildDeliveryRouteStartActions — Build the manager-list kebab content for the
 * START action only (S5b start wiring).
 *
 * Gating mirrors the detail-view `canShowStart` rules EXACTLY (REQ-DRM-013):
 *   - `row.status === 'DRAFT'`
 *   - `row.stops.length > 0` (the backend rejects empty-route starts with
 *     422 DELIVERY_ROUTE_INVALID_TRANSITION)
 *   - `canUpdate` (CASL `update:DeliveryRoute`)
 *
 * Returns a single section `[[{ label: 'Iniciar ruta', onSelect }]]` when ALL
 * rules pass, else `[]` — the parent hides the kebab on `[]`, the same
 * contract as `buildDeliveryRouteRowActions`. The label is sourced verbatim
 * from `DELIVERY_ROUTE_COPY.actions.start` (never hardcoded Spanish).
 */
export function buildDeliveryRouteStartActions(
  row: DeliveryRouteResponseDto,
  ctx: DeliveryRouteStartActionContext,
): DeliveryRouteRowActionItem[][] {
  if (row.status !== 'DRAFT') return []
  if (row.stops.length === 0) return []
  if (!ctx.canUpdate) return []
  return [
    [
      {
        label: DELIVERY_ROUTE_COPY.actions.start,
        onSelect: () => ctx.onStart(row),
      },
    ],
  ]
}

// ─── Stop-progress builder ──────────────────────────────────────────────────

/**
 * buildStopProgress — The x/y delivered-stops counter (REQ-DRM-001).
 *
 *   - `[]`                            → `"Sin paradas"`
 *   - `[s1, s2, s3, ...]`             → `"{completed}/{total}"` where `completed`
 *                                       is the count of stops with
 *                                       `status === 'COMPLETED'`.
 *
 * Pure, never throws on empty input. The manager list view also has an inline
 * version (kept for backwards compatibility with the S4c view); this util is
 * the canonical source for the value any cell / card / timeline uses.
 */
export function buildStopProgress(stops: readonly DeliveryRouteStop[]): string {
  const total = stops.length
  if (total === 0) return 'Sin paradas'
  let completed = 0
  for (const stop of stops) {
    if (stop.status === 'COMPLETED') completed += 1
  }
  return `${completed}/${total}`
}
