import type {
  PromotionFormState,
  PromotionTargetItemFormEntry,
} from '../interfaces/promotion.types'
import { PROMOTION_CAPACITY_MODE } from '../interfaces/promotion.types'
import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import {
  CUSTOMER_SCOPE,
  DISCOUNT_TYPE,
  PROMOTION_METHOD,
  PROMOTION_TYPE,
} from '../constants/promotion.constants'

// ── Capacity state (PCA-1) ────────────────────────────────────────────────────
//
// The promotion capacity surface renders SERVER-OWNED values only. This pure
// resolver maps the three fields the backend returns (`maxProductUnits`,
// `consumedProductUnits`, `remainingProductUnits`) into one of the six states
// the UI exposes. It never computes a remaining counter; it only classifies the
// server numbers and detects internally inconsistent (stale) snapshots so the
// component can degrade honestly instead of crashing or lying.

export type PromotionCapacityState =
  | 'unlimited'
  | 'unlimited_consumed'
  | 'available'
  | 'near_limit'
  | 'exhausted'
  | 'stale'

export interface PromotionCapacityDescriptor {
  state: PromotionCapacityState
  label: string
  tone: AppBadgeTone
  icon: string
  /** Server-owned cap, or null when unlimited. */
  max: number | null
  /** Server-owned consumption, or null when the server value is unreadable. */
  consumed: number | null
  /** Server-owned remaining, or null when unlimited/unreadable. */
  remaining: number | null
}

/** 80% threshold, mirrored as `consumed * 5 >= max * 4` to avoid float drift. */
const NEAR_LIMIT_MULTIPLIER = 5
const NEAR_LIMIT_DIVISOR = 4

function normalizeCount(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  return value
}

function wasProvidedButInvalid(value: unknown): boolean {
  return value != null && (typeof value !== 'number' || !Number.isInteger(value))
}

const LABEL_UNLIMITED = 'Sin límite'
const LABEL_EXHAUSTED = 'Sin cupo'
const LABEL_STALE = 'Datos de cupo desactualizados'

/**
 * Classify the server-owned capacity snapshot. Pure and defensive: any missing,
 * non-integer or physically impossible combination resolves to `stale` and the
 * caller renders an honest fallback instead of throwing.
 */
export function resolvePromotionCapacityState(input: {
  maxProductUnits?: number | null
  consumedProductUnits?: number | null
  remainingProductUnits?: number | null
}): PromotionCapacityDescriptor {
  const rawMax = input.maxProductUnits
  const rawConsumed = input.consumedProductUnits
  const rawRemaining = input.remainingProductUnits

  // Required counters must be PRESENT. Only an explicit `null` (max/remaining)
  // means "unlimited"/"not applicable"; an absent field is unreadable and must
  // degrade to `stale` instead of being mistaken for an unlimited cap.
  if (rawMax === undefined || rawConsumed === undefined || rawRemaining === undefined) {
    return staleDescriptor()
  }

  // Any value that was present but is not a plain integer is unreadable.
  if (
    wasProvidedButInvalid(rawMax) ||
    wasProvidedButInvalid(rawConsumed) ||
    wasProvidedButInvalid(rawRemaining)
  ) {
    return staleDescriptor()
  }

  // `consumedProductUnits` has no "not applicable" meaning, so an explicit
  // null is unreadable. Only `maxProductUnits` (unlimited) and — under
  // unlimited semantics — `remainingProductUnits` may legitimately be null.
  if (rawConsumed === null) {
    return staleDescriptor()
  }

  const max = normalizeCount(rawMax)
  const consumed = normalizeCount(rawConsumed)
  const remaining = normalizeCount(rawRemaining)

  if (max == null) {
    // Unlimited: remaining MUST be null, and negative consumption is impossible.
    if (remaining != null || (consumed != null && consumed < 0)) {
      return staleDescriptor()
    }
    if (consumed != null && consumed > 0) {
      return {
        state: 'unlimited_consumed',
        label: `${LABEL_UNLIMITED} · ${consumed} unidades consumidas`,
        tone: 'info',
        icon: 'i-lucide-history',
        max,
        consumed,
        remaining,
      }
    }
    return {
      state: 'unlimited',
      label: LABEL_UNLIMITED,
      tone: 'neutral',
      icon: 'i-lucide-infinity',
      max,
      consumed,
      remaining,
    }
  }

  // Finite cap: the snapshot must be internally consistent.
  if (
    max < 1 ||
    remaining == null ||
    remaining < 0 ||
    remaining > max ||
    (consumed != null && consumed < 0) ||
    (consumed != null && consumed + remaining !== max)
  ) {
    return staleDescriptor()
  }

  if (remaining === 0) {
    return {
      state: 'exhausted',
      label: LABEL_EXHAUSTED,
      tone: 'error',
      icon: 'i-lucide-circle-slash',
      max,
      consumed,
      remaining,
    }
  }

  const nearLimit = consumed != null && consumed * NEAR_LIMIT_MULTIPLIER >= max * NEAR_LIMIT_DIVISOR

  return {
    state: nearLimit ? 'near_limit' : 'available',
    label: `Quedan ${remaining} unidades`,
    tone: nearLimit ? 'warning' : 'success',
    icon: nearLimit ? 'i-lucide-triangle-alert' : 'i-lucide-gauge',
    max,
    consumed,
    remaining,
  }
}

function staleDescriptor(): PromotionCapacityDescriptor {
  return {
    state: 'stale',
    label: LABEL_STALE,
    tone: 'warning',
    icon: 'i-lucide-refresh-cw',
    max: null,
    consumed: null,
    remaining: null,
  }
}

// ── Summary bullet builder ────────────────────────────────────────────────────

/**
 * Builds a list of human-readable summary bullet points from the current
 * form state. Pure function — no side effects, easy to test.
 */
export function buildPromotionSummaryBullets(state: PromotionFormState): string[] {
  const bullets: string[] = []

  // ── Method ──────────────────────────────────────────────────────────────────
  if (state.method === PROMOTION_METHOD.AUTOMATIC) {
    bullets.push('Se aplicará automáticamente en el Punto de Venta')
  } else {
    bullets.push('Se aplica manualmente')
  }

  // ── Discount info (PRODUCT_DISCOUNT / ORDER_DISCOUNT) ─────────────────────
  if (
    (state.type === PROMOTION_TYPE.PRODUCT_DISCOUNT ||
      state.type === PROMOTION_TYPE.ORDER_DISCOUNT) &&
    state.discountValue
  ) {
    const val = state.discountValue
    if (state.discountType === DISCOUNT_TYPE.PERCENTAGE) {
      bullets.push(`${val}% de descuento`)
    } else if (state.discountType === DISCOUNT_TYPE.FIXED) {
      bullets.push(`$${val} de descuento`)
    }
  }

  // ── BUY_X_GET_Y ──────────────────────────────────────────────────────────
  if (state.type === PROMOTION_TYPE.BUY_X_GET_Y && state.buyQuantity && state.getQuantity) {
    const buy = state.buyQuantity
    const get = state.getQuantity
    const pct = state.getDiscountPercent
    const targetNames = formatTargetNames(state.targetItems)
    const discountText = pct === 0 ? 'gratis' : `con ${pct}% de descuento`

    if (targetNames) {
      bullets.push(
        `Si el cliente compra ${buy} ${targetNames}, obtiene ${get} ${targetNames} ${discountText}.`,
      )
    } else {
      bullets.push(`Compra ${buy}, lleva ${get} ${discountText}`)
    }
  }

  // ── ADVANCED ─────────────────────────────────────────────────────────────
  if (state.type === PROMOTION_TYPE.ADVANCED && state.buyQuantity && state.getQuantity) {
    const discountText =
      state.getDiscountPercent === 0
        ? 'gratis'
        : state.getDiscountPercent
          ? `con ${state.getDiscountPercent}% de descuento`
          : ''
    const buyNames = formatTargetNames(state.buyTargetItems)
    const getNames = formatTargetNames(state.getTargetItems)

    if (buyNames || getNames) {
      bullets.push(
        `Si el cliente compra ${state.buyQuantity} ${buyNames || 'items'}, obtiene ${state.getQuantity} ${getNames || 'items'} ${discountText}.`,
      )
    } else {
      bullets.push(
        `Compra ${state.buyQuantity} items → obtiene ${state.getQuantity} ${discountText}`,
      )
    }
  }

  // ── Target count (for PRODUCT_DISCOUNT / ORDER_DISCOUNT) ────────────────
  if (
    (state.type === PROMOTION_TYPE.PRODUCT_DISCOUNT ||
      state.type === PROMOTION_TYPE.ORDER_DISCOUNT) &&
    state.targetItems.length > 0
  ) {
    const names = formatTargetNames(state.targetItems)
    if (names) {
      bullets.push(`Aplica a: ${names}`)
    } else {
      bullets.push(
        `En ${state.targetItems.length} ${state.targetItems.length === 1 ? 'elemento' : 'elementos'} seleccionados`,
      )
    }
  }

  // ── Date range ────────────────────────────────────────────────────────────
  if (state.hasVigencia && state.startDate && state.endDate) {
    bullets.push(`Vigente del ${formatDate(state.startDate)} al ${formatDate(state.endDate)}`)
  } else if (state.hasVigencia && state.startDate) {
    bullets.push(`Vigente desde ${formatDate(state.startDate)}`)
  }

  // ── Customer scope ────────────────────────────────────────────────────────
  if (state.customerScope === CUSTOMER_SCOPE.REGISTERED_ONLY) {
    bullets.push('Solo clientes registrados')
  } else if (state.customerScope === CUSTOMER_SCOPE.SPECIFIC && state.customerIds.length > 0) {
    bullets.push(`Para ${state.customerIds.length} cliente(s) específico(s)`)
  }

  // ── Days of week ──────────────────────────────────────────────────────────
  if (state.hasDaysOfWeek && state.daysOfWeek.length > 0) {
    bullets.push(`Disponible ${state.daysOfWeek.length} día(s) de la semana`)
  }

  // ── Capacity (PCA-1) ──────────────────────────────────────────────────────
  // Only the editable intent is summarized. We NEVER show a derived remaining
  // counter here — the server owns that and it lives in the status surface.
  if (state.capacityMode === PROMOTION_CAPACITY_MODE.LIMITED && state.maxProductUnits != null) {
    bullets.push(`Cupo limitado a ${state.maxProductUnits} unidades`)
  } else if (
    state.capacityMode === PROMOTION_CAPACITY_MODE.UNCHANGED &&
    state.maxProductUnits != null
  ) {
    bullets.push(`Se conserva el cupo actual de ${state.maxProductUnits} unidades`)
  } else if (
    state.capacityMode === PROMOTION_CAPACITY_MODE.UNLIMITED &&
    state.consumedProductUnits > 0
  ) {
    bullets.push(`Sin límite · ${state.consumedProductUnits} unidades consumidas`)
  }

  return bullets
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Formats target item names into a human-readable string.
 * - 1 item: "Lámpara de mesa"
 * - 2 items: "Lámpara de mesa y Vela aromática"
 * - 3+ items: "Lámpara de mesa, Vela aromática y 1 más"
 */
function formatTargetNames(items: PromotionTargetItemFormEntry[]): string {
  const names = items.map((i) => i.name).filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} y ${names[1]}`
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`
}

function formatDate(iso: string): string {
  try {
    const datePart = iso.slice(0, 10)
    const [year, month, day] = datePart.split('-').map(Number)
    if (!year || !month || !day) return iso
    // Use noon to avoid timezone boundary issues
    return new Date(year, month - 1, day, 12, 0, 0).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
