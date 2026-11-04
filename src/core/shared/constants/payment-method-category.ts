/**
 * payment-method-category.ts — sdd custom-payment-methods S1 (design §2.1)
 *
 * Single source of truth for the catalog category enum shared by the admin
 * module (`features/admin/payment-methods/`) and the POS module
 * (`features/POS/sales/`). The wire value is identical in both — lowercase,
 * exactly 4 values, NO `credit` (REQ-PM-008 / REQ-CAT-008).
 *
 * Why not in `features/POS/sales/constants/sale.constants.ts`?
 *   - The admin module is cross-domain (POS data + admin data) and must not
 *     import POS-private constants.
 *   - `sale.constants.ts` keeps the legacy `PAYMENT_METHOD` (which DOES
 *     include `credit`) — the per-module "homonym guardrail" in its header
 *     prevents accidental merging. The shared lowercase enum here is structurally
 *     separate; both modules import this file when they need the catalog enum.
 *
 * Pin tests:
 *   - `__tests__/payment-method-category.spec.ts` freezes the 4-value enum,
 *     the exact `LABELS` map, the icon map, and the structural exclusion of
 *     `credit` against drift.
 */

export const PAYMENT_METHOD_CATEGORY = {
  CASH: 'cash',
  CARD_CREDIT: 'card_credit',
  CARD_DEBIT: 'card_debit',
  TRANSFER: 'transfer',
} as const

export type PaymentMethodCategory =
  (typeof PAYMENT_METHOD_CATEGORY)[keyof typeof PAYMENT_METHOD_CATEGORY]

export const PAYMENT_METHOD_CATEGORY_VALUES = [
  PAYMENT_METHOD_CATEGORY.CASH,
  PAYMENT_METHOD_CATEGORY.CARD_CREDIT,
  PAYMENT_METHOD_CATEGORY.CARD_DEBIT,
  PAYMENT_METHOD_CATEGORY.TRANSFER,
] as const satisfies readonly PaymentMethodCategory[]

export const PAYMENT_METHOD_CATEGORY_LABELS: Record<PaymentMethodCategory, string> = {
  cash: 'Efectivo',
  card_credit: 'Tarjeta de crédito',
  card_debit: 'Tarjeta de débito',
  transfer: 'Transferencia',
}

export const PAYMENT_METHOD_CATEGORY_ICONS: Record<PaymentMethodCategory, string> = {
  cash: 'i-lucide-banknote',
  card_credit: 'i-lucide-credit-card',
  card_debit: 'i-lucide-wallet-cards',
  transfer: 'i-lucide-arrow-right-left',
}
