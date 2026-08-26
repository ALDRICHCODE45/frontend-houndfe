import { z } from 'zod'
import {
  PAYMENT_METHOD_CATEGORY_VALUES,
  type PaymentMethodCategory,
} from '@/core/shared/constants/payment-method-category'

/**
 * Domain types + zod schemas for the PaymentMethod admin module
 * (Métodos de cobro).
 *
 * Locked contracts (sdd custom-payment-methods, design §2.2 / §5.1):
 *   - Create requires `name` (1..60 chars) + `category` (4-enum); `subtitle`
 *     is optional (≤120 chars, omitted when empty/whitespace).
 *   - Update makes ALL fields optional (partial PATCH).
 *   - `isActive` IS a form field — this is the one structural difference from
 *     `PaymentDetail` (REQ-PM-003 REVERSAL pin). Reactivation happens via the
 *     edit slideover's `isActive` toggle, NOT via a separate kebab entry.
 *   - `tenantId` is returned by the backend and is read-only — it MUST NEVER
 *     appear in any request shape.
 *   - `category` excludes `credit` (REQ-PM-008 / design §2.1).
 *   - `metadataJson` is NEVER accepted by the backend
 *     (`forbidNonWhitelisted` rejects it with 400).
 *
 * The `paymentMethodsApi` wrapper enforces the create/update payload shape at
 * the HTTP boundary; the schemas here are the form-level validation source
 * (UForm) and the inferred TS types drive the slideover's emit signatures.
 */

// ─── Form schemas ──────────────────────────────────────────────────────────────

const NameFieldSchema = z
  .string({ required_error: 'El nombre es obligatorio' })
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(60, 'El nombre no puede superar 60 caracteres')

const CategoryFieldSchema = z.enum(PAYMENT_METHOD_CATEGORY_VALUES, {
  message: 'Selecciona una categoría válida',
})

const SubtitleFieldSchema = z
  .string()
  .trim()
  .max(120, 'El subtítulo no puede superar 120 caracteres')
  .optional()

export const CreatePaymentMethodSchema = z.object({
  name: NameFieldSchema,
  category: CategoryFieldSchema,
  subtitle: SubtitleFieldSchema, // optional; empty string normalized to omit (§8.1)
})

export const UpdatePaymentMethodSchema = z.object({
  name: NameFieldSchema.optional(),
  category: CategoryFieldSchema.optional(),
  subtitle: SubtitleFieldSchema, // already optional
  isActive: z.boolean().optional(), // REVERSAL vs PaymentDetail: reactivation IS editable
})

export type CreatePaymentMethodFormValues = z.infer<typeof CreatePaymentMethodSchema>
export type UpdatePaymentMethodFormValues = z.infer<typeof UpdatePaymentMethodSchema>

// ─── Response DTO ──────────────────────────────────────────────────────────────

/**
 * PaymentMethodResponse — exact backend DTO.
 * Returned by GET /admin/payment-methods[/:id]. `tenantId` is read-only and
 * must NEVER be sent back in any request. `isActive` is present here because
 * it is part of the read model and the badge render target; the edit slideover
 * is allowed to PATCH it (REQ-PM-003 REVERSAL).
 */
export interface PaymentMethodResponse {
  id: string
  tenantId: string
  name: string
  category: PaymentMethodCategory
  subtitle: string | null
  isActive: boolean
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/**
 * PaymentMethodTableRow — projected row for the table + card views. Currently
 * identical to the response (mirrors the tenants + payment-details precedent);
 * wrapping it in a separate interface lets future client-side projections
 * ripple through callers without forcing a rename of the backend DTO.
 */
export interface PaymentMethodTableRow extends PaymentMethodResponse {}

// ─── Request shapes ────────────────────────────────────────────────────────────

/**
 * CreatePaymentMethodRequest — POST /admin/payment-methods payload.
 * Mirrors CreatePaymentMethodSchema 1:1. `isActive`, `id`, `tenantId`,
 * `createdAt`, `updatedAt`, `metadataJson` are intentionally absent
 * (forbidNonWhitelisted → 400 on the wire).
 */
export interface CreatePaymentMethodRequest {
  name: string
  category: PaymentMethodCategory
  subtitle?: string
}

/**
 * UpdatePaymentMethodRequest — PATCH /admin/payment-methods/:id payload.
 * Mirrors UpdatePaymentMethodSchema 1:1 (partial).
 *
 * `isActive` IS forwarded on update (REQ-PM-003 REVERSAL) — the cashier can
 * toggle a row back to active via the slideover's `isActive` switch. This is
 * the ONE deliberate structural difference from `PaymentDetail`'s update
 * shape. `tenantId` NEVER appears (the wrapper's defense-in-depth strips it).
 */
export interface UpdatePaymentMethodRequest {
  name?: string
  category?: PaymentMethodCategory
  subtitle?: string
  isActive?: boolean
}

// ─── Normalizer (REQ-PM-009 — subtitle whitespace → omit) ─────────────────────

/**
 * normalizeSubtitle — pure helper.
 *
 * Empty / whitespace-only subtitle becomes `undefined`, which the slideover's
 * emit signature and the wrapper's payload construction both treat as "omit
 * the key entirely" (the backend stores null on save). A non-empty trimmed
 * string is returned verbatim.
 */
export function normalizeSubtitle(subtitle: string | undefined): string | undefined {
  if (subtitle === undefined) return undefined
  const trimmed = subtitle.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

// ─── Label maps ────────────────────────────────────────────────────────────────

/**
 * PAYMENT_METHOD_STATUS_LABELS — single source for the Activo/Inactivo badge.
 * Gender matches "método".
 */
export const PAYMENT_METHOD_STATUS_LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
} as const

export type PaymentMethodStatusLabelKey = keyof typeof PAYMENT_METHOD_STATUS_LABELS

/**
 * Resolve the i18n label for a payment-method active flag.
 * Pure; called from table cells, card rows.
 */
export function paymentMethodStatusLabel(isActive: boolean): string {
  return isActive
    ? PAYMENT_METHOD_STATUS_LABELS.active
    : PAYMENT_METHOD_STATUS_LABELS.inactive
}