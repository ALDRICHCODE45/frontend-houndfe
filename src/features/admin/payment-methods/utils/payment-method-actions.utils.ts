import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import type {
  PaymentMethodResponse,
  PaymentMethodTableRow,
} from '../interfaces/payment-method.types'

/**
 * payment-method-actions.utils.ts — sdd custom-payment-methods S3A (design §9.2)
 *
 * Pure helpers for:
 *   - Building the deactivate confirm description (REQ-PM-004).
 *   - Building the row actions menu gated on `*:PaymentMethod` permissions
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
}

/**
 * buildPaymentMethodRowActions — Build the ⋮ menu items per the gate contract:
 *
 *   - `canUpdate` only          → [ ]  (opening the row already edits; a menu of
 *                                      only "Editar" would repeat the row click)
 *   - `canDelete` only          → [ Desactivar… (destructive) ]
 *   - both                      → [ Editar, Desactivar… (destructive, last) ]
 *   - neither                   → [ ]  (no ⋮)
 *
 * Per REQ-PM-005: the menu MUST NOT offer a "Reactivar" entry (reactivation
 * happens via the edit slideover's `isActive` toggle). The menu MUST NOT
 * offer "Eliminar definitivamente" — hard delete is not supported (REQ-PM-005).
 */
export function buildPaymentMethodRowActions(ctx: PaymentMethodRowActionContext): RowAction[] {
  if (!ctx.canDelete) return []
  return [
    ...(ctx.canUpdate ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
    { key: 'delete', label: 'Desactivar…', icon: 'i-lucide-power', destructive: true },
  ]
}
