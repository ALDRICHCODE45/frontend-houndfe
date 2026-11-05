import { z } from 'zod'
import { PENDING_REFUND_METHODS, type PendingRefundMethod } from './pending-refund.types'

/**
 * refund-settlement.types.ts — wire contract of
 * `POST /sales/refunds/:refundId/settlements` (odd/handoff/06-refund-settlements.md §4–§6).
 *
 *   - The body is closed: unknown keys are rejected by the backend, `reference` is omitted
 *     when empty (`null` is a 400) and `cashSessionId` is omitted outside a cash session.
 *   - `settledAt` is an ISO-8601 instant WITH a zone (`Z` or `±HH:MM`); the response
 *     normalizes it to UTC.
 *   - Success is `200`. A replay with the same `Idempotency-Key` returns the STORED response
 *     (other key order, balances as a snapshot), so the response is compared by field and the
 *     list is refetched after every settlement.
 *   - The response crosses a network boundary: it is validated strictly and never repaired.
 */

/** Return method of one settlement; the same set as the refund's original method. */
export type RefundSettlementMethod = PendingRefundMethod

/** Request body, exactly the fields the backend accepts. */
export interface RefundSettlementRequest {
  /** Integer cents, `1..outstandingCents`. */
  amountCents: number
  method: RefundSettlementMethod
  /** Free text; omitted when blank. */
  reference?: string
  /** ISO-8601 instant with a zone, for example `2026-11-05T10:30:00-06:00`. */
  settledAt: string
  /** The user's OPEN cash session; never with `method: 'credit'`. */
  cashSessionId?: string
}

/** Response `200`, first run or replay. */
export interface RefundSettlementResponse {
  settlementId: string
  refundId: string
  saleId: string
  amountCents: number
  method: RefundSettlementMethod
  reference: string | null
  /** UTC instant. */
  settledAt: string
  /** Cumulative returned for the refund, this settlement included. */
  settledCents: number
  /** Still owed after this settlement; `0` means the refund is finished. */
  outstandingCents: number
}

/** What the response must echo back to be trusted. */
export interface RefundSettlementExpectation {
  refundId: string
}

const isoInstantSchema = z
  .string()
  .datetime({ offset: true, message: 'Expected an ISO 8601 datetime with a zone' })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Expected a parseable ISO 8601 datetime',
  })

const centsSchema = z.number().int().nonnegative().safe()

// `.strict()` is load-bearing: an unknown key means the contract moved.
const refundSettlementResponseSchema: z.ZodType<RefundSettlementResponse> = z
  .object({
    settlementId: z.string().min(1),
    refundId: z.string().min(1),
    saleId: z.string().min(1),
    amountCents: centsSchema.min(1),
    method: z.enum(PENDING_REFUND_METHODS),
    reference: z.string().nullable(),
    settledAt: isoInstantSchema,
    settledCents: centsSchema,
    outstandingCents: centsSchema,
  })
  .strict()

/**
 * Validate an untrusted settlement body against its shape and the refund it was posted to.
 * Throws `ZodError` on any deviation: missing or extra keys, an unknown method, a zone-less
 * instant, negative or fractional cents, a response for another refund, or a cumulative
 * `settledCents` below the amount of this very settlement.
 */
export function parseRefundSettlementResponse(
  value: unknown,
  expected: RefundSettlementExpectation,
): RefundSettlementResponse {
  return refundSettlementResponseSchema
    .superRefine((response, ctx) => {
      if (response.refundId !== expected.refundId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['refundId'],
          message: 'The response belongs to another refund',
        })
      }
      if (response.settledCents < response.amountCents) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settledCents'],
          message: 'settledCents must include this settlement',
        })
      }
    })
    .parse(value)
}

/** Rebuild the closed body so an over-wide caller object never leaks a field onto the wire. */
export function toRefundSettlementBody(request: RefundSettlementRequest): RefundSettlementRequest {
  const reference = request.reference?.trim()
  return {
    amountCents: request.amountCents,
    method: request.method,
    ...(reference ? { reference } : {}),
    settledAt: request.settledAt,
    ...(request.cashSessionId ? { cashSessionId: request.cashSessionId } : {}),
  }
}
