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
 *   - `deliveryRouteRowActions(row, ctx)` — the ⋮ menu of a row, card or detail
 *       header, gated like the detail view.
 *   - `deliveryRouteRowLabel(row)` — names the row for the menu's aria-label.
 *   - `buildStopProgress(stops)` — the `x/y` delivered-stops counter
 *       (`"Sin paradas"` when empty, `"{completed}/{total}"` otherwise).
 *
 * Copy is sourced exclusively from `DELIVERY_ROUTE_COPY`; nothing in here
 * hardcodes Spanish. The DR-009 guard copy lives in the canonical Spanish
 * string below (matches the spec/delivery-route-management REQ-DRM-009 wording).
 */

import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { DELIVERY_ROUTE_COPY } from '../copy'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  type DeliveryRouteResponseDto,
  type DeliveryRouteStop,
} from '../interfaces/delivery-route.types'
import { buildRouteTitle } from './delivery-route-list.utils'

/**
 * Canonical Spanish copy for the inline reorder guard.
 *
 * Pinned by REQ-DRM-009 (`spec/delivery-route-management/spec.md`):
 *   "El orden debe incluir todas las paradas una sola vez"
 *
 * Exported for direct unit-test access and for callers that want to surface the
 * exact same text in a non-panel surface (e.g. an inline summary above the panel).
 */
const REORDER_GUARD_MESSAGE =
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

// ─── Row menu ───────────────────────────────────────────────────────────────

export interface DeliveryRouteRowActionContext {
  /** `update:DeliveryRoute` — gates Edit / Start / Cancel. */
  canUpdate: boolean
  /** `delete:DeliveryRoute` — gates Delete. */
  canDelete: boolean
}

/**
 * deliveryRouteRowActions — The ⋮ menu of a route row, card or detail header.
 *
 * Every gate mirrors `DeliveryRouteDetailView` exactly (REQ-DRM-011/013):
 *   - Edit:   DRAFT + canUpdate
 *   - Start:  DRAFT + at least one stop + canUpdate
 *   - Cancel: DRAFT or ACTIVE + canUpdate
 *   - Delete: DRAFT + zero stops + canDelete
 * "Ver detalle" leads, destructive goes last, and the items that open a
 * confirmation end in an ellipsis. When "Ver detalle" would be the only item it
 * only repeats the row click, so the menu is empty and the ⋮ is not drawn.
 */
export function deliveryRouteRowActions(
  row: DeliveryRouteResponseDto,
  ctx: DeliveryRouteRowActionContext,
): RowAction[] {
  const isDraft = row.status === 'DRAFT'
  const { actions } = DELIVERY_ROUTE_COPY
  const items: RowAction[] = []
  if (ctx.canUpdate && isDraft) {
    items.push({ key: 'edit', label: actions.edit, icon: 'i-lucide-pencil' })
    if (row.stops.length > 0) {
      items.push({ key: 'start', label: `${actions.start}…`, icon: 'i-lucide-play' })
    }
  }
  if (ctx.canUpdate && (isDraft || row.status === 'ACTIVE')) {
    items.push({ key: 'cancel', label: `${actions.cancel}…`, icon: 'i-lucide-ban' })
  }
  if (ctx.canDelete && isDraft && row.stops.length === 0) {
    items.push({ key: 'delete', label: `${actions.delete}…`, icon: 'i-lucide-trash-2', destructive: true })
  }
  if (items.length === 0) return []
  return [{ key: 'view', label: actions.view, icon: 'i-lucide-eye' }, ...items]
}

/** Names a route for the menu trigger: "la ruta del 13 oct de Juan Pérez, borrador". */
export function deliveryRouteRowLabel(row: DeliveryRouteResponseDto): string {
  const who = row.driver ? `de ${row.driver.name}` : 'sin repartidor'
  const status = DELIVERY_ROUTE_STATUS_LABELS[row.status].toLowerCase()
  return `la ${buildRouteTitle(row).toLowerCase()} ${who}, ${status}`
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
