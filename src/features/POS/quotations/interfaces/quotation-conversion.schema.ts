import { z } from 'zod'
import type { Sale } from '@/features/POS/sales/interfaces/sale.types'
import type {
  ConvertQuotationToSaleResponse,
  CreateQuotationFromSaleResponse,
  DroppedAdjustmentKind,
  QuotationResponseDto,
  SuppressedPromotion,
  UnavailableLine,
  UnavailableLineReason,
} from './quotation.types'

/**
 * Decoders for the quotation ↔ sale conversion 201 bodies (backend handoff 23).
 *
 * Non-strict on purpose: the quotation and the sale are checked only for their identity and the
 * conversion links and pass every other key through, like the rest of the quotation reads. A
 * 201 means the server state already changed (the sale draft is gone, or the sale exists), so
 * forward-compatible values (a new adjustment kind or line reason) read `UNKNOWN` instead of
 * failing. Only a body without its envelope keys throws (ZodError → `RESPONSE_INVALID`).
 */

const cents = z.number().int().nonnegative().safe()
const nullableId = z.string().nullish().transform((value) => value ?? null)

const DROPPED_KINDS = ['ORDER_PROMOTION', 'LINE_PROMOTION', 'REWARD_PROMOTION'] as const

const droppedAdjustmentSchema = z.object({
  kind: z
    .string()
    .transform((kind): DroppedAdjustmentKind =>
      (DROPPED_KINDS as readonly string[]).includes(kind) ? (kind as DroppedAdjustmentKind) : 'UNKNOWN',
    ),
  saleItemId: nullableId,
  productId: nullableId,
  variantId: nullableId,
  promotionId: nullableId,
  title: z.string(),
  discountCents: cents,
})

const quotationSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    saleId: z.string().nullish(),
    convertedAt: z.string().nullish(),
  })
  .passthrough()

const saleSchema = z
  .object({
    id: z.string(),
    quotationId: z.string().optional(),
    items: z.array(z.unknown()),
  })
  .passthrough()

const fromSaleSchema = z.object({
  quotation: quotationSchema,
  discardedSaleId: z.string(),
  droppedAdjustments: z
    .array(droppedAdjustmentSchema)
    .nullish()
    .transform((value) => value ?? []),
})

const suppressedPromotionSchema = z.object({
  promotionId: z.string(),
  title: z.string().nullish().transform((value) => value ?? null),
})

/** `suppressedPromotions` (handoff 23 §2): `[]` when absent; entries that break the shape are
 *  skipped — the sale already exists, so a bad hint must not fail the conversion. */
const suppressedPromotionsSchema = z
  .array(z.unknown())
  .nullish()
  .transform((value): SuppressedPromotion[] =>
    (value ?? []).flatMap((entry) => {
      const result = suppressedPromotionSchema.safeParse(entry)
      return result.success ? [result.data] : []
    }),
  )

const toSaleSchema = z.object({
  quotation: quotationSchema,
  sale: saleSchema,
  suppressedPromotions: suppressedPromotionsSchema,
})

export function parseCreateQuotationFromSaleResponse(value: unknown): CreateQuotationFromSaleResponse {
  const parsed = fromSaleSchema.parse(value)
  return {
    // SAFETY: the quotation keeps the rest of QuotationResponseDto as received (passthrough),
    // the same trust every other quotation read gets.
    quotation: parsed.quotation as unknown as QuotationResponseDto,
    discardedSaleId: parsed.discardedSaleId,
    droppedAdjustments: parsed.droppedAdjustments,
  }
}

export function parseConvertQuotationToSaleResponse(value: unknown): ConvertQuotationToSaleResponse {
  const parsed = toSaleSchema.parse(value)
  return {
    // SAFETY: both bodies pass through as received beyond the checked keys (see file comment).
    quotation: parsed.quotation as unknown as QuotationResponseDto,
    sale: parsed.sale as unknown as Sale,
    suppressedPromotions: parsed.suppressedPromotions,
  }
}

// ─── Error bodies ─────────────────────────────────────────────────────────────

const LINE_REASONS = [
  'PRODUCT_NOT_FOUND',
  'VARIANT_NOT_FOUND',
  'PRODUCT_NOT_SELLABLE',
  'INSUFFICIENT_STOCK',
] as const

const unavailableLineSchema = z.object({
  lineId: z.string(),
  productId: nullableId,
  variantId: nullableId,
  productName: z.string(),
  variantName: z.string().nullish().transform((value) => value ?? null),
  reason: z
    .string()
    .transform((reason): UnavailableLineReason =>
      (LINE_REASONS as readonly string[]).includes(reason) ? (reason as UnavailableLineReason) : 'UNKNOWN',
    ),
  requestedQuantity: z.number(),
  availableQuantity: z.number().nullish().transform((value) => value ?? null),
})

/** `lines[]` of a *_LINES_UNAVAILABLE body; entries that break the shape are skipped. */
export function parseUnavailableLines(value: unknown): UnavailableLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const result = unavailableLineSchema.safeParse(entry)
    return result.success ? [result.data] : []
  })
}
