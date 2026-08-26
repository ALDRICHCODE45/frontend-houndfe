import type {
  ActivePaymentMethodProjection,
  CollectionPaymentMethod,
  PaymentEntry,
} from '../interfaces/sale.types'
import { PAYMENT_METHOD_CATEGORY_ICONS, type PaymentMethodCategory } from '@/core/shared/constants/payment-method-category'

/**
 * paymentMethodTile.utils.ts — sdd custom-payment-methods S4A (design §1.2)
 *
 * THE single source for tile identity, matching, and key derivation. Every
 * surface that toggles / counts / displays payment-method tiles MUST go
 * through this util — NEVER re-implement the matcher or key derivation
 * locally (the legacy `method`-keyed matcher collides with the new
 * `paymentMethodId`-keyed matcher and is exactly the bug this slice fixes).
 *
 * Critical invariants (pinned by `__tests__/paymentMethodTile.utils.spec.ts`):
 *   - Two customs of the same `category` get DISTINCT keys (UUID, not category).
 *   - A custom `transfer` entry NEVER collides with the fixed `Transferencia`
 *     tile (the fixed-matcher guard: `entry.paymentMethodId === undefined`).
 *   - `buildMergedMethodOptions` drops customs with non-UUID ids
 *     (REO-PT-003 defense-in-depth; the backend never sends non-UUID ids, but
 *     a future serializer change cannot introduce one without explicit opt-in).
 */

// ── Tile model ─────────────────────────────────────────────────────────────────

export interface FixedPaymentMethodTile {
  kind: 'fixed'
  value: CollectionPaymentMethod
  label: string
  icon: string
  paymentMethodId: undefined
}

export interface CustomPaymentMethodTile {
  kind: 'custom'
  value: CollectionPaymentMethod
  label: string
  icon: string
  subtitle: string | null
  paymentMethodId: string
}

export type PaymentMethodTile = FixedPaymentMethodTile | CustomPaymentMethodTile

const FIXED_TILE_DEFS: ReadonlyArray<{ value: CollectionPaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card_credit', label: 'Tarjeta crédito' },
  { value: 'card_debit', label: 'Tarjeta débito' },
  { value: 'transfer', label: 'Transferencia' },
]

export const FIXED_METHOD_OPTIONS: readonly FixedPaymentMethodTile[] = FIXED_TILE_DEFS.map(
  (def): FixedPaymentMethodTile => ({
    kind: 'fixed',
    value: def.value,
    label: def.label,
    icon: PAYMENT_METHOD_CATEGORY_ICONS[def.value],
    paymentMethodId: undefined,
  }),
)

/**
 * toCustomTile — convert a single projection into a custom tile. Pure.
 */
export function toCustomTile(m: ActivePaymentMethodProjection): CustomPaymentMethodTile {
  return {
    kind: 'custom',
    value: m.category as CollectionPaymentMethod,
    label: m.name,
    icon: PAYMENT_METHOD_CATEGORY_ICONS[m.category as PaymentMethodCategory] ?? 'i-lucide-circle-help',
    subtitle: m.subtitle,
    paymentMethodId: m.id,
  }
}

/**
 * buildMergedMethodOptions — 4 fixed tiles + N custom tiles (after UUID
 * filter). Customs appear in the projection order (backend returns ordered by
 * name asc per REQ-PT-003). Drops customs whose id is not a canonical UUID
 * (REO-PT-003 defense-in-depth).
 */
export function buildMergedMethodOptions(
  customs: ActivePaymentMethodProjection[],
): PaymentMethodTile[] {
  const validCustoms = customs.filter((m) => isUuidString(m.id))
  return [...FIXED_METHOD_OPTIONS, ...validCustoms.map(toCustomTile)]
}

// ── THE key derivation (single source) ────────────────────────────────────────

/**
 * paymentMethodTileKey — tile identity key. `paymentMethodId ?? tile.value`.
 * Used for the grid `:key`, the entries-list `:key`, and the matcher's
 * "find" semantics.
 */
export function paymentMethodTileKey(tile: PaymentMethodTile): string {
  return tile.paymentMethodId ?? tile.value
}

/**
 * paymentEntryKey — entry identity key. Mirror of `paymentMethodTileKey`:
 * `paymentMethodId ?? entry.method`.
 */
export function paymentEntryKey(entry: PaymentEntry): string {
  return entry.paymentMethodId ?? entry.method
}

// ── UUID guard ────────────────────────────────────────────────────────────────

/**
 * isUuidString — strict v4-ish check. Accepts canonical UUIDs (8-4-4-4-12 hex
 * with a v4 marker at position 14 of the canonical form). Defensive against
 * accidental non-UUID ids slipping into `buildMergedMethodOptions`.
 */
export function isUuidString(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  // Canonical UUID v4 pattern: 8-4-4-4-12 hex, version digit '4', variant nibble [89ab].
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

// ── Matching (toggle + count + entries list all use this) ─────────────────────

/**
 * entryMatchesTile — THE matcher.
 *
 *   - For a CUSTOM tile, the entry must carry `paymentMethodId === tile.paymentMethodId`.
 *   - For a FIXED tile, the entry must have `paymentMethodId === undefined`
 *     (the load-bearing fixed-matcher guard per REO-PT-001 / design §11) AND
 *     `method === tile.value`. This guarantees a custom `transfer` entry
 *     never matches the fixed `Transferencia` tile.
 */
export function entryMatchesTile(entry: PaymentEntry, tile: PaymentMethodTile): boolean {
  if (tile.kind === 'custom') {
    return entry.paymentMethodId === tile.paymentMethodId
  }
  return entry.paymentMethodId === undefined && entry.method === tile.value
}

export function findEntryIndex(
  entries: readonly PaymentEntry[],
  tile: PaymentMethodTile,
): number {
  return entries.findIndex((e) => entryMatchesTile(e, tile))
}

export function getMethodCount(
  entries: readonly PaymentEntry[],
  tile: PaymentMethodTile,
): number {
  // Each identity maps to at most one entry → 0 or 1 (equivalent to legacy
  // for fixed tiles).
  return findEntryIndex(entries, tile) >= 0 ? 1 : 0
}

export function findTileForEntry(
  tiles: readonly PaymentMethodTile[],
  entry: PaymentEntry,
): PaymentMethodTile | undefined {
  return tiles.find((t) => entryMatchesTile(entry, t))
}

// ── Display resolver (REQ-CAT-005 / REQ-CAT-006) ──────────────────────────────

export interface EntryDisplay {
  label: string
  subtitle: string | null
}

const BASE_LABELS: Record<CollectionPaymentMethod, string> = {
  cash: 'Efectivo',
  card_credit: 'Tarjeta crédito',
  card_debit: 'Tarjeta débito',
  transfer: 'Transferencia',
}

/**
 * resolveEntryDisplay — single source for entry rendering.
 *
 *   - `label`  : `paymentMethodName` when the entry maps to a custom tile; else
 *               the fixed-tile label for the base category.
 *   - `subtitle`: the entry's paymentMethodSubtitle trimmed, OR the resolved
 *                tile's subtitle (custom), else null.
 *
 * Pure. Tests cover both branches + the trim semantics.
 */
export function resolveEntryDisplay(
  entry: PaymentEntry,
  tiles: readonly PaymentMethodTile[],
  fallbackSubtitle?: string | null,
): EntryDisplay {
  const tile = findTileForEntry(tiles, entry)
  let label: string
  let subtitle: string | null = null
  if (tile && tile.kind === 'custom') {
    label = tile.label
    subtitle = tile.subtitle
  } else {
    label = BASE_LABELS[entry.method]
  }
  // Allow the caller to pass a per-entry subtitle (sale detail / timeline
  // pass the backend's snapshot directly). Trim, return null on empty.
  if (fallbackSubtitle !== undefined) {
    const trimmed = fallbackSubtitle?.trim()
    subtitle = trimmed && trimmed.length > 0 ? trimmed : null
  }
  return { label, subtitle }
}