import { z } from 'zod'

/**
 * Domain types + zod schemas for the PaymentDetail admin module (Datos bancarios).
 *
 * Locked contracts (sdd payment-details-admin, design.md §5.1):
 *   - Create requires all four fields; edit makes them all optional (partial PATCH).
 *   - `isActive` is NEVER a form field (backend forbids it via
 *     forbidNonWhitelisted → 400). It appears ONLY on the read DTO.
 *   - `clabe` matches exactly 18 digits; `accountNumber` matches 10+ digits
 *     (digits only).
 *   - `tenantId` is returned by the backend and is read-only — it never
 *     appears in the create/update request shapes.
 *   - The "Activa"/"Inactiva" label map is the single source for both the
 *     table cell and the card grid.
 */

// ─── Form schemas ──────────────────────────────────────────────────────────────

export const CreatePaymentDetailSchema = z.object({
  bankName: z
    .string({ required_error: 'El banco es obligatorio' })
    .trim()
    .min(1, 'El banco es obligatorio'),
  beneficiary: z
    .string({ required_error: 'El beneficiario es obligatorio' })
    .trim()
    .min(1, 'El beneficiario es obligatorio'),
  clabe: z
    .string({ required_error: 'La CLABE es obligatoria' })
    .regex(/^\d{18}$/, 'La CLABE debe tener 18 dígitos'),
  accountNumber: z
    .string({ required_error: 'El número de cuenta es obligatorio' })
    .regex(/^\d{10,}$/, 'El número de cuenta debe tener al menos 10 dígitos'),
})

export const UpdatePaymentDetailSchema = z.object({
  bankName: CreatePaymentDetailSchema.shape.bankName.optional(),
  beneficiary: CreatePaymentDetailSchema.shape.beneficiary.optional(),
  clabe: CreatePaymentDetailSchema.shape.clabe.optional(),
  accountNumber: CreatePaymentDetailSchema.shape.accountNumber.optional(),
})

export type CreatePaymentDetailFormValues = z.infer<typeof CreatePaymentDetailSchema>
export type UpdatePaymentDetailFormValues = z.infer<typeof UpdatePaymentDetailSchema>

// ─── DTO / request shapes ─────────────────────────────────────────────────────

/**
 * PaymentDetailResponse — exact backend DTO.
 * Returned by GET /admin/payment-details[/:id]. `tenantId` is read-only and is
 * rendered (typed) by the UI for debugging; it MUST NEVER be sent back in a
 * create or update payload. `isActive` is present here because it is part of
 * the read model, but it is deliberately absent from both schemas and request
 * types below (the UI cannot edit it).
 */
export interface PaymentDetailResponse {
  id: string
  tenantId: string
  bankName: string
  beneficiary: string
  clabe: string
  accountNumber: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * PaymentDetailTableRow — projected row for the table + card views. Currently
 * identical to the response (matching the tenants precedent); wrapping it in a
 * separate interface lets future client-side projections ripple through
 * callers without forcing a rename of the backend DTO.
 */
export interface PaymentDetailTableRow extends PaymentDetailResponse {}

/**
 * CreatePaymentDetailRequest — POST /admin/payment-details payload.
 * Mirrors CreatePaymentDetailSchema 1:1. `isActive` and `tenantId` are
 * intentionally absent.
 */
export interface CreatePaymentDetailRequest {
  bankName: string
  beneficiary: string
  clabe: string
  accountNumber: string
}

/**
 * UpdatePaymentDetailRequest — PATCH /admin/payment-details/:id payload.
 * Mirrors UpdatePaymentDetailSchema 1:1 (partial). `isActive` and `tenantId`
 * are intentionally absent (no reactivation, no tenant move).
 */
export interface UpdatePaymentDetailRequest {
  bankName?: string
  beneficiary?: string
  clabe?: string
  accountNumber?: string
}

// ─── Badge label map ──────────────────────────────────────────────────────────

/**
 * PAYMENT_DETAIL_STATUS_LABELS — single source for the Activa/Inactiva badge.
 * Gender matches "cuenta bancaria".
 */
export const PAYMENT_DETAIL_STATUS_LABELS = {
  active: 'Activa',
  inactive: 'Inactiva',
} as const

export type PaymentDetailStatusLabelKey = keyof typeof PAYMENT_DETAIL_STATUS_LABELS

/**
 * Resolve the i18n label for a payment-detail active flag.
 * Pure; called from table cells, card rows, and the "no active account" banner.
 */
export function paymentDetailStatusLabel(isActive: boolean): string {
  return isActive
    ? PAYMENT_DETAIL_STATUS_LABELS.active
    : PAYMENT_DETAIL_STATUS_LABELS.inactive
}
