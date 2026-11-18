import { z } from 'zod'
import { SALE_CANCELLATION_REASON } from '../constants/sale.constants'
import { PENDING_REFUND_METHODS, PENDING_REFUND_REASONS } from './pending-refund.types'
import {
  SALE_HOLD_EXPIRED_REASON,
  type SaleDetail,
  type SaleDetailCancelReason,
  type SaleHold,
} from './sale.types'
import { SaleShippingAddressSnapshotSchema } from './sale-shipping-address.schema'

/**
 * `GET /sales/:id` decoder (odd/handoff/06-refund-settlements.md, «Cancelled sale detail»).
 *
 * Non-strict on purpose: it checks only the cancellation fields, the shipping address and the
 * pay-in-store `hold` (BE handoff 24; null when absent or malformed), and passes every other key
 * through as received. A payload from before BE ae0e951 (no such fields)
 * reads as a confirmed sale: `null` and `refunds: []`; one without `shippingAddress` reads null.
 */

const cents = z.number().int().nonnegative().safe()

const refundSchema = z.object({
  id: z.string(),
  method: z.enum(PENDING_REFUND_METHODS),
  amountCents: cents,
  settledCents: cents,
  outstandingCents: cents,
  reason: z.enum(PENDING_REFUND_REASONS),
  status: z.literal('PENDING'),
  createdAt: z.string(),
})

// BE handoff 24 §4: a read sale may also carry the system-only HOLD_EXPIRED.
const cancelReasons: [SaleDetailCancelReason, ...SaleDetailCancelReason[]] = [
  SALE_HOLD_EXPIRED_REASON,
  ...Object.values(SALE_CANCELLATION_REASON),
]

/** BE handoff 24 §1: the pay-in-store hold, exactly as the contract types it. */
export const saleHoldSchema = z.object({
  paymentIntent: z.literal('IN_STORE'),
  expiresAt: z.string().min(1),
  reminderAt: z.string().nullable(),
  stage: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  version: z.number().int().nonnegative().safe(),
}) satisfies z.ZodType<SaleHold>

/**
 * `hold` of a sale detail or list row: null when absent (older payload, POS sale) and when
 * malformed. A broken hold only hides the badge; it never breaks the whole sale.
 */
export function parseSaleHold(value: unknown): SaleHold | null {
  const parsed = saleHoldSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const saleDetailSchema = z
  .object({
    canceledAt: z.string().nullish().transform((value) => value ?? null),
    cancelReason: z.enum(cancelReasons).nullish().transform((value) => value ?? null),
    canceledBy: z
      .object({ id: z.string(), name: z.string() })
      .nullish()
      .transform((value) => value ?? null),
    refunds: z.array(refundSchema).nullish().transform((value) => value ?? []),
    // odd sale-address-change-notice: the sale's own address (never the live one); null before
    // the field existed or for a sale without address.
    shippingAddress: SaleShippingAddressSnapshotSchema.nullish().transform((value) => value ?? null),
    // Handoff 23 §3: present only when the sale came from a quotation; the key stays absent otherwise.
    quotationId: z.string().optional(),
    hold: z.unknown().transform(parseSaleHold),
  })
  .passthrough()

export function parseSaleDetail(value: unknown): SaleDetail {
  // SAFETY: only the cancellation and shipping-address fields are checked; the rest of the detail is trusted as
  // before (the decoder stays non-strict), so the cast covers exactly those passed-through keys.
  return saleDetailSchema.parse(value) as unknown as SaleDetail
}
