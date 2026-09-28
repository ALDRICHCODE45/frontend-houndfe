import { z } from 'zod'
import {
  isValidCalendarDateString,
  isValidMexicoCityDateRange,
  mexicoCityToday,
} from '@/core/shared/utils/mexicoCityCalendar'

/**
 * seller-report.types.ts — wire, query and failure contracts for the seller
 * sales report.
 *
 * Endpoint: `GET /analytics/sales/sellers/:sellerUserId/report?from=..&to=..`
 *
 * Locked contract (backend handoff):
 *   - Tenant/seller identity comes from the JWT. The request carries ONLY the
 *     two calendar boundaries plus the seller in the path — never `tenantId`,
 *     currency or any product dimension.
 *   - `from` is INCLUSIVE and `to` is EXCLUSIVE, both plain `YYYY-MM-DD`
 *     calendar strings in `America/Mexico_City`, at most 366 local days apart.
 *     They stay strings end-to-end; no `Date` parsing happens at this boundary
 *     (parsing shifts calendar days through UTC/browser zones).
 *   - `seller.name` and every metric/count are AUTHORITATIVE. The browser
 *     renders them as returned: it never sums, averages, reclassifies, sorts,
 *     truncates or zero-fills anything.
 *   - `attribution: 'CURRENT_SELLER'` and `balances: 'CURRENT'` are the only
 *     modes this version supports: current seller assignment, current balance
 *     state read when the query ran.
 *   - Confirmed and canceled rows live in SEPARATE sections with separate
 *     `dateBasis` (`confirmedAt` / `canceledAt`). Canceled amounts are
 *     informational and are never aggregated with the confirmed metrics.
 *   - `rowLimit` is fixed at 1000 and NO pagination exists: a window above the
 *     cap fails with `422 SELLER_REPORT_ROW_LIMIT_EXCEEDED` instead of being
 *     truncated, because a silently truncated report would be a false claim.
 *   - Rows arrive ordered (ascending instant, then id) and already inside the
 *     window. A payload that does not satisfy the contract is REJECTED, never
 *     repaired.
 *   - A payload carrying an unknown key means the contract moved; `.strict()`
 *     on every object turns that into a visible failure instead of silent drift
 *     (and keeps unrequested PII such as customer fields out of the UI).
 */

/** The only calendar zone this endpoint accepts or emits. */
export const SELLER_REPORT_TIME_ZONE = 'America/Mexico_City' as const

/** The authoritative maximum number of rows a single report may contain. */
export const SELLER_REPORT_ROW_LIMIT = 1000

/** Authoritative payment states a confirmed row can report. */
export type SellerReportPaymentStatus = 'PAID' | 'PARTIAL' | 'CREDIT'

/** One confirmed sale row. Every field is authoritative and rendered as returned. */
export interface SellerReportConfirmedRow {
  /** Sale identifier (used only for ordering stability and row keys). */
  id: string
  /** Human folio, or `null` when the sale has no folio assigned yet. */
  folio: string | null
  /** Confirmation instant, ISO-8601 UTC. */
  confirmedAt: string
  /** Sale total in integer cents. */
  totalCents: number
  /** Amount collected so far, in integer cents (current state). */
  paidCents: number
  /** Outstanding debt, in integer cents (current state). */
  debtCents: number
  /** Authoritative payment classification of this row. */
  paymentStatus: SellerReportPaymentStatus
}

/** One canceled sale row. The amount is informational only. */
export interface SellerReportCanceledRow {
  /** Sale identifier. */
  id: string
  /** Human folio, or `null` when the sale never had one. */
  folio: string | null
  /** Confirmation instant (ISO-8601 UTC) when the sale was confirmed first. */
  confirmedAt: string | null
  /** Cancellation instant, ISO-8601 UTC — the section's `dateBasis`. */
  canceledAt: string
  /** Sale total at cancellation time, in integer cents. */
  totalCents: number
}

/** Backend-computed confirmed metrics. Never re-derived in the browser. */
export interface SellerReportConfirmedSummary {
  /** Number of confirmed sales in the window (equals `rows.length`). */
  saleCount: number
  /** Net sales value in integer cents. */
  netSalesCents: number
  /** Collected amount in integer cents (current state). */
  collectedCents: number
  /** Outstanding debt in integer cents (current state). */
  outstandingDebtCents: number
  /** Backend-computed average ticket in integer cents. */
  averageTicketCents: number
}

/** Confirmed section: metrics plus every row in the window. */
export interface SellerReportConfirmedSection {
  dateBasis: 'confirmedAt'
  summary: SellerReportConfirmedSummary
  rows: SellerReportConfirmedRow[]
}

/** Canceled section: rows only — no metric may mix them with confirmed sales. */
export interface SellerReportCanceledSection {
  dateBasis: 'canceledAt'
  saleCount: number
  rows: SellerReportCanceledRow[]
}

/** Complete 200 body of a seller sales report. */
export interface SellerSalesReport {
  seller: { id: string; name: string }
  tenantId: string
  timeZone: typeof SELLER_REPORT_TIME_ZONE
  from: string
  to: string
  generatedAt: string
  attribution: 'CURRENT_SELLER'
  balances: 'CURRENT'
  rowLimit: typeof SELLER_REPORT_ROW_LIMIT
  rowCount: number
  confirmed: SellerReportConfirmedSection
  canceled: SellerReportCanceledSection
}

/** The complete request surface: seller path segment plus both boundaries. */
export interface SellerReportRequest {
  sellerUserId: string
  from: string
  to: string
}

/** The request facts a response must echo for its payload to be trusted. */
export interface SellerReportExpectation {
  tenantId: string
  sellerUserId: string
  from: string
  to: string
}

/**
 * Shape-only UUID check for the echoed seller id.
 *
 * The seller id travels as a path segment and is echoed back, so a non-UUID
 * value is a contract break. Version/variant nibbles are deliberately not
 * constrained: identity semantics belong to the backend.
 */
const UUID_SHAPE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Exact ISO-8601 UTC instant: `YYYY-MM-DDTHH:mm:ss(.sss)?Z`. Offsets and local
 * timestamps are rejected by the shape, and the calendar day plus the clock time
 * are validated separately because the platform date parser silently rolls
 * impossible values over (`2025-02-30T…Z` becomes March 2 instead of failing).
 */
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const UTC_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?$/

function isUtcInstant(value: string): boolean {
  if (!UTC_INSTANT_PATTERN.test(value)) return false
  if (!isValidCalendarDateString(value.slice(0, 10))) return false
  if (!UTC_TIME_PATTERN.test(value.slice(11, -1))) return false
  return Number.isFinite(Date.parse(value))
}

const utcInstantSchema = z.string().refine(isUtcInstant, {
  message: 'Expected an ISO-8601 UTC instant ending in Z',
})

/** Integer cents/counts: rejects negatives, fractions, unsafe values and non-numbers. */
const metricSchema = z.number().int().nonnegative().safe()

const sellerReportSellerIdSchema = z.string().regex(UUID_SHAPE_PATTERN, {
  message: 'Expected a UUID seller identifier',
})

/**
 * `.strict()` on every object is load-bearing: an unknown key means the backend
 * contract moved, and silently ignoring it would let the UI drift out of sync
 * (or render unrequested personal data).
 */
const confirmedRowSchema: z.ZodType<SellerReportConfirmedRow> = z
  .object({
    id: z.string().min(1),
    folio: z.string().min(1).nullable(),
    confirmedAt: utcInstantSchema,
    totalCents: metricSchema,
    paidCents: metricSchema,
    debtCents: metricSchema,
    paymentStatus: z.enum(['PAID', 'PARTIAL', 'CREDIT']),
  })
  .strict()

const canceledRowSchema: z.ZodType<SellerReportCanceledRow> = z
  .object({
    id: z.string().min(1),
    folio: z.string().min(1).nullable(),
    confirmedAt: utcInstantSchema.nullable(),
    canceledAt: utcInstantSchema,
    totalCents: metricSchema,
  })
  .strict()

const confirmedSummarySchema: z.ZodType<SellerReportConfirmedSummary> = z
  .object({
    saleCount: metricSchema,
    netSalesCents: metricSchema,
    collectedCents: metricSchema,
    outstandingDebtCents: metricSchema,
    averageTicketCents: metricSchema,
  })
  .strict()

const sellerSalesReportSchema: z.ZodType<SellerSalesReport> = z
  .object({
    seller: z
      .object({
        id: sellerReportSellerIdSchema,
        name: z.string().min(1),
      })
      .strict(),
    tenantId: z.string().min(1),
    timeZone: z.literal(SELLER_REPORT_TIME_ZONE),
    from: z.string(),
    to: z.string(),
    generatedAt: utcInstantSchema,
    attribution: z.literal('CURRENT_SELLER'),
    balances: z.literal('CURRENT'),
    rowLimit: z.literal(SELLER_REPORT_ROW_LIMIT),
    rowCount: metricSchema,
    confirmed: z
      .object({
        dateBasis: z.literal('confirmedAt'),
        summary: confirmedSummarySchema,
        rows: z.array(confirmedRowSchema),
      })
      .strict(),
    canceled: z
      .object({
        dateBasis: z.literal('canceledAt'),
        saleCount: metricSchema,
        rows: z.array(canceledRowSchema),
      })
      .strict(),
  })
  .strict()

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message })
}

/** The Mexico City calendar day (`YYYY-MM-DD`) an instant falls on. */
function localCalendarDay(instantMs: number): string {
  return mexicoCityToday(instantMs).toString()
}

/**
 * Reject rows that are duplicated, out of order, or outside the window.
 *
 * Ordering is by ascending instant, then id, per section, using that section's
 * own `dateBasis`. Window membership is measured on the LOCAL Mexico City day,
 * not the UTC day: 05:30Z on the lower boundary belongs to the previous local
 * day and is outside `[from,to)`.
 *
 * A row whose instant is not parseable is SKIPPED here: the field schema
 * already reports it, and no cross-field rule may crash on a dirty payload
 * (`superRefine` runs on shape-invalid input too).
 */
function addRowIssues<T extends { id: string }>(
  rows: readonly T[],
  instantOf: (row: T) => string,
  window: { from: string; to: string },
  path: string,
  ctx: z.RefinementCtx,
): void {
  let previousInstant: number | null = null
  let previousId: string | null = null

  rows.forEach((row, index) => {
    const instant = Date.parse(instantOf(row))
    if (!Number.isFinite(instant)) return

    const day = localCalendarDay(instant)
    if (day < window.from || day >= window.to) {
      addIssue(
        ctx,
        [path, index],
        `Row local day "${day}" falls outside the half-open [from,to) window`,
      )
    }

    if (previousInstant !== null && previousId !== null) {
      const outOfOrder =
        instant < previousInstant || (instant === previousInstant && row.id <= previousId)
      if (outOfOrder) {
        addIssue(
          ctx,
          [path, index, 'id'],
          `Row "${row.id}" is duplicate or out of order after "${previousId}"`,
        )
      }
    }

    previousInstant = instant
    previousId = row.id
  })
}

/**
 * Per-response refinements that cannot be expressed field-by-field: the echoed
 * identity/window must match the request, the window itself must be a strict,
 * at-most-366-local-day half-open range, the counts must reconcile with the
 * arrays (and respect the cap), and every row must be ordered and in-window.
 *
 * These are rejections, never repairs. Sums are deliberately NOT cross-checked:
 * the browser never re-derives a metric, so a sum mismatch is the backend's
 * business, not a reason to refuse an otherwise contract-shaped payload.
 */
function responseRefinements(
  response: SellerSalesReport,
  expected: SellerReportExpectation,
  ctx: z.RefinementCtx,
): void {
  if (response.tenantId !== expected.tenantId) {
    addIssue(ctx, ['tenantId'], 'Echoed tenant does not match the request tenant')
  }
  if (response.seller.id !== expected.sellerUserId) {
    addIssue(ctx, ['seller', 'id'], 'Echoed seller does not match the requested seller')
  }
  if (response.from !== expected.from) {
    addIssue(ctx, ['from'], `Echoed from "${response.from}" does not match the request`)
  }
  if (response.to !== expected.to) {
    addIssue(ctx, ['to'], `Echoed to "${response.to}" does not match the request`)
  }

  // The WINDOW is validated before the counts: an impossible window can
  // otherwise be "satisfied" by an equally impossible row list.
  if (!isValidMexicoCityDateRange(response.from, response.to)) {
    addIssue(
      ctx,
      ['from'],
      'The reported window must be a strict non-empty Mexico City range of at most 366 days',
    )
    return
  }

  // Cross-field rules only apply to a structurally usable payload. A payload
  // whose sections are not row arrays is already rejected by the shape schema,
  // and `superRefine` also runs on shape-invalid input: reading the arrays
  // defensively keeps this function a pure checker instead of a crash site.
  const confirmedRows = Array.isArray(response.confirmed?.rows) ? response.confirmed.rows : null
  const canceledRows = Array.isArray(response.canceled?.rows) ? response.canceled.rows : null
  if (confirmedRows === null || canceledRows === null) return

  const confirmedCount = confirmedRows.length
  const canceledCount = canceledRows.length

  if (response.confirmed.summary.saleCount !== confirmedCount) {
    addIssue(
      ctx,
      ['confirmed', 'summary', 'saleCount'],
      `Expected ${confirmedCount} confirmed sales to match the confirmed rows`,
    )
  }
  if (response.canceled.saleCount !== canceledCount) {
    addIssue(
      ctx,
      ['canceled', 'saleCount'],
      `Expected ${canceledCount} canceled sales to match the canceled rows`,
    )
  }
  if (response.rowCount !== confirmedCount + canceledCount) {
    addIssue(
      ctx,
      ['rowCount'],
      `Expected rowCount to equal the ${confirmedCount + canceledCount} returned rows`,
    )
  }
  if (response.rowCount > response.rowLimit) {
    addIssue(ctx, ['rowCount'], `The report cannot exceed the ${response.rowLimit}-row limit`)
  }

  const window = { from: response.from, to: response.to }
  addRowIssues(confirmedRows, (row) => row.confirmedAt, window, 'confirmed', ctx)
  addRowIssues(canceledRows, (row) => row.canceledAt, window, 'canceled', ctx)
}

/**
 * Validate an untrusted report body against BOTH its own shape and the request
 * that produced it.
 *
 * Throws `ZodError` on any deviation: missing/extra keys, a non-UUID seller, a
 * malformed or non-UTC instant, negative/fractional/unsafe metrics, counts that
 * do not reconcile with the rows, a window above the row cap, an echoed
 * tenant/seller/window that differs from the request, an impossible window, and
 * rows that are unordered or whose Mexico City local day leaves `[from,to)`.
 * Never returns a repaired payload.
 */
export function parseSellerSalesReportResponse(
  value: unknown,
  expected: SellerReportExpectation,
): SellerSalesReport {
  return sellerSalesReportSchema
    .superRefine((response, ctx) => responseRefinements(response, expected, ctx))
    .parse(value)
}

/** How a failed report request must be presented. */
export type SellerReportFailureKind =
  | 'seller-not-found'
  | 'row-limit-exceeded'
  | 'forbidden'
  | 'unauthorized'
  | 'invalid-request'
  | 'pdf-generation-failed'
  | 'unknown'

/**
 * Normalized failure. `status` is the HTTP status when there was a response;
 * `rowLimit`/`rowCount` are only present for the row-cap domain error.
 */
export interface SellerReportFailure {
  readonly kind: SellerReportFailureKind
  readonly status: number | null
  readonly rowLimit: number | null
  readonly rowCount: number | null
}

/** Exact domain error codes this endpoint may return. */
export const SELLER_NOT_FOUND_ERROR = 'SELLER_NOT_FOUND'
export const SELLER_REPORT_ROW_LIMIT_ERROR = 'SELLER_REPORT_ROW_LIMIT_EXCEEDED'
/** Raised by the PDF endpoint when the server cannot render the document. */
export const SELLER_REPORT_PDF_GENERATION_ERROR = 'PDF_GENERATION_FAILED'

function responseStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  const response = (error as { response?: unknown }).response
  if (typeof response !== 'object' || response === null) return null
  const status = (response as { status?: unknown }).status
  return typeof status === 'number' && Number.isInteger(status) ? status : null
}

function responseBody(error: unknown): Record<string, unknown> | null {
  if (typeof error !== 'object' || error === null) return null
  const response = (error as { response?: unknown }).response
  if (typeof response !== 'object' || response === null) return null
  const data = (response as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return null
  return data as Record<string, unknown>
}

function safeCount(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    Number.isSafeInteger(value)
    ? value
    : null
}

/**
 * Map a rejected request to a presentation-safe failure.
 *
 * The mapping keys off the HTTP status plus the machine `error` code only:
 * `message` is human copy that can change (or be localized) and `timestamp` is
 * meaningless for routing, so neither can select the failure kind. A response
 * that does not match an exact envelope degrades to `unknown` instead of
 * guessing — and a network failure degrades to `unknown` with a null status.
 */
export function parseSellerReportFailure(error: unknown): SellerReportFailure {
  const status = responseStatus(error)
  const body = responseBody(error)
  const code = typeof body?.error === 'string' ? body.error : null
  const base = { status, rowLimit: null, rowCount: null } as const

  if (status === 404 && code === SELLER_NOT_FOUND_ERROR) {
    return { ...base, kind: 'seller-not-found' }
  }

  if (status === 422 && code === SELLER_REPORT_ROW_LIMIT_ERROR) {
    return {
      kind: 'row-limit-exceeded',
      status,
      rowLimit: safeCount(body?.rowLimit),
      rowCount: safeCount(body?.rowCount),
    }
  }

  if (status === 401) return { ...base, kind: 'unauthorized' }
  if (status === 403) return { ...base, kind: 'forbidden' }
  if (status === 400) return { ...base, kind: 'invalid-request' }
  if (status === 500 && code === SELLER_REPORT_PDF_GENERATION_ERROR) {
    return { ...base, kind: 'pdf-generation-failed' }
  }
  return { ...base, kind: 'unknown' }
}
