import type {
  PaymentMethodResponse,
  PaymentMethodTableRow,
} from '../interfaces/payment-method.types'

/**
 * payment-method-actions.utils.ts — sdd custom-payment-methods S3A (design §9.2)
 *
 * Pure helpers for:
 *   - Building the deactivate confirm description (REQ-PM-004).
 *   - Building the dropdown row actions gated on `*:PaymentMethod` permissions
 *     (REQ-PM-005 / REQ-PM-006).
 *
 * No coupling to the employees module or other bounded contexts; this file
 * intentionally avoids reaching into shared auth/i18n helpers.
 */

/**
 * buildPaymentMethodDeactivateDescription — Compose the ConfirmModal copy.
 *
 * Base copy mentions the method `name` + the bot/cobrar impact. Always
 * mentions "ya no aparecerá al cobrar" (REQ-PM-004) so the admin sees the
 * downstream effect at the point of confirmation.
 */
export function buildPaymentMethodDeactivateDescription(
  row: PaymentMethodTableRow,
  _rows: PaymentMethodResponse[],
): string {
  return `¿Desactivar el método "${row.name}"? Ya no aparecerá al cobrar en esta sucursal.`
}

export interface PaymentMethodRowActionContext {
  canUpdate: boolean
  canDelete: boolean
  onEdit: (row: PaymentMethodTableRow) => void
  onDelete: (row: PaymentMethodTableRow) => void
}

export interface PaymentMethodRowActionItem {
  label: string
  color?: 'error'
  onSelect: () => void
}

/**
 * buildPaymentMethodRowActions — Build the kebab-menu sections per the gate
 * contract:
 *
 *   - `canUpdate` only          → [ [Editar] ]
 *   - `canDelete` only          → [ [Desactivar (error)] ]
 *   - both                      → [ [Editar], [Desactivar (error)] ]
 *   - neither                   → [ ]  (parent hides the kebab)
 *
 * Per REQ-PM-005: the kebab MUST NOT offer a "Reactivar" entry (reactivation
 * happens via the edit slideover's `isActive` toggle). The kebab MUST NOT
 * offer "Eliminar definitivamente" — hard delete is not supported (REQ-PM-005).
 *
 * Sections with zero items are filtered out, so the empty-array contract
 * cascades naturally to `UDropdownMenu`'s empty-state behavior.
 */
export function buildPaymentMethodRowActions(
  row: PaymentMethodTableRow,
  ctx: PaymentMethodRowActionContext,
): PaymentMethodRowActionItem[][] {
  const main: PaymentMethodRowActionItem[] = ctx.canUpdate
    ? [{ label: 'Editar', onSelect: () => ctx.onEdit(row) }]
    : []
  const destructive: PaymentMethodRowActionItem[] = ctx.canDelete
    ? [{ label: 'Desactivar', color: 'error', onSelect: () => ctx.onDelete(row) }]
    : []
  return [main, destructive].filter((section) => section.length > 0)
}