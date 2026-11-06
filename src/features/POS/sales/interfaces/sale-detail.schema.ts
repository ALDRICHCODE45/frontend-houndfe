import { z } from 'zod'
import { SALE_CANCELLATION_REASON } from '../constants/sale.constants'
import { PENDING_REFUND_METHODS, PENDING_REFUND_REASONS } from './pending-refund.types'
import type { SaleDetail } from './sale.types'
import { SaleShippingAddressSnapshotSchema } from './sale-shipping-address.schema'

/**
 * `GET /sales/:id` decoder (odd/handoff/06-refund-settlements.md, «Cancelled sale detail»).
 *
 * Non-strict on purpose: it checks only the cancellation fields and the shipping address, and
 * passes every other key through as received. A payload from before BE ae0e951 (no such fields)
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

const cancelReasons = Object.values(SALE_CANCELLATION_REASON) as [
  (typeof SALE_CANCELLATION_REASON)[keyof typeof SALE_CANCELLATION_REASON],
  ...(typeof SALE_CANCELLATION_REASON)[keyof typeof SALE_CANCELLATION_REASON][],
]

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
  })
  .passthrough()

export function parseSaleDetail(value: unknown): SaleDetail {
  // SAFETY: only the cancellation and shipping-address fields are checked; the rest of the detail is trusted as
  // before (the decoder stays non-strict), so the cast covers exactly those passed-through keys.
  return saleDetailSchema.parse(value) as unknown as SaleDetail
}
