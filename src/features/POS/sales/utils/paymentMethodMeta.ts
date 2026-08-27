type BadgeColor = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'

interface MethodMeta {
  label: string
  color: BadgeColor
  icon: string
}

const METHOD_META = {
  CASH: { label: 'Efectivo', color: 'success', icon: 'i-lucide-banknote' },
  CARD_DEBIT: { label: 'Débito', color: 'warning', icon: 'i-lucide-credit-card' },
  CARD_CREDIT: { label: 'T. Crédito', color: 'warning', icon: 'i-lucide-credit-card' },
  TRANSFER: { label: 'Transferencia', color: 'warning', icon: 'i-lucide-arrow-left-right' },
  CREDIT: { label: 'Crédito', color: 'error', icon: 'i-lucide-hand-coins' },
} as const satisfies Record<string, MethodMeta>

const FALLBACK_META: MethodMeta = {
  label: 'Otro',
  color: 'neutral',
  icon: 'i-lucide-circle-help',
}

export type MethodMetaKey = keyof typeof METHOD_META

export function getMethodMeta(code: string): MethodMeta {
  return (METHOD_META as Record<string, MethodMeta>)[code] ?? FALLBACK_META
}

// ── custom-payment-methods S5B (REQ-CAT-005 / REQ-CAT-006) ─────────────────────
// Catalog-snapshot display rule, shared by `PaymentsListSection` and
// `SaleDetailTimeline` so the two surfaces cannot drift: prefer the snapshot
// name (`paymentMethodName`) over the surface's base label, and render the
// trimmed subtitle as a grey sub-line only when it is truthy after trimming.
// The base label is passed per surface (`getMethodMeta(method).label` for the
// sale-detail list, `formatPaymentMethod(method)` for the timeline) so legacy
// output stays byte-identical on each surface.

export interface PaymentMethodLabelDisplay {
  label: string
  subtitle: string | null
}

/**
 * Trimmed-or-null subtitle (REQ-CAT-006 truthy-trim rule): `null`,
 * `undefined`, or whitespace-only input yields `null` — no placeholder, no
 * empty sub-line.
 */
export function paymentMethodSubtitleText(payment: {
  paymentMethodSubtitle?: string | null
}): string | null {
  const subtitle = payment.paymentMethodSubtitle
  if (subtitle === undefined || subtitle === null) return null
  const trimmed = subtitle.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Resolve a row's display: `paymentMethodName ?? baseLabel`, plus the
 * trimmed-or-null subtitle. `baseLabel` must be the surface's existing
 * legacy label (see header comment).
 */
export function paymentMethodDisplayLabel(
  payment: { paymentMethodName?: string; paymentMethodSubtitle?: string | null },
  baseLabel: string,
): PaymentMethodLabelDisplay {
  return {
    label: payment.paymentMethodName ?? baseLabel,
    subtitle: paymentMethodSubtitleText(payment),
  }
}
