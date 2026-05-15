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
