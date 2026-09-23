import { z } from 'zod'
import {
  isValidCalendarDateString,
  MAX_MEXICO_CITY_RANGE_DAYS,
  parseMexicoCityCalendarDate,
} from '@/core/shared/utils/mexicoCityCalendar'

/**
 * branch-sales-timeseries.types.ts — wire, query and validation contracts for
 * the backend-owned `GET /analytics/sales/timeseries` endpoint
 * (ODD dashboard-operational-insights OI-4).
 *
 * Locked contract (backend OI-2 handoff):
 *   - Tenant/branch identity comes from the JWT. The request carries ONLY the
 *     two calendar boundaries plus the single supported interval — never
 *     tenantId, branchId, currency, or any product dimension.
 *   - `from` is INCLUSIVE and `to` is EXCLUSIVE, both plain `YYYY-MM-DD`
 *     calendar strings in `America/Mexico_City`. They stay strings end-to-end;
 *     no `Date` parsing happens at this boundary (parsing shifts calendar days
 *     through UTC/browser zones).
 *   - The backend returns EVERY local calendar day in `[from,to)`, zero-filled
 *     where there were no sales, already ordered. The frontend therefore
 *     VALIDATES the shape and never fills, sorts, aggregates or derives a
 *     single point — a payload that does not already satisfy the contract is
 *     rejected instead of repaired.
 *   - Every metric is a SAFE NON-NEGATIVE INTEGER the backend owns: integer
 *     cents for monetary values and an integer count for `saleCount`.
 *   - Each bucket is a CONFIRMED-SALE-DAY cohort: `collectedCents` and
 *     `outstandingDebtCents` describe the CURRENT collected/outstanding state of
 *     the sales confirmed on that local date, as observed when the query ran.
 *     They are deliberately not "cash moved during that day" or "debt
 *     originated that day" — the frontend renders them as returned and never
 *     reclassifies them.
 */

/** The only calendar zone this endpoint accepts or emits. */
export const BRANCH_SALES_TIMESERIES_TIME_ZONE = 'America/Mexico_City' as const

/** Literal type derived from the constant (the constant stays authoritative). */
export type BranchSalesTimeseriesTimeZone = typeof BRANCH_SALES_TIMESERIES_TIME_ZONE

/** The only interval v1 accepts; the literal type makes a typo uncompilable. */
export const BRANCH_SALES_TIMESERIES_INTERVAL = 'day' as const

/** Literal type derived from the constant. */
export type BranchSalesTimeseriesInterval = typeof BRANCH_SALES_TIMESERIES_INTERVAL

/**
 * Query contract. `from`/`to` are exact local calendar strings (`YYYY-MM-DD`)
 * in `America/Mexico_City`; `from` inclusive, `to` exclusive. These three keys
 * are the complete request surface — the API layer passes nothing else.
 */
export interface BranchSalesTimeseriesQuery {
  /** Inclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
  from: string
  /** Exclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
  to: string
  /** Bucket size. Only `day` exists in v1. */
  interval: BranchSalesTimeseriesInterval
}

/**
 * One backend-provided calendar bucket. Every field is authoritative: the
 * frontend renders these values and never recomputes them.
 */
export interface BranchSalesTimeseriesPoint {
  /** Local calendar day this bucket belongs to (`YYYY-MM-DD`). */
  date: string
  /** Gross sales value for the day, in integer cents. */
  grossSalesCents: number
  /** Net sales value for the day, in integer cents. */
  netSalesCents: number
  /**
   * CURRENT collected state, read at query time, of the sales CONFIRMED on this
   * bucket's local date — not the cash collected during that date. A sale
   * confirmed on the bucket date whose payment lands days later still counts
   * here, and a payment collected today against an older confirmed sale does
   * not.
   */
  collectedCents: number
  /**
   * CURRENT outstanding state, read at query time, of the sales CONFIRMED on
   * this bucket's local date — the remaining debt of that confirmed-day cohort,
   * not the debt originated on that date.
   */
  outstandingDebtCents: number
  /** Number of sales counted in the day (integer count, not cents). */
  saleCount: number
  /** Backend-computed average ticket, in integer cents (0 on a zero-sale day). */
  averageTicketCents: number
}

/**
 * Wire response contract: the echoed window metadata plus the ordered,
 * zero-filled buckets. Refunds are intentionally absent — no cash-net value is
 * invented at this boundary. Every monetary field is a point-in-time
 * (query-time) state of a confirmed-sale-day cohort.
 */
export interface BranchSalesTimeseriesResponse {
  /** Effective calendar zone of the reported window. */
  timeZone: BranchSalesTimeseriesTimeZone
  /** Echo of the inclusive lower boundary (`YYYY-MM-DD`). */
  from: string
  /** Echo of the exclusive upper boundary (`YYYY-MM-DD`). */
  to: string
  /** Echo of the applied interval. */
  interval: BranchSalesTimeseriesInterval
  /** One entry per local day in `[from,to)`, ordered and zero-filled. */
  points: BranchSalesTimeseriesPoint[]
}

/** The request facts a response must echo back for the payload to be trusted. */
export interface BranchSalesTimeseriesExpectation {
  from: string
  to: string
  interval: BranchSalesTimeseriesInterval
}

/** Exact canonical `YYYY-MM-DD` shape; rejects padding, offsets and timestamps. */
const branchSalesTimeseriesCalendarDateSchema = z.string().refine(isValidCalendarDateString, {
  message: 'Expected an exact YYYY-MM-DD America/Mexico_City calendar date',
})

/** Integer cents/counts: rejects negatives, fractions, unsafe values and non-numbers. */
const branchSalesTimeseriesMetricSchema = z.number().int().nonnegative().safe()

/**
 * `.strict()` on every object is load-bearing: an unknown key means the backend
 * contract moved, and silently ignoring it would let the UI drift out of sync
 * with the real payload.
 */
const branchSalesTimeseriesPointSchema: z.ZodType<BranchSalesTimeseriesPoint> = z
  .object({
    date: branchSalesTimeseriesCalendarDateSchema,
    grossSalesCents: branchSalesTimeseriesMetricSchema,
    netSalesCents: branchSalesTimeseriesMetricSchema,
    collectedCents: branchSalesTimeseriesMetricSchema,
    outstandingDebtCents: branchSalesTimeseriesMetricSchema,
    saleCount: branchSalesTimeseriesMetricSchema,
    averageTicketCents: branchSalesTimeseriesMetricSchema,
  })
  .strict()

const branchSalesTimeseriesResponseSchema: z.ZodType<BranchSalesTimeseriesResponse> = z
  .object({
    timeZone: z.literal(BRANCH_SALES_TIMESERIES_TIME_ZONE),
    from: branchSalesTimeseriesCalendarDateSchema,
    to: branchSalesTimeseriesCalendarDateSchema,
    interval: z.literal(BRANCH_SALES_TIMESERIES_INTERVAL),
    points: z.array(branchSalesTimeseriesPointSchema),
  })
  .strict()

/**
 * Iteration cap for window measurement: exactly one step past the longest valid
 * window. Reaching it without touching the upper boundary proves the window is
 * out of contract.
 */
const MAX_TIMESERIES_WINDOW_STEPS = MAX_MEXICO_CITY_RANGE_DAYS + 1

/** Measurement outcome for a response window. */
type CalendarWindowSpan =
  | { readonly kind: 'ok'; readonly days: number }
  | { readonly kind: 'empty' }
  | { readonly kind: 'too-long' }
  | { readonly kind: 'invalid' }

/**
 * Measure the half-open `[from,to)` window without ever stepping more than
 * `MAX_TIMESERIES_WINDOW_STEPS` (367) times.
 *
 * A schema-valid but hostile range — `0001-01-01` → `9999-12-31` is roughly
 * 3.65 million local days — therefore costs at most 367 iterations before it is
 * rejected as out of contract, instead of walking every calendar day. `empty`
 * covers BOTH equal and inverted boundaries: the window must be a strict,
 * non-empty range.
 */
function measureCalendarWindow(from: string, to: string): CalendarWindowSpan {
  const fromDate = parseMexicoCityCalendarDate(from)
  const toDate = parseMexicoCityCalendarDate(to)
  if (!fromDate || !toDate) return { kind: 'invalid' }

  let days = 0
  let cursor = fromDate
  // Bounded by construction: this loop can never run more than the cap.
  while (days < MAX_TIMESERIES_WINDOW_STEPS && cursor.compare(toDate) < 0) {
    days += 1
    cursor = cursor.add({ days: 1 })
  }

  if (days === 0) return { kind: 'empty' }
  // The cap was reached before the upper boundary: longer than any valid window.
  if (cursor.compare(toDate) < 0) return { kind: 'too-long' }
  if (days > MAX_MEXICO_CITY_RANGE_DAYS) return { kind: 'too-long' }
  return { kind: 'ok', days }
}

const CALENDAR_WINDOW_ISSUES: Record<Exclude<CalendarWindowSpan['kind'], 'ok'>, string> = {
  empty: 'The response window must be a strict non-empty range (from < to)',
  'too-long': `The response window must not exceed ${MAX_MEXICO_CITY_RANGE_DAYS} local calendar days`,
  invalid: 'The response window boundaries are not a usable calendar range',
}

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message })
}

/**
 * Per-response refinements that cannot be expressed field-by-field: the echoed
 * window must match the request, the window itself must be a strict,
 * at-most-366-day half-open range, and the point list must already be ordered,
 * in-range and complete. These are rejections, never repairs — the browser is
 * forbidden from sorting, deduplicating, filling or truncating the series.
 */
function responseRefinements(
  response: BranchSalesTimeseriesResponse,
  expected: BranchSalesTimeseriesExpectation,
  ctx: z.RefinementCtx,
): void {
  if (response.from !== expected.from) {
    addIssue(ctx, ['from'], `Echoed from "${response.from}" does not match the request`)
  }
  if (response.to !== expected.to) {
    addIssue(ctx, ['to'], `Echoed to "${response.to}" does not match the request`)
  }
  if (response.interval !== expected.interval) {
    addIssue(ctx, ['interval'], `Echoed interval "${response.interval}" does not match the request`)
  }

  // The WINDOW is validated before completeness. An equal/inverted window can
  // otherwise be "satisfied" by a zero-point list, and an over-long window can
  // be "satisfied" by an equally long list while the measurement walks millions
  // of days. Both are impossible windows for this endpoint and must reject.
  const window = measureCalendarWindow(response.from, response.to)
  if (window.kind !== 'ok') {
    addIssue(ctx, ['from'], CALENDAR_WINDOW_ISSUES[window.kind])
    return
  }
  const expectedDays = window.days

  let previousDate: string | null = null
  response.points.forEach((point, index) => {
    if (point.date < response.from || point.date >= response.to) {
      addIssue(
        ctx,
        ['points', index, 'date'],
        `Bucket "${point.date}" falls outside the half-open [from,to) window`,
      )
    }
    if (previousDate !== null && point.date <= previousDate) {
      addIssue(
        ctx,
        ['points', index, 'date'],
        `Bucket "${point.date}" is duplicate or out of order after "${previousDate}"`,
      )
    }
    previousDate = point.date
  })

  if (response.points.length !== expectedDays) {
    addIssue(
      ctx,
      ['points'],
      `Expected ${expectedDays} zero-filled daily buckets but received ${response.points.length}`,
    )
  }
}

/**
 * Validate an untrusted timeseries body against BOTH its own shape and the
 * request that produced it.
 *
 * Throws `ZodError` on any deviation: missing/extra keys, malformed or
 * impossible dates, a wrong time zone or interval, an equal/inverted window, a
 * window longer than 366 local calendar days, negative/fractional/unsafe
 * metrics, echoed boundaries that differ from the request, and points that are
 * unordered, duplicated, out of range or incomplete. Window measurement is
 * hard-capped at 367 calendar steps, so even a schema-valid multi-million-day
 * window is rejected in bounded time. Never returns a repaired payload.
 */
export function parseBranchSalesTimeseriesResponse(
  value: unknown,
  expected: BranchSalesTimeseriesExpectation,
): BranchSalesTimeseriesResponse {
  return branchSalesTimeseriesResponseSchema
    .superRefine((response, ctx) => responseRefinements(response, expected, ctx))
    .parse(value)
}
