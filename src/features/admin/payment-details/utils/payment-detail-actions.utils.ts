import type { RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import type {
  PaymentDetailResponse,
  PaymentDetailTableRow,
} from '../interfaces/payment-detail.types'

/**
 * payment-detail-actions.utils.ts — sdd payment-details-admin S2 (design.md §9.2)
 *
 * Pure helpers for:
 *   - Detecting the "last active account" case (REQ-PD-005).
 *   - Building the deactivate confirm description (base vs last-active copy).
 *   - Building the row actions menu gated on `*:PaymentDetail` permissions
 *     (REQ-PD-007).
 *
 * No coupling to the employees module's `extractDomainErrorCode`; this file
 * intentionally avoids coupling to other bounded contexts.
 */

/**
 * isLastActivePaymentDetail — true only when the target is the SINGLE active
 * account in the tenant. False when:
 *   - another active row exists,
 *   - the target is already inactive,
 *   - the id is unknown,
 *   - the list has no active rows at all.
 */
export function isLastActivePaymentDetail(
  rows: PaymentDetailResponse[],
  targetId: string,
): boolean {
  const activeRows = rows.filter((row) => row.isActive)
  return (
    activeRows.length === 1 &&
    activeRows.some((row) => row.id === targetId)
  )
}

/**
 * buildPaymentDetailDeactivateDescription — Compose the ConfirmModal copy.
 *
 * Base copy mentions `bankName (beneficiary)` + the bot-transfer impact.
 * Last-active copy appends the strengthened warning the user sees when this
 * is the last active account.
 */
export function buildPaymentDetailDeactivateDescription(
  row: PaymentDetailTableRow,
  rows: PaymentDetailResponse[],
): string {
  const base = `¿Desactivar la cuenta de ${row.bankName} (${row.beneficiary})? El bot dejará de mostrarla en el mensaje de transferencia.`
  if (isLastActivePaymentDetail(rows, row.id)) {
    return `${base} Es la única cuenta activa: la sucursal quedará sin una cuenta para recibir transferencias.`
  }
  return base
}

export interface PaymentDetailRowActionContext {
  canUpdate: boolean
  canDelete: boolean
}

/**
 * buildPaymentDetailRowActions — Build the ⋮ menu items per the gate contract:
 *
 *   - `canUpdate` only          → [ ]  (opening the row already edits; a menu of
 *                                      only "Editar" would repeat the row click)
 *   - `canDelete` only          → [ Desactivar… (destructive) ]
 *   - both                      → [ Editar, Desactivar… (destructive, last) ]
 *   - neither                   → [ ]  (no ⋮)
 */
export function buildPaymentDetailRowActions(ctx: PaymentDetailRowActionContext): RowAction[] {
  if (!ctx.canDelete) return []
  return [
    ...(ctx.canUpdate ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
    { key: 'delete', label: 'Desactivar…', icon: 'i-lucide-power', destructive: true },
  ]
}
