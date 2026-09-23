import { z } from 'zod'

/**
 * pending-refund.types.ts — wire, query and validation contracts for the
 * backend-owned `GET /sales/refunds/pending` endpoint
 * (ODD dashboard-operational-insights OI-5B1).
 *
 * Locked contract (backend `pending-refund-obligations / prf-3`):
 *   - Tenant/branch identity comes from the JWT. The request carries ONLY the
 *     1-based `page` and the `limit` — never tenantId, branchId, status or any
 *     sort field. The backend queue order (`createdAt` asc, `id` asc within the
 *     tenant) is authoritative and is preserved verbatim.
 *   - `limit` is bounded 1..100 (backend DTO); the dashboard composable
 *     explicitly requests `{ page: 1, limit: 5 }`.
 *   - A row exposes the obligation money as integer cents. `settledCents` never
 *     exceeds `amountCents` and `outstandingCents` is exactly
 *     `amountCents - settledCents` — both are backend-derived invariants the
 *     frontend VERIFIES but never recomputes.
 *   - `status` is pinned to the literal `'PENDING'`: the backend filters on that
 *     status, so any other value means the contract moved.
 *   - `createdAt` is a backend `Date` serialized as an ISO 8601 datetime.
 *   - An empty queue is a successful empty page (`data: []`, `total: 0`,
 *     `totalPages: 0`), never a 404. The current page MAY exceed `totalPages`
 *     and legitimately return an empty (or partially filled) list, so
 *     `page > totalPages` is NOT a rejection basis.
 *   - The response crosses a network boundary and is therefore UNTRUSTED. This
 *     module validates it and REJECTS any deviation — never coercing,
 *     normalizing, deriving, sorting, truncating or repairing a payload.
 */

/** Every tender method the backend can attach to a refund obligation. */
export const PENDING_REFUND_METHODS = [
  'cash',
  'card_credit',
  'card_debit',
  'transfer',
  'credit',
] as const

/** Literal union derived from the runtime registry (the registry stays authoritative). */
export type PendingRefundMethod = (typeof PENDING_REFUND_METHODS)[number]

/** Every cancellation reason that can originate a refund obligation. */
export const PENDING_REFUND_REASONS = [
  'CUSTOMER_REQUEST',
  'ORDER_ERROR',
  'OUT_OF_STOCK',
  'DUPLICATE_SALE',
  'OTHER',
] as const

/** Literal union derived from the runtime registry. */
export type PendingRefundReason = (typeof PENDING_REFUND_REASONS)[number]

/** The only status this endpoint returns; the backend filters on it. */
export const PENDING_REFUND_STATUS = 'PENDING' as const

/** Literal type derived from the constant. */
export type PendingRefundStatus = typeof PENDING_REFUND_STATUS

/**
 * Query contract: exactly the two URI pagination fields. `page` is 1-based and
 * `limit` is bounded 1..100 by the backend DTO. No sorting, filtering or tenant
 * field is part of this surface.
 */
export interface PendingRefundsQuery {
  /** 1-based page index. */
  page: number
  /** Page size, 1..100. */
  limit: number
}

/** One pending refund obligation, exactly as the backend serializes it. */
export interface PendingRefundRow {
  /** Refund row id. */
  id: string
  /** Confirmed sale this obligation was created against. */
  saleId: string
  /** Tender method the refund must be returned through. */
  method: PendingRefundMethod
  /** Total refundable amount, in integer cents. */
  amountCents: number
  /** Already-settled portion, in integer cents (`<= amountCents`). */
  settledCents: number
  /** Remaining obligation, in integer cents (`=== amountCents - settledCents`). */
  outstandingCents: number
  /** Cancellation reason that produced the obligation. */
  reason: PendingRefundReason
  /** Always `'PENDING'`; a settled row leaves the queue. */
  status: PendingRefundStatus
  /** Backend `Date` serialized as an ISO 8601 datetime. */
  createdAt: string
}

/** Pagination envelope matched one-to-one with the neighboring sales list. */
export interface PendingRefundsPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Wire response contract: the ordered obligation page plus its pagination echo. */
export interface PendingRefundsResponse {
  /** Obligations in authoritative backend order (never re-sorted in the browser). */
  data: PendingRefundRow[]
  pagination: PendingRefundsPagination
}

/** The request facts a response must echo back for the payload to be trusted. */
export interface PendingRefundsExpectation {
  page: number
  limit: number
}

/**
 * ISO 8601 datetime with an explicit offset/Z, additionally proven parseable so
 * a syntactically shaped but impossible instant (e.g. `2026-13-45T99:99:99Z`)
 * is rejected rather than stored as a broken date.
 */
const pendingRefundIsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Expected an ISO 8601 datetime' })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Expected a parseable ISO 8601 datetime',
  })

/** Integer cents: rejects negatives, fractions, unsafe values and non-numbers. */
const pendingRefundMoneySchema = z.number().int().nonnegative().safe()

/**
 * `.strict()` on every object is load-bearing: an unknown key means the backend
 * contract moved, and silently ignoring it would let the UI drift out of sync
 * with the real payload.
 */
const pendingRefundRowSchema: z.ZodType<PendingRefundRow> = z
  .object({
    id: z.string(),
    saleId: z.string(),
    method: z.enum(PENDING_REFUND_METHODS),
    amountCents: pendingRefundMoneySchema,
    settledCents: pendingRefundMoneySchema,
    outstandingCents: pendingRefundMoneySchema,
    reason: z.enum(PENDING_REFUND_REASONS),
    status: z.literal(PENDING_REFUND_STATUS),
    createdAt: pendingRefundIsoDateTimeSchema,
  })
  .strict()
  .superRefine((row, ctx) => {
    // Cross-field money invariants. These are rejections, never repairs: the
    // frontend must not silently clamp or recompute a backend-owned total.
    if (row.settledCents > row.amountCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['settledCents'],
        message: 'settledCents must not exceed amountCents',
      })
    }
    if (row.outstandingCents !== row.amountCents - row.settledCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['outstandingCents'],
        message: 'outstandingCents must equal amountCents - settledCents',
      })
    }
  })

const pendingRefundsPaginationSchema: z.ZodType<PendingRefundsPagination> = z
  .object({
    page: z.number().int().min(1).safe(),
    limit: z.number().int().min(1).max(100).safe(),
    total: z.number().int().nonnegative().safe(),
    totalPages: z.number().int().nonnegative().safe(),
  })
  .strict()

const pendingRefundsResponseSchema: z.ZodType<PendingRefundsResponse> = z
  .object({
    data: z.array(pendingRefundRowSchema),
    pagination: pendingRefundsPaginationSchema,
  })
  .strict()

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message })
}

/**
 * Per-response refinements that cannot be expressed field-by-field: the echoed
 * page/limit must match the request, the page must not be longer than the
 * echoed limit, and `totalPages` must be exactly `ceil(total / limit)` (or `0`
 * for an empty collection).
 *
 * `page > totalPages` is deliberately NOT rejected: a page beyond the last one
 * is a normal empty read on this collection.
 */
function pendingRefundsRefinements(
  response: PendingRefundsResponse,
  expected: PendingRefundsExpectation,
  ctx: z.RefinementCtx,
): void {
  const { pagination } = response

  if (pagination.page !== expected.page) {
    addIssue(
      ctx,
      ['pagination', 'page'],
      `Echoed page "${pagination.page}" does not match the request`,
    )
  }
  if (pagination.limit !== expected.limit) {
    addIssue(
      ctx,
      ['pagination', 'limit'],
      `Echoed limit "${pagination.limit}" does not match the request`,
    )
  }

  if (response.data.length > pagination.limit) {
    addIssue(
      ctx,
      ['data'],
      `Received ${response.data.length} rows for a page of at most ${pagination.limit}`,
    )
  }

  const expectedTotalPages =
    pagination.total === 0 ? 0 : Math.ceil(pagination.total / pagination.limit)
  if (pagination.totalPages !== expectedTotalPages) {
    addIssue(
      ctx,
      ['pagination', 'totalPages'],
      `totalPages "${pagination.totalPages}" must equal ${expectedTotalPages} for total ${pagination.total} and limit ${pagination.limit}`,
    )
  }
}

/**
 * Validate an untrusted pending-refunds body against BOTH its own shape and the
 * request that produced it.
 *
 * Throws `ZodError` on any deviation: missing/extra keys, unknown method/reason
 * or a non-`PENDING` status, a non-ISO `createdAt`, negative/fractional/unsafe
 * cents or counts, an out-of-bounds page/limit, echoed pagination that differs
 * from the request, a page longer than the echoed limit, an inconsistent
 * `totalPages`, and rows whose money invariants do not hold. Row order is
 * returned exactly as received — the browser never sorts or repairs.
 */
export function parsePendingRefundsResponse(
  value: unknown,
  expected: PendingRefundsExpectation,
): PendingRefundsResponse {
  return pendingRefundsResponseSchema
    .superRefine((response, ctx) => pendingRefundsRefinements(response, expected, ctx))
    .parse(value)
}
