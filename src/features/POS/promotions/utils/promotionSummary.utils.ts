import type {
  PromotionFormState,
  PromotionTargetItemFormEntry,
} from '../interfaces/promotion.types'

// ── Summary bullet builder ────────────────────────────────────────────────────

/**
 * Builds a list of human-readable summary bullet points from the current
 * form state. Pure function — no side effects, easy to test.
 */
export function buildPromotionSummaryBullets(state: PromotionFormState): string[] {
  const bullets: string[] = []

  // ── Method ──────────────────────────────────────────────────────────────────
  if (state.method === 'AUTOMATIC') {
    bullets.push('Se aplicará automáticamente en el Punto de Venta')
  } else {
    bullets.push('Se aplica manualmente')
  }

  // ── Discount info (PRODUCT_DISCOUNT / ORDER_DISCOUNT) ─────────────────────
  if (
    (state.type === 'PRODUCT_DISCOUNT' || state.type === 'ORDER_DISCOUNT') &&
    state.discountValue
  ) {
    const val = state.discountValue
    if (state.discountType === 'PERCENTAGE') {
      bullets.push(`${val}% de descuento`)
    } else if (state.discountType === 'FIXED') {
      bullets.push(`$${val} de descuento`)
    }
  }

  // ── BUY_X_GET_Y ──────────────────────────────────────────────────────────
  if (state.type === 'BUY_X_GET_Y' && state.buyQuantity && state.getQuantity) {
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
  if (state.type === 'ADVANCED' && state.buyQuantity && state.getQuantity) {
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
    (state.type === 'PRODUCT_DISCOUNT' || state.type === 'ORDER_DISCOUNT') &&
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
  if (state.customerScope === 'REGISTERED_ONLY') {
    bullets.push('Solo clientes registrados')
  } else if (state.customerScope === 'SPECIFIC' && state.customerIds.length > 0) {
    bullets.push(`Para ${state.customerIds.length} cliente(s) específico(s)`)
  }

  // ── Days of week ──────────────────────────────────────────────────────────
  if (state.hasDaysOfWeek && state.daysOfWeek.length > 0) {
    bullets.push(`Disponible ${state.daysOfWeek.length} día(s) de la semana`)
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
