/**
 * A5 intercepted responsive evidence for the branch sales summary surface,
 * routed at the canonical `/dashboard` destination (ODD dashboard-analytics D1).
 *
 * Standalone on purpose: it declares only the strict `/__e2e-api` surface the
 * view really uses — the aggregate summary AND (OI-5A) the daily time series —
 * pins the browser clock so the deterministic current-month `[from, to)` window
 * cannot drift across midnight in `America/Mexico_City`, seeds the committed
 * `vueuse-color-mode` preference so both light and dark resolve deterministically
 * for every matrix viewport, and records explicit document geometry plus the
 * rendered responsive hierarchy proof.
 *
 * OI-5A additions: the trend is exercised as a real Unovis surface in a real
 * browser — chart presence, resolved Coco series colors per theme, the
 * `aria-pressed`/44px metric selector, the semantic table's exact backend dates
 * and values, and the switch between cents and a grouped count. Request audits
 * are order-free, because the summary and the series are independent concurrent
 * queries.
 *
 * `/dashboard` is the only authorized route under test. `/` and
 * `/analytics/resumen-ventas` are not application routes any more; the focused
 * router unit suite (not this spec) owns that negative proof.
 *
 * OI-5B2 S4 additions: the three committed operational modules (recent confirmed
 * sales, confirmed sales with debt, pending refund obligations) are exercised as
 * real intercepted surfaces. A spec-local RAW request recorder re-proves the exact
 * browser wire independently of the interception result — the single
 * comma-joined `paymentStatus=PARTIAL,CREDIT` value, the absence of bracketed
 * array keys and of any tenant/branch identity, and the fact that each operational
 * request happens exactly once (aborted requests included) — alongside the panel
 * headings, authoritative per-kind amounts, plain-text folio/refund sale id, the
 * after-the-trend full-width three-column grid and its one-column reading order
 * below `lg`. A separate permission-denied case proves an Analytics-only identity
 * renders no operational module and issues no operational request at all.
 */
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import { API_PREFIX, type DeclaredRoute } from '../fixtures/network'
import type { Locator, Page } from '@playwright/test'
import { RESPONSIVE_VIEWPORTS } from '../targets/types'
import { assertDocumentNoHorizontalOverflow, assertExactViewport } from '../assertions/geometry'

const VIEW_PATH = '/dashboard'
const SUMMARY_PATH = '/analytics/sales/summary'
const TIMESERIES_PATH = '/analytics/sales/timeseries'
const TIMESERIES_INTERVAL = 'day'
const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City'
const SUMMARY_H1 = 'Resumen de ventas'
const RANGE_HINT = 'El rango incluye el día «Desde» y excluye el día «Hasta».'
const SALES_HEADING = 'Ventas'
const REFUNDS_HEADING = 'Reembolsos'
const DEBT_CUE = 'Con deuda pendiente'
const PENDING_REFUND_CUE = 'Reembolsos pendientes'

// ── OI-5B2 S4: operational wire surfaces ──────────────────────────────────────
const SALES_PATH = '/sales'
const PENDING_REFUNDS_PATH = '/sales/refunds/pending'
const OPERATIONAL_GRID_TESTID = 'branch-summary-operational-grid'
const OPERATIONAL_PANEL_TESTID = 'dashboard-operational-panel'
const OPERATIONAL_LIST_TESTID = 'dashboard-operational-list'
const OPERATIONAL_SALE_ROW_TESTID = 'dashboard-sale-row'
const OPERATIONAL_REFUND_ROW_TESTID = 'dashboard-refund-row'

/**
 * The exact permission set the three committed operational modules require:
 * the analytics summary/trend plus the two granted sales modules. A narrowed set
 * is a separate case, never a silent edit of this one.
 */
const OPERATIONAL_PERMISSIONS: readonly string[] = [
  'read:Analytics',
  'read:Sale',
  'read:SaleRefund',
]

/** Analytics-only identity: every operational module must disappear entirely. */
const ANALYTICS_ONLY_PERMISSIONS: readonly string[] = ['read:Analytics']

/** Fixed absolute instant (12:30 in Mexico City) so "today" cannot drift across midnight. */
const FIXED_NOW_MS = Date.parse('2025-06-15T18:30:00.000Z')

/** Exact `YYYY-MM-DD` calendar day of an absolute instant in the summary's zone. */
const mexicoCityCalendarDate = (instantMs: number): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instantMs))

/** Pure calendar-day shift on an exact date string; never a browser-local instant. */
const shiftCalendarDays = (calendarDate: string, days: number): string => {
  const [year, month, day] = calendarDate.split('-')
  const utcMidnight = Date.UTC(Number(year), Number(month) - 1, Number(day) + days)
  return new Date(utcMidnight).toISOString().slice(0, 10)
}

/** First calendar day of the month that contains an exact `YYYY-MM-DD` date. */
const startOfCalendarMonth = (calendarDate: string): string => `${calendarDate.slice(0, 7)}-01`

const TODAY = mexicoCityCalendarDate(FIXED_NOW_MS)
/** The view's committed initial preset is `thisMonth`: `[month start, tomorrow)`. */
const EXPECTED_FROM = startOfCalendarMonth(TODAY)
const EXPECTED_TO = shiftCalendarDays(TODAY, 1)

/**
 * Manual custom `from` used to prove the preset clears while the range still
 * queries: `[CUSTOM_FROM, EXPECTED_TO)` stays valid and keeps `to` untouched.
 */
const CUSTOM_FROM = '2025-06-05'

/** The eight authoritative metric fields the summary contract owns, in payload order. */
const METRIC_KEYS = [
  'grossSalesCents',
  'netSalesCents',
  'collectedCents',
  'outstandingDebtCents',
  'saleCount',
  'averageTicketCents',
  'settledRefundsCents',
  'pendingRefundObligationsCents',
] as const

/** Committed window echo plus exactly the eight metrics; extra or missing fields do not compile. */
interface SummaryPayload {
  timeZone: string
  from: string
  to: string
  grossSalesCents: number
  netSalesCents: number
  collectedCents: number
  outstandingDebtCents: number
  saleCount: number
  averageTicketCents: number
  settledRefundsCents: number
  pendingRefundObligationsCents: number
}

/** Non-empty intercepted payload with positive debt and positive pending refund obligations. */
const SUMMARY: SummaryPayload = {
  timeZone: MEXICO_CITY_TIME_ZONE,
  from: EXPECTED_FROM,
  to: EXPECTED_TO,
  grossSalesCents: 123456789,
  netSalesCents: 98765432,
  collectedCents: 55500000,
  outstandingDebtCents: 432100,
  saleCount: 1234,
  averageTicketCents: 80012,
  settledRefundsCents: 150000,
  pendingRefundObligationsCents: 25000,
}

/**
 * Distinct second response for the manually edited window: the changed net-sales
 * amount proves the edited query's response — not a cached render — is on screen.
 */
const CUSTOM_SUMMARY: SummaryPayload = {
  ...SUMMARY,
  from: CUSTOM_FROM,
  to: EXPECTED_TO,
  netSalesCents: 42424242,
  saleCount: 777,
}

/** One backend daily bucket, exactly as `GET /analytics/sales/timeseries` returns it. */
interface TimeseriesPoint {
  date: string
  grossSalesCents: number
  netSalesCents: number
  collectedCents: number
  outstandingDebtCents: number
  saleCount: number
  averageTicketCents: number
}

/** Committed daily-series response: window echo plus one zero-filled bucket per local day. */
interface TimeseriesPayload {
  timeZone: string
  from: string
  to: string
  interval: string
  points: TimeseriesPoint[]
}

/** Number of local calendar days in the half-open `[from,to)` window. */
const windowDayCount = (from: string, to: string): number => {
  let days = 0
  let cursor = from
  while (cursor < to) {
    days += 1
    cursor = shiftCalendarDays(cursor, 1)
  }
  return days
}

/**
 * Realistic zero-filled backend buckets for one exact window. Every local day in
 * `[from,to)` is present — the frontend is forbidden from filling, sorting or
 * dropping a bucket — and every fifth day is a genuinely zero-filled day so the
 * UI must keep an empty bucket visible instead of collapsing it.
 */
const buildTimeseriesPoints = (from: string, to: string): TimeseriesPoint[] =>
  Array.from({ length: windowDayCount(from, to) }, (_unused, index) => {
    const zeroFilled = index % 5 === 3
    // The two metrics the browser matrix switches between must have DIFFERENT
    // normalized shapes. Each metric is auto-scaled onto its own Y domain, so two
    // proportional series would map onto coincident SVG paths and a geometry
    // assertion could not tell them apart. Net sales ramps smoothly; the sale
    // count is a non-monotonic sawtooth.
    const saleCount = zeroFilled ? 0 : 9 + ((index * 7) % 17)
    const netSalesCents = zeroFilled ? 0 : 1_000_000 + index * 90_000
    const grossSalesCents = zeroFilled ? 0 : netSalesCents + 25_000 * index
    const collectedCents = Math.round(netSalesCents * 0.8)
    const averageTicketCents = zeroFilled ? 0 : Math.round(netSalesCents / saleCount)
    return {
      date: shiftCalendarDays(from, index),
      grossSalesCents,
      netSalesCents,
      collectedCents,
      outstandingDebtCents: netSalesCents - collectedCents,
      saleCount,
      averageTicketCents,
    }
  })

const TIMESERIES: TimeseriesPayload = {
  timeZone: MEXICO_CITY_TIME_ZONE,
  from: EXPECTED_FROM,
  to: EXPECTED_TO,
  interval: TIMESERIES_INTERVAL,
  points: buildTimeseriesPoints(EXPECTED_FROM, EXPECTED_TO),
}

const CUSTOM_TIMESERIES: TimeseriesPayload = {
  timeZone: MEXICO_CITY_TIME_ZONE,
  from: CUSTOM_FROM,
  to: EXPECTED_TO,
  interval: TIMESERIES_INTERVAL,
  points: buildTimeseriesPoints(CUSTOM_FROM, EXPECTED_TO),
}

/** Mirrors the committed `CURRENCY_CONFIG` + `formatCentsMXN` presentation contract. */
const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const counter = new Intl.NumberFormat('es-MX')
const amount = (cents: number): string => currency.format(cents / 100)

/** Visible sales-section labels paired with the exact intercepted amount each must render. */
const SALES_CARDS: ReadonlyArray<readonly [string, string]> = [
  ['Ventas netas', amount(SUMMARY.netSalesCents)],
  ['Ventas brutas', amount(SUMMARY.grossSalesCents)],
  ['Cobrado', amount(SUMMARY.collectedCents)],
  ['Deuda pendiente', amount(SUMMARY.outstandingDebtCents)],
  ['Cantidad de ventas', counter.format(SUMMARY.saleCount)],
  ['Ticket promedio', amount(SUMMARY.averageTicketCents)],
]

/** Visible refunds-section labels; refund flows stay separate from the sales lines. */
const REFUNDS_CARDS: ReadonlyArray<readonly [string, string]> = [
  ['Reembolsos liquidados', amount(SUMMARY.settledRefundsCents)],
  ['Obligaciones de reembolso pendientes', amount(SUMMARY.pendingRefundObligationsCents)],
]

/** States that must not survive a fulfilled response. */
const ABSENT_STATES = [
  'branch-summary-loading',
  'branch-summary-error',
  'branch-summary-invalid',
  'branch-summary-refresh-error',
  'branch-summary-empty',
  'branch-summary-idle',
] as const

/**
 * No progress, comparison or derived aggregate visualization may exist: the
 * committed surface renders the eight backend metrics verbatim and fabricates no
 * target or computed delta. The daily series IS a real backend time series, so
 * chart/trend selectors are intentionally no longer prohibited here; the
 * retained prohibitions are the ones that would still be fabricated UI.
 */
const ABSENT_VISUALIZATION_SELECTORS = [
  'canvas',
  'progress',
  '[role="progressbar"]',
  '[role="meter"]',
  '[data-testid*="comparison"]',
  '[data-testid*="derived"]',
] as const

// ── OI-5A: daily trend surface ────────────────────────────────────────────────

const TREND_TESTID = 'branch-sales-trend'
const TREND_CHART_TESTID = 'branch-sales-trend-chart'
const TREND_METRIC_TESTID = 'branch-sales-trend-metric'
const TREND_TABLE_TESTID = 'branch-sales-trend-table'
const TREND_TABLE_SUMMARY_TESTID = 'branch-sales-trend-table-summary'
const DEFAULT_METRIC_KEY = 'netSalesCents'

/** The six selectable fields, in the committed selector order. */
const TREND_METRIC_KEYS = [
  'netSalesCents',
  'grossSalesCents',
  'collectedCents',
  'outstandingDebtCents',
  'saleCount',
  'averageTicketCents',
] as const

/** Trend states that must not survive a fulfilled time-series response. */
const ABSENT_TREND_STATES = [
  'branch-sales-trend-loading',
  'branch-sales-trend-error',
  'branch-sales-trend-refresh-error',
  'branch-sales-trend-refreshing',
  'branch-sales-trend-empty',
] as const

/**
 * Resolved Coco series colors per theme. Unovis 1.7.0 only matches its own dark
 * selectors (`html[data-theme="dark"]`, `html.dark-theme`, ...), never the app's
 * `html.dark`, so these two exact values are the rendered proof that the
 * explicit `.dark` overrides really reach the SVG: coco-500 area / coco-600 line
 * in light, coco-400 area / coco-300 line in dark.
 */
const SERIES_COLORS: Readonly<
  Record<ColorMode, { readonly areaFill: string; readonly lineStroke: string }>
> = {
  light: { areaFill: 'rgb(36, 66, 246)', lineStroke: 'rgb(29, 53, 196)' },
  dark: { areaFill: 'rgb(83, 115, 251)', lineStroke: 'rgb(126, 150, 255)' },
}

/** Committed quick-range preset labels, in display order. */
const PRESET_LABELS = ['Hoy', 'Últimos 7 días', 'Este mes', 'Mes anterior'] as const

/** `PRESET_LABELS` index of the view's committed initial selection (`Este mes`). */
const SELECTED_PRESET_INDEX = 2

/** Bounded initial-render wait: the cold dev server transforms the whole app on the first test. */
const INITIAL_RENDER_TIMEOUT_MS = 15_000

/** Tailwind `lg` min-width: the single breakpoint the overview hierarchy switches on. */
const LAYOUT_WIDE_MIN_WIDTH_PX = 1024

/** Small rounding allowance for bounding-box comparisons; never a pixel snapshot. */
const LAYOUT_TOLERANCE_PX = 2

/** Minimum interaction target height the committed date inputs and presets declare. */
const MIN_INTERACTION_TARGET_PX = 44

/** The committed color-mode preference key `src/main.ts` reads for its dark-first default. */
const COLOR_MODE_STORAGE_KEY = 'vueuse-color-mode'

type ColorMode = 'light' | 'dark'

interface ThemeCase {
  readonly mode: ColorMode
  /** Whether the resolved root must carry `dark` once the app has mounted. */
  readonly expectsDarkRoot: boolean
}

/**
 * Both committed color modes for every matrix viewport. Seeding the storage key
 * before navigation makes the initial root state explicit instead of ambient.
 */
const THEMES: readonly ThemeCase[] = [
  { mode: 'light', expectsDarkRoot: false },
  { mode: 'dark', expectsDarkRoot: true },
]

// ── OI-5B2 S4: operational wire fixtures ──────────────────────────────────────

/**
 * Exact browser query of each fixed operational request, as the committed
 * `csvParamsSerializer` (`src/core/shared/api/paramsSerializer.ts`) emits it:
 * array parameters are joined into ONE comma-separated value under the plain key
 * (`paymentStatus=PARTIAL,CREDIT`), never as bracketed or repeated entries. These
 * shapes are the interception contract; the spec-local raw recorder re-proves the
 * exact wire independently of the interception result.
 */
const RECENT_SALES_QUERY: Readonly<Record<string, string>> = {
  page: '1',
  limit: '5',
  status: 'CONFIRMED',
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
}

const DEBT_SALES_QUERY: Readonly<Record<string, string>> = {
  page: '1',
  limit: '5',
  status: 'CONFIRMED',
  paymentStatus: 'PARTIAL,CREDIT',
  debtMin: '1',
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
}

const PENDING_REFUNDS_QUERY: Readonly<Record<string, string>> = { page: '1', limit: '5' }

/**
 * Raw operational wire multiset, one entry per request, with the exact decoded
 * query entries the browser sent. Each key is `METHOD path?` plus that request's
 * `key=value` entries sorted and joined, so the assertion is independent of
 * request arrival order and of query-parameter order while still pinning the
 * single comma-joined `paymentStatus=PARTIAL,CREDIT` value exactly.
 */
const EXPECTED_OPERATIONAL_RAW_KEYS: readonly string[] = [
  `GET ${SALES_PATH}?limit=5&page=1&sortBy=confirmedAt&sortOrder=desc&status=CONFIRMED`,
  `GET ${SALES_PATH}?debtMin=1&limit=5&page=1&paymentStatus=PARTIAL,CREDIT&sortBy=confirmedAt&sortOrder=desc&status=CONFIRMED`,
  `GET ${PENDING_REFUNDS_PATH}?limit=5&page=1`,
]

interface SaleActorRefWire {
  readonly id: string
  readonly name: string
}

/** One `ConfirmedSaleRow` exactly as `GET /sales` serializes it. */
interface ConfirmedSaleRowWire {
  readonly id: string
  readonly folio: string | null
  readonly status: 'DRAFT' | 'CONFIRMED' | 'CANCELED'
  readonly paymentStatus: 'PAID' | 'PARTIAL' | 'CREDIT' | null
  readonly deliveryStatus: 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'NOT_APPLICABLE'
  readonly totalCents: number
  readonly debtCents: number
  readonly confirmedAt: string | null
  readonly dueDate: string | null
  readonly customer: SaleActorRefWire | null
  readonly cashier: SaleActorRefWire
  readonly seller: SaleActorRefWire | null
  readonly paymentMethods: readonly (
    | 'CASH'
    | 'CARD_CREDIT'
    | 'CARD_DEBIT'
    | 'TRANSFER'
    | 'CREDIT'
  )[]
}

interface ConfirmedSalesListResponseWire {
  readonly data: readonly ConfirmedSaleRowWire[]
  readonly pagination: {
    readonly page: number
    readonly limit: number
    readonly total: number
    readonly totalPages: number
  }
  readonly counts: {
    readonly all: number
    readonly pendingPayments: number
    readonly notDelivered: number
  }
  readonly summary: {
    readonly salesCount: number
    readonly totalSoldCents: number
    readonly outstandingDebtCents: number
  }
}

const RECENT_SALE_ROW: ConfirmedSaleRowWire = {
  id: 'sale-recent-0001',
  folio: 'V-0001',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'NOT_APPLICABLE',
  totalCents: 129_900,
  debtCents: 0,
  confirmedAt: '2025-06-14T21:05:00.000Z',
  dueDate: null,
  customer: { id: 'customer-0001', name: 'Ana Torres' },
  cashier: { id: 'user-0001', name: 'Luis P?' },
  seller: null,
  paymentMethods: ['CASH'],
}

const DEBT_SALE_ROW: ConfirmedSaleRowWire = {
  id: 'sale-debt-0001',
  folio: 'V-0002',
  status: 'CONFIRMED',
  paymentStatus: 'PARTIAL',
  deliveryStatus: 'PENDING',
  totalCents: 120_000,
  debtCents: 45_000,
  confirmedAt: '2025-06-13T17:40:00.000Z',
  dueDate: '2025-06-30T00:00:00.000Z',
  customer: { id: 'customer-0002', name: 'Marta Ruiz' },
  cashier: { id: 'user-0001', name: 'Luis P?' },
  seller: { id: 'user-0002', name: 'Iv?n Soto' },
  paymentMethods: ['CASH', 'CREDIT'],
}

/** Envelope counts/summary stay consistent with the single authoritative row. */
const RECENT_SALES_RESPONSE = {
  data: [RECENT_SALE_ROW],
  pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
  counts: { all: 1, pendingPayments: 0, notDelivered: 0 },
  summary: { salesCount: 1, totalSoldCents: RECENT_SALE_ROW.totalCents, outstandingDebtCents: 0 },
} satisfies ConfirmedSalesListResponseWire

const DEBT_SALES_RESPONSE = {
  data: [DEBT_SALE_ROW],
  pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
  counts: { all: 1, pendingPayments: 1, notDelivered: 1 },
  summary: {
    salesCount: 1,
    totalSoldCents: DEBT_SALE_ROW.totalCents,
    outstandingDebtCents: DEBT_SALE_ROW.debtCents,
  },
} satisfies ConfirmedSalesListResponseWire

/** One `PendingRefundRow` obligation, honouring `outstanding = amount - settled`. */
interface PendingRefundRowWire {
  readonly id: string
  readonly saleId: string
  readonly method: 'cash' | 'card_credit' | 'card_debit' | 'transfer' | 'credit'
  readonly amountCents: number
  readonly settledCents: number
  readonly outstandingCents: number
  readonly reason: 'CUSTOMER_REQUEST' | 'ORDER_ERROR' | 'OUT_OF_STOCK' | 'DUPLICATE_SALE' | 'OTHER'
  readonly status: 'PENDING'
  readonly createdAt: string
}

interface PendingRefundsResponseWire {
  readonly data: readonly PendingRefundRowWire[]
  readonly pagination: {
    readonly page: number
    readonly limit: number
    readonly total: number
    readonly totalPages: number
  }
}

const PENDING_REFUND_ROW: PendingRefundRowWire = {
  id: 'refund-pending-0001',
  saleId: 'sale-refund-0001',
  method: 'cash',
  amountCents: 90_000,
  settledCents: 25_000,
  outstandingCents: 65_000,
  reason: 'CUSTOMER_REQUEST',
  status: 'PENDING',
  createdAt: '2025-06-13T16:20:00.000Z',
}

const PENDING_REFUNDS_RESPONSE = {
  data: [PENDING_REFUND_ROW],
  pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
} satisfies PendingRefundsResponseWire

/** The three committed operational modules, in their DOM/reading order. */
const OPERATIONAL_PANELS = [
  { id: 'dashboard-recent-sales', title: 'Ventas recientes' },
  { id: 'dashboard-debt-sales', title: 'Ventas con deuda' },
  { id: 'dashboard-pending-refunds', title: 'Reembolsos pendientes' },
] as const

/** Operational module states that must not survive a fulfilled response. */
const ABSENT_OPERATIONAL_STATES = [
  'dashboard-operational-loading',
  'dashboard-operational-error',
  'dashboard-operational-empty',
  'dashboard-operational-refresh-error',
  'dashboard-operational-refreshing',
] as const

/**
 * Local matrix case. The shared `ViewportCase` type pins the four committed
 * policy viewports, so the additional wide reference is declared here and its
 * geometry asserted directly instead of widening a shared target type.
 */
interface LocalViewportCase {
  readonly key: string
  readonly width: number
  readonly height: number
}

const WIDE_REFERENCE_VIEWPORT: LocalViewportCase = {
  key: 'wide-5360',
  width: 5360,
  height: 2520,
}

/** The committed matrix plus the local wide reference; both themes each. */
const MATRIX_VIEWPORTS: readonly LocalViewportCase[] = [
  ...RESPONSIVE_VIEWPORTS,
  WIDE_REFERENCE_VIEWPORT,
]

/** The analytics queries the summary surface owns: initial and custom window. */
const ANALYTICS_ROUTES: readonly DeclaredRoute[] = [
  {
    method: 'GET',
    path: SUMMARY_PATH,
    query: { from: EXPECTED_FROM, to: EXPECTED_TO },
    json: SUMMARY,
    count: 1,
  },
  {
    method: 'GET',
    path: SUMMARY_PATH,
    query: { from: CUSTOM_FROM, to: EXPECTED_TO },
    json: CUSTOM_SUMMARY,
    count: 1,
  },
  {
    method: 'GET',
    path: TIMESERIES_PATH,
    query: { from: EXPECTED_FROM, to: EXPECTED_TO, interval: TIMESERIES_INTERVAL },
    json: TIMESERIES,
    count: 1,
  },
  {
    method: 'GET',
    path: TIMESERIES_PATH,
    query: { from: CUSTOM_FROM, to: EXPECTED_TO, interval: TIMESERIES_INTERVAL },
    json: CUSTOM_TIMESERIES,
    count: 1,
  },
]

/**
 * The three fixed operational requests, each declared exactly once. The array
 * parameter travels as the committed serializer's single comma-joined
 * `paymentStatus` value; the spec-local raw recorder re-proves that exact wire.
 */
const OPERATIONAL_ROUTES: readonly DeclaredRoute[] = [
  {
    method: 'GET',
    path: SALES_PATH,
    query: RECENT_SALES_QUERY,
    json: RECENT_SALES_RESPONSE,
    count: 1,
  },
  {
    method: 'GET',
    path: SALES_PATH,
    query: DEBT_SALES_QUERY,
    json: DEBT_SALES_RESPONSE,
    count: 1,
  },
  {
    method: 'GET',
    path: PENDING_REFUNDS_PATH,
    query: PENDING_REFUNDS_QUERY,
    json: PENDING_REFUNDS_RESPONSE,
    count: 1,
  },
]

/** Full authorized matrix surface: analytics plus the three operational modules. */
const ROUTES: readonly DeclaredRoute[] = [...ANALYTICS_ROUTES, ...OPERATIONAL_ROUTES]

/**
 * Wrapped in the fixture's object form on purpose: Playwright reads a plain
 * two-element array option value as a `[fixtureFn, options]` tuple, so a second
 * route entry would otherwise replace the option with the first route object.
 */
const DECLARED_ROUTES = { routes: ROUTES } as const

/** Analytics-only surface for the permission-denied case: no operational route exists. */
const ANALYTICS_ONLY_ROUTES = { routes: ANALYTICS_ROUTES } as const

interface RequestRecord {
  readonly method: string
  readonly path: string
  readonly query: Readonly<Record<string, string>>
}

const canonicalQuery = (query: Readonly<Record<string, string>>): string =>
  Object.keys(query)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&')

/**
 * Order-free identity of one request. The summary and the daily series are
 * independent concurrent queries, so BOTH arrival orders are correct and neither
 * may be baked into an assertion.
 */
const requestKey = (request: RequestRecord): string =>
  `${request.method} ${request.path}?${canonicalQuery(request.query)}`

/** Exact expected request multiset, compared without depending on arrival order. */
function expectExactRequests(
  actual: readonly RequestRecord[],
  expected: readonly RequestRecord[],
): void {
  expect(actual.map(requestKey).sort()).toEqual(expected.map(requestKey).sort())
  expect(actual).toHaveLength(expected.length)
}

/**
 * The complete documented query surface of every endpoint the surface may call.
 * A path may accept more than one documented shape (the recent and the debt sales
 * slots are deliberately different filters), and a request must match exactly one
 * of them: no undocumented key may ever cross the wire.
 */
const ALLOWED_QUERY_KEYS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  [SUMMARY_PATH]: [['from', 'to']],
  [TIMESERIES_PATH]: [['from', 'interval', 'to']],
  [SALES_PATH]: [
    ['limit', 'page', 'sortBy', 'sortOrder', 'status'],
    ['debtMin', 'limit', 'page', 'paymentStatus', 'sortBy', 'sortOrder', 'status'],
  ],
  [PENDING_REFUNDS_PATH]: [['limit', 'page']],
}

/**
 * No tenant/branch identity — or any other undocumented key — may ever cross the
 * wire: every endpoint resolves identity from the JWT. Each request's exact key
 * set must match one documented shape of its endpoint; the raw recorder proves
 * the repeated entries on top of this collapsed view.
 */
function expectDocumentedQuerySurface(requests: readonly RequestRecord[]): void {
  for (const request of requests) {
    const allowed = ALLOWED_QUERY_KEYS[request.path] ?? []
    expect(allowed.length, `undeclared endpoint path ${request.path}`).toBeGreaterThan(0)
    const keys = Object.keys(request.query).sort()
    expect(
      allowed.some((candidate) => candidate.join(',') === keys.join(',')),
      `${request.method} ${request.path}?${canonicalQuery(request.query)}`,
    ).toBe(true)
    expect(request.query).not.toHaveProperty('tenantId')
    expect(request.query).not.toHaveProperty('branchId')
  }
}

/** The two analytics queries of the initial current-month window. */
const INITIAL_ANALYTICS_REQUESTS: readonly RequestRecord[] = [
  { method: 'GET', path: SUMMARY_PATH, query: { from: EXPECTED_FROM, to: EXPECTED_TO } },
  {
    method: 'GET',
    path: TIMESERIES_PATH,
    query: { from: EXPECTED_FROM, to: EXPECTED_TO, interval: TIMESERIES_INTERVAL },
  },
]

/** The three fixed operational requests, each observed exactly once at mount. */
const INITIAL_OPERATIONAL_REQUESTS: readonly RequestRecord[] = [
  { method: 'GET', path: SALES_PATH, query: RECENT_SALES_QUERY },
  { method: 'GET', path: SALES_PATH, query: DEBT_SALES_QUERY },
  { method: 'GET', path: PENDING_REFUNDS_PATH, query: PENDING_REFUNDS_QUERY },
]

/**
 * Exact expected initial request multiset (order-free): the two analytics queries
 * plus one request per operational module, which never repeat afterwards.
 */
const INITIAL_REQUESTS: readonly RequestRecord[] = [
  ...INITIAL_ANALYTICS_REQUESTS,
  ...INITIAL_OPERATIONAL_REQUESTS,
]

/**
 * After the manual window edit ONLY the two analytics queries are added: the
 * operational modules keep their single initial request each.
 */
const CUSTOM_REQUESTS: readonly RequestRecord[] = [
  ...INITIAL_REQUESTS,
  { method: 'GET', path: SUMMARY_PATH, query: { from: CUSTOM_FROM, to: EXPECTED_TO } },
  {
    method: 'GET',
    path: TIMESERIES_PATH,
    query: { from: CUSTOM_FROM, to: EXPECTED_TO, interval: TIMESERIES_INTERVAL },
  },
]

/** One labelled card must be the only match in its section and render the formatted value. */
async function expectMetricCard(
  section: Locator,
  [label, value]: readonly [string, string],
): Promise<void> {
  const card = section.locator('dl > div').filter({ hasText: label })
  await expect(card).toHaveCount(1)
  await expect(card.locator('dd').first()).toContainText(value)
}

// ── OI-5B2 S4: operational panel and raw-wire helpers ────────────────────────

/** Exactly one panel, addressed by its committed `aria-labelledby` heading id. */
const operationalPanel = (page: Page, id: string): Locator =>
  page.locator(`[data-testid="${OPERATIONAL_PANEL_TESTID}"][aria-labelledby="${id}-heading"]`)

const mexicoCityInstantFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_CITY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Committed `America/Mexico_City` event label a loaded row must render. */
const instant = (iso: string): string => mexicoCityInstantFormatter.format(new Date(iso))

/** Committed UTC-midnight due-date label (`dd/mm/yyyy`), never shifted by the browser zone. */
const dueDateLabel = (iso: string): string => {
  const date = new Date(iso)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getUTCFullYear()}`
}

/**
 * RAW same-origin API request log, independent of the interception outcome. The
 * shared strict fixture reads `URLSearchParams` through `Object.fromEntries`, so a
 * page-level recorder is the surface that pins the exact DECODED wire — including
 * the single comma-joined `paymentStatus=PARTIAL,CREDIT` value — and, because it
 * records requests the browser issued even when they were aborted, it is also the
 * only instrument that can prove "zero operational requests" and "exactly one
 * operational request per module" without relying on the interception result.
 */
interface RawRequestEntry {
  readonly method: string
  readonly path: string
  readonly entries: readonly (readonly [string, string])[]
}

function recordRawRequests(page: Page): RawRequestEntry[] {
  const recorded: RawRequestEntry[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== RESPONSIVE_ORIGIN || !url.pathname.startsWith(API_PREFIX)) return
    recorded.push({
      method: request.method(),
      path: url.pathname.slice(API_PREFIX.length) || '/',
      entries: [...url.searchParams.entries()],
    })
  })
  return recorded
}

const OPERATIONAL_RAW_PATHS: readonly string[] = [SALES_PATH, PENDING_REFUNDS_PATH]

/** Order-free identity of one raw request, with every repeated entry retained. */
const rawRequestKey = (entry: RawRequestEntry): string =>
  `${entry.method} ${entry.path}?${entry.entries
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&')}`

/**
 * Exact raw operational wire multiset: three requests, one per fixed module. A
 * repeated operational request fails here even though the shared fixture would
 * also reject it, so "operational requests never repeat" is proven twice, from
 * two independent instruments.
 */
function expectExactOperationalRawRequests(recorded: readonly RawRequestEntry[]): void {
  const operational = recorded.filter((entry) => OPERATIONAL_RAW_PATHS.includes(entry.path))
  expect(operational.map(rawRequestKey).sort()).toEqual([...EXPECTED_OPERATIONAL_RAW_KEYS].sort())
  expect(operational, JSON.stringify(operational)).toHaveLength(
    EXPECTED_OPERATIONAL_RAW_KEYS.length,
  )
}

/**
 * The committed serializer joins the debt array into exactly ONE
 * `paymentStatus` value, so BOTH statuses must be present inside that single
 * value. Asserting the exact joined value is the faithful wire proof for the
 * array parameter (no bracketed or repeated entries exist to retain).
 */
function expectDebtPaymentStatusValues(recorded: readonly RawRequestEntry[]): void {
  const debtRequest = recorded.find(
    (entry) => entry.path === SALES_PATH && entry.entries.some(([key]) => key === 'paymentStatus'),
  )
  if (!debtRequest) throw new Error(`the debt ${SALES_PATH} request never reached the browser`)
  expect(
    debtRequest.entries.filter(([key]) => key === 'paymentStatus').map(([, value]) => value),
  ).toEqual(['PARTIAL,CREDIT'])
}

/**
 * No bracketed array key and no tenant/branch identity may ever reach the wire:
 * every endpoint resolves identity from the JWT and arrays are comma-joined under
 * their plain key. Checked on the RAW entries so a bracketed key cannot hide
 * behind the collapsed interception view.
 */
function expectNoBracketedOrIdentityKeys(recorded: readonly RawRequestEntry[]): void {
  for (const entry of recorded) {
    const keys = entry.entries.map(([key]) => key)
    const label = `${entry.method} ${entry.path} ${JSON.stringify(entry.entries)}`
    expect(keys, label).not.toContain('tenantId')
    expect(keys, label).not.toContain('branchId')
    expect(
      keys.filter((key) => key.includes('[') || key.includes(']')),
      `bracketed array key on the wire: ${label}`,
    ).toEqual([])
  }
}

/** Every committed panel renders its own level-2 heading exactly once. */
async function expectOperationalHeadings(page: Page): Promise<void> {
  for (const { id, title } of OPERATIONAL_PANELS) {
    await expect(
      operationalPanel(page, id).getByRole('heading', { level: 2, name: title }),
    ).toHaveCount(1)
  }
}

/**
 * One loaded sales panel: settled state, exactly one row, the amount that slot
 * owns (`debtCents` for debt, `totalCents` for recent), plain-text folio identity
 * and no link/button inside the row.
 */
async function expectLoadedSalePanel(
  page: Page,
  id: string,
  kind: 'recent' | 'debt',
  row: ConfirmedSaleRowWire,
): Promise<void> {
  const panel = operationalPanel(page, id)
  await expect(panel).toHaveCount(1)
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('aria-busy', 'false')

  const rows = panel.getByTestId(OPERATIONAL_LIST_TESTID).getByTestId(OPERATIONAL_SALE_ROW_TESTID)
  await expect(rows).toHaveCount(1)
  const rendered = rows.first()
  await expect(rendered).toContainText(`Folio ${row.folio}`)
  await expect(rendered).toContainText(row.customer?.name ?? 'Público en General')

  const amountCell = rendered.getByTestId('dashboard-sale-row-amount')
  const authoritative = kind === 'debt' ? row.debtCents : row.totalCents
  const otherAmount = kind === 'debt' ? row.totalCents : row.debtCents
  await expect(amountCell).toContainText(kind === 'debt' ? 'Deuda pendiente' : 'Venta confirmada')
  await expect(amountCell).toContainText(amount(authoritative))
  await expect(amountCell).not.toContainText(amount(otherAmount))

  if (kind === 'recent' && row.confirmedAt) {
    const confirmedAt = row.confirmedAt
    await expect(rendered.locator('time')).toHaveAttribute('datetime', confirmedAt)
    await expect(rendered.locator('time')).toHaveText(instant(confirmedAt))
  }
  if (kind === 'debt' && row.dueDate) {
    await expect(rendered).toContainText(`Vence ${dueDateLabel(row.dueDate)}`)
  }

  // Folio/customer identity stays plain text: no link or button inside a loaded row.
  await expect(rendered.locator('a, button, [role="link"], [role="button"]')).toHaveCount(0)
}

/**
 * The loaded pending-refund panel: one obligation rendered with the backend-owned
 * `outstandingCents` (never `amountCents`), its refund sale id as plain text and
 * no link/button inside the row.
 */
async function expectLoadedRefundPanel(page: Page, row: PendingRefundRowWire): Promise<void> {
  const panel = operationalPanel(page, 'dashboard-pending-refunds')
  await expect(panel).toHaveCount(1)
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('aria-busy', 'false')

  const rows = panel.getByTestId(OPERATIONAL_LIST_TESTID).getByTestId(OPERATIONAL_REFUND_ROW_TESTID)
  await expect(rows).toHaveCount(1)
  const rendered = rows.first()
  await expect(rendered).toContainText(`Venta ${row.saleId}`)
  await expect(rendered.locator('time')).toHaveAttribute('datetime', row.createdAt)
  await expect(rendered.locator('time')).toHaveText(instant(row.createdAt))
  await expect(rendered).toContainText(amount(row.outstandingCents))
  await expect(rendered).not.toContainText(amount(row.amountCents))
  await expect(rendered).toContainText('Efectivo')
  await expect(rendered).toContainText('Solicitud del cliente')
  await expect(rendered.locator('a, button, [role="link"], [role="button"]')).toHaveCount(0)
}

/** Seeds the committed color-mode preference before any app script runs on the page. */
async function seedColorMode(page: Page, mode: ColorMode): Promise<void> {
  await page.addInitScript(
    (entry: { key: string; value: string }) => {
      window.localStorage.setItem(entry.key, entry.value)
    },
    { key: COLOR_MODE_STORAGE_KEY, value: mode },
  )
}

interface RootThemeEvidence {
  readonly rootDarkClass: boolean
  readonly storedMode: string | null
}

/** Root theme state actually applied to the document after the app mounted. */
async function readRootTheme(page: Page): Promise<RootThemeEvidence> {
  return page.evaluate(
    (key) => ({
      rootDarkClass: document.documentElement.classList.contains('dark'),
      storedMode: window.localStorage.getItem(key),
    }),
    COLOR_MODE_STORAGE_KEY,
  )
}

interface RenderedBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Rejects a missing or zero-sized rendered block before any comparison. */
async function requireBox(locator: Locator, label: string): Promise<RenderedBox> {
  const box = await locator.boundingBox()
  if (!box || box.width <= 0 || box.height <= 0) {
    throw new Error(`${label} must render a positive bounding box; received ${JSON.stringify(box)}`)
  }
  return box
}

/** Rounded browser measurement recorded with the layout assertion. */
const rounded = (value: number): number => Math.round(value * 100) / 100

/** The upper block must end at or above the lower block's top edge. */
function expectAbove(upper: RenderedBox, lower: RenderedBox, label: string): void {
  const gap = upper.y + upper.height - lower.y
  expect(
    rounded(gap),
    `${label}: upper block overlaps the lower block (bottom-over-top gap ${gap}px)`,
  ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
}

/** Two blocks share a top row and the second sits to the right of the first. */
function expectSingleRow(left: RenderedBox, right: RenderedBox, label: string): void {
  const topDelta = rounded(Math.abs(left.y - right.y))
  const horizontalGap = rounded(right.x - (left.x + left.width))
  expect(
    topDelta,
    `${label}: blocks do not share a top row (Δtop ${topDelta}px)`,
  ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
  expect(
    horizontalGap,
    `${label}: second block is not to the right of the first (gap ${horizontalGap}px)`,
  ).toBeGreaterThanOrEqual(-LAYOUT_TOLERANCE_PX)
}

/** A block must use the full available container width, not a half-width column. */
function expectFullWidth(block: RenderedBox, container: RenderedBox, label: string): void {
  const widthDelta = rounded(Math.abs(block.width - container.width))
  expect(
    widthDelta,
    `${label}: width ${block.width}px must match the full container width ${container.width}px`,
  ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
}

/** Existing interaction target evidence: the control must remain at least 44px high. */
async function expectMinimumTargetHeight(locator: Locator, label: string): Promise<void> {
  const box = await requireBox(locator, label)
  expect(
    rounded(box.height),
    `${label}: measured ${box.height}px must meet the ${MIN_INTERACTION_TARGET_PX}px target height`,
  ).toBeGreaterThanOrEqual(MIN_INTERACTION_TARGET_PX)
}

interface ControlComputedStyle {
  readonly backgroundColor: string
  readonly color: string
  readonly focusVisible: boolean
  readonly outlineStyle: string
  readonly outlineWidth: string
  readonly outlineColor: string
  readonly boxShadow: string
}

/**
 * Browser-computed color, `:focus-visible` match and indicator properties.
 * Assertions compare these rendered values against each other, so no Coco
 * palette literal is repeated here.
 */
function readControlStyle(locator: Locator): Promise<ControlComputedStyle> {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    }
  })
}

/**
 * `toBeFocused()` requires `document.hasFocus()`, which headless Chromium does
 * not guarantee, so the active-element identity is asserted directly instead.
 */
function isActiveElement(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.ownerDocument.activeElement === element)
}

/** Compact description of the actually focused element, for actionable failures. */
function describeActiveElement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (!element) return '<none>'
    return [
      element.tagName.toLowerCase(),
      element.getAttribute('data-testid') && `testid=${element.getAttribute('data-testid')}`,
      element.getAttribute('data-preset-id') && `preset=${element.getAttribute('data-preset-id')}`,
      element.getAttribute('data-metric-key') &&
        `metric=${element.getAttribute('data-metric-key')}`,
      element.getAttribute('type') && `type=${element.getAttribute('type')}`,
    ]
      .filter(Boolean)
      .join(' ')
  })
}

/**
 * Headless Chromium does not grant the page window focus, and without it
 * `document.hasFocus()` is false. Bringing the page forward plus CDP focus
 * emulation gives it a focused-document state so `:focus-visible` can be
 * inspected without claiming sequential `Tab` traversal.
 */
async function prepareKeyboardFocus(page: Page): Promise<void> {
  await page.bringToFront()
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: true })
}

/**
 * Clears focus left over from pointer interaction, so the "no indicator at rest"
 * half of the focus contract is measured from a deterministic resting state.
 */
function blurActiveElement(page: Page): Promise<void> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (element instanceof HTMLElement) element.blur()
  })
}

/** Chromium extends `FocusOptions` with `focusVisible`; the DOM lib does not declare it. */
type KeyboardFocusOptions = FocusOptions & { readonly focusVisible: boolean }

/**
 * Requests focus with the browser's own keyboard-visibility signal. This
 * headless Chromium performs no sequential focus navigation for synthesized
 * `Tab` presses (the observed focus trail never leaves the `to` input) and the
 * application installs no `Tab` handler, so `focusVisible` requests exactly the
 * keyboard focus state the committed `focus-visible:` utilities target.
 */
function requestKeyboardFocus(locator: Locator): Promise<void> {
  return locator.evaluate((element) => {
    const focusOptions: KeyboardFocusOptions = { focusVisible: true }
    ;(element as HTMLElement).focus(focusOptions)
  })
}

/** Sequential-focus reachability contract of the rendered control. */
function readFocusReachability(
  locator: Locator,
): Promise<{ readonly tabIndex: number; readonly disabled: boolean }> {
  return locator.evaluate((element) => {
    const control = element as HTMLElement & { disabled?: boolean; tabIndex: number }
    return { tabIndex: control.tabIndex, disabled: control.disabled === true }
  })
}

/** Committed focus indicator strength: a `2px` outline or ring, never the resting `1px` ring. */
const FOCUS_INDICATOR_MIN_PX = 2

/** Every `px` length inside a computed `box-shadow`, normalized by the browser. */
function boxShadowWidths(boxShadow: string): readonly number[] {
  return [...boxShadow.matchAll(/(\d+(?:\.\d+)?)px/g)].map((match) => Number.parseFloat(match[1]!))
}

/** Rendered outline or ring strong enough to be the committed focus indicator. */
function rendersFocusIndicator(style: ControlComputedStyle): boolean {
  const outlineWidth = Number.parseFloat(style.outlineWidth)
  const hasOutline =
    style.outlineStyle !== 'none' &&
    Number.isFinite(outlineWidth) &&
    outlineWidth >= FOCUS_INDICATOR_MIN_PX
  const hasRing =
    style.boxShadow !== 'none' &&
    boxShadowWidths(style.boxShadow).some((width) => width >= FOCUS_INDICATOR_MIN_PX)
  return hasOutline || hasRing
}

/** The rendered indicator itself, so focus-driven change can be compared exactly. */
function focusIndicatorSignature(style: ControlComputedStyle): string {
  return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow].join('|')
}

/**
 * Keyboard-focus contract of one committed control: sequential-focus reachable,
 * no indicator at rest, `:focus-visible` after a keyboard focus request, and a
 * rendered indicator of at least 2px once focused.
 *
 * This does NOT claim real `Tab` traversal: this headless Chromium performs none
 * for synthesized presses, so the browser's own `focusVisible` focus signal is
 * requested instead.
 */
async function expectKeyboardFocusContract(
  page: Page,
  control: Locator,
  label: string,
): Promise<void> {
  const reachability = await readFocusReachability(control)
  expect(reachability.disabled, `${label} must be enabled`).toBe(false)
  expect(
    reachability.tabIndex,
    `${label} must be reachable by sequential keyboard focus`,
  ).toBeGreaterThanOrEqual(0)

  const beforeFocus = await readControlStyle(control)
  expect(beforeFocus.focusVisible, `${label} must not be :focus-visible before focus`).toBe(false)
  expect(
    rendersFocusIndicator(beforeFocus),
    `${label} must not show the focus indicator before focus`,
  ).toBe(false)

  await requestKeyboardFocus(control)
  expect(
    await isActiveElement(control),
    `${label} must become the focused element; active element is ${await describeActiveElement(page)}`,
  ).toBe(true)

  const afterFocus = await readControlStyle(control)
  expect(afterFocus.focusVisible, `${label} must match :focus-visible`).toBe(true)
  expect(
    focusIndicatorSignature(afterFocus),
    `${label} outline/ring must change on keyboard focus`,
  ).not.toBe(focusIndicatorSignature(beforeFocus))
  expect(rendersFocusIndicator(afterFocus), `${label} must render a visible focus indicator`).toBe(
    true,
  )
}

interface RenderedSeriesColors {
  readonly fills: readonly string[]
  readonly strokes: readonly string[]
}

/**
 * Computed paint of every SVG path in the chart region. `fill`/`stroke` hold the
 * RESOLVED color Unovis wrote, so an unresolved Coco variable or a missing
 * `.dark` override is observable here instead of assumed.
 */
async function readSeriesColors(chart: Locator): Promise<RenderedSeriesColors> {
  const entries = await chart.locator('svg path').evaluateAll((paths) =>
    paths.map((path) => {
      const style = window.getComputedStyle(path)
      return { fill: style.fill, stroke: style.stroke }
    }),
  )
  return {
    fills: entries.map((entry) => entry.fill),
    strokes: entries.map((entry) => entry.stroke),
  }
}

interface RenderedChartGeometry {
  /** Joined `d` of every rendered SVG path: the ACTUAL plotted geometry. */
  readonly paths: string
  /** Every rendered SVG text node, for the axis-label checks. */
  readonly texts: readonly string[]
}

/** Real rendered SVG geometry plus labels, read from the live DOM. */
async function readChartGeometry(chart: Locator): Promise<RenderedChartGeometry> {
  const [paths, texts] = await Promise.all([
    chart
      .locator('svg path')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d') ?? '')),
    // SVG `<text>` has no `innerText`, so `allTextContents()` (textContent) is the
    // only API that returns the rendered axis labels here.
    chart.locator('svg text').allTextContents(),
  ])
  return { paths: paths.join(' | '), texts }
}

/**
 * Numeric-only axis labels. The X axis renders calendar dates, which always
 * contain letters (`01 jun 2025`), so letter-free labels are the Y axis.
 */
function numericAxisLabels(texts: readonly string[]): number[] {
  return texts
    .filter((text) => !/[A-Za-z]/.test(text))
    .map((text) => Number.parseFloat(text.replace(/[^\d.]/g, '')))
    .filter((value) => Number.isFinite(value))
}

for (const viewport of MATRIX_VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`branch sales summary ${viewport.key} ${viewport.width}x${viewport.height} ${theme.mode}`, () => {
      test.use({ declaredRoutes: DECLARED_ROUTES, colorScheme: theme.mode })

      test(`renders the eight intercepted metrics and the daily trend in ${theme.mode} for the exact current-month window`, async ({
        page,
        strictNetwork,
      }) => {
        await page.setViewportSize(viewport)
        // Fixed clock before any app script: the view resolves one stable preset window.
        await page.clock.setFixedTime(FIXED_NOW_MS)
        await seedAuthSession(page, { permissions: [...OPERATIONAL_PERMISSIONS] })
        await seedColorMode(page, theme.mode)
        // RAW recorder attached before navigation so no wire entry can be missed.
        const rawRequests = recordRawRequests(page)

        await page.goto(`${RESPONSIVE_ORIGIN}${VIEW_PATH}`)

        // One H1 and the explicit inclusive/exclusive boundary contract.
        const heading = page.getByRole('heading', { level: 1, name: SUMMARY_H1 })
        await expect(heading).toHaveCount(1, { timeout: INITIAL_RENDER_TIMEOUT_MS })
        await expect(heading).toBeVisible()
        await expect(page.getByText(RANGE_HINT)).toBeVisible()
        await expect(page.getByTestId('branch-summary-from')).toHaveValue(EXPECTED_FROM)
        await expect(page.getByTestId('branch-summary-to')).toHaveValue(EXPECTED_TO)
        await expect(page.getByTestId('branch-summary-range')).toHaveText(
          `${EXPECTED_FROM} → ${EXPECTED_TO}`,
        )

        // The seeded preference resolved to the expected root theme state.
        await expect
          .poll(async () => (await readRootTheme(page)).rootDarkClass)
          .toBe(theme.expectsDarkRoot)
        const themeEvidence = await readRootTheme(page)
        expect(themeEvidence.storedMode, `seeded ${COLOR_MODE_STORAGE_KEY}`).toBe(theme.mode)

        // Rendered metrics prove the intercepted summary settled; then audit the wire exactly.
        await expect(page.getByTestId('branch-summary-metrics')).toBeVisible()
        // Exact window: 2025-06-15 in Mexico City -> [2025-06-01, 2025-06-16).
        expect([EXPECTED_FROM, EXPECTED_TO]).toEqual(['2025-06-01', '2025-06-16'])
        expect(METRIC_KEYS).toHaveLength(8)
        expect([...SALES_CARDS, ...REFUNDS_CARDS]).toHaveLength(8)

        // The rendered series proves the intercepted daily response settled too.
        const trend = page.getByTestId(TREND_TESTID)
        await expect(trend).toHaveCount(1)
        await expect(trend).toBeVisible({ timeout: INITIAL_RENDER_TIMEOUT_MS })
        const chart = page.getByTestId(TREND_CHART_TESTID)
        await expect(chart).toBeVisible()
        for (const testid of ABSENT_TREND_STATES) {
          await expect(page.getByTestId(testid)).toHaveCount(0)
        }

        // ── OI-5B2 S4: the three committed operational panels ────────────────
        const operationalGrid = page.getByTestId(OPERATIONAL_GRID_TESTID)
        await expect(operationalGrid).toHaveCount(1)
        await expect(operationalGrid).toBeVisible()
        await expect(operationalGrid.getByTestId(OPERATIONAL_SALE_ROW_TESTID)).toHaveCount(2, {
          timeout: INITIAL_RENDER_TIMEOUT_MS,
        })
        await expectOperationalHeadings(page)
        await expectLoadedSalePanel(page, 'dashboard-recent-sales', 'recent', RECENT_SALE_ROW)
        await expectLoadedSalePanel(page, 'dashboard-debt-sales', 'debt', DEBT_SALE_ROW)
        await expectLoadedRefundPanel(page, PENDING_REFUND_ROW)
        // The obligation amount is exactly the backend-derived difference; the UI
        // never recomputes it.
        expect(PENDING_REFUND_ROW.outstandingCents).toBe(
          PENDING_REFUND_ROW.amountCents - PENDING_REFUND_ROW.settledCents,
        )
        // One panel per module, one authoritative row per fixture, no aggregate.
        await expect(operationalGrid.getByTestId(OPERATIONAL_PANEL_TESTID)).toHaveCount(
          OPERATIONAL_PANELS.length,
        )
        await expect(operationalGrid.getByTestId(OPERATIONAL_SALE_ROW_TESTID)).toHaveCount(2)
        await expect(operationalGrid.getByTestId(OPERATIONAL_REFUND_ROW_TESTID)).toHaveCount(1)
        for (const testid of ABSENT_OPERATIONAL_STATES) {
          await expect(operationalGrid.getByTestId(testid)).toHaveCount(0)
        }
        // Committed DOM order: recent -> debt -> refund.
        expect(
          await operationalGrid
            .getByTestId(OPERATIONAL_PANEL_TESTID)
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-labelledby'))),
        ).toEqual(OPERATIONAL_PANELS.map(({ id }) => `${id}-heading`))

        // Every endpoint was called with its exact documented query surface and
        // nothing else, in either arrival order.
        expect(windowDayCount(EXPECTED_FROM, EXPECTED_TO)).toBe(15)
        expect(TIMESERIES.points).toHaveLength(15)
        expect(CUSTOM_TIMESERIES.points).toHaveLength(11)
        const requests = strictNetwork.requests()
        expectExactRequests(requests, INITIAL_REQUESTS)
        expectDocumentedQuerySurface(requests)
        // RAW wire proof, independent of the interception result: the exact
        // comma-joined debt value, no bracketed/identity keys, and each operational
        // request observed exactly once.
        expectExactOperationalRawRequests(rawRequests)
        expectDebtPaymentStatusValues(rawRequests)
        expectNoBracketedOrIdentityKeys(rawRequests)

        // Both labelled sections, the complete card inventory, and every formatted value.
        const sales = page.getByTestId('branch-summary-sales-section')
        const refunds = page.getByTestId('branch-summary-refunds-section')
        await expect(sales.getByRole('heading', { level: 2, name: SALES_HEADING })).toBeVisible()
        await expect(
          refunds.getByRole('heading', { level: 2, name: REFUNDS_HEADING }),
        ).toBeVisible()
        await expect(sales.getByTestId('branch-summary-kpi-card')).toHaveCount(5)
        await expect(sales.getByTestId('branch-summary-net-sales-hero')).toHaveCount(1)
        await expect(refunds.getByTestId('branch-summary-refund-card')).toHaveCount(2)
        await expect(sales.locator('dl > div')).toHaveCount(SALES_CARDS.length)
        await expect(refunds.locator('dl > div')).toHaveCount(REFUNDS_CARDS.length)
        for (const card of SALES_CARDS) await expectMetricCard(sales, card)
        for (const card of REFUNDS_CARDS) await expectMetricCard(refunds, card)

        // Non-color status cues for positive debt and positive pending refund obligations.
        await expect(page.getByTestId('branch-summary-debt-status')).toHaveText(DEBT_CUE)
        await expect(page.getByTestId('branch-summary-pending-refund-status')).toHaveText(
          PENDING_REFUND_CUE,
        )

        // No fatal, empty, idle or loading state survives the fulfilled response.
        for (const testid of ABSENT_STATES) await expect(page.getByTestId(testid)).toHaveCount(0)

        // No fabricated visualization of any kind on the loaded surface.
        for (const selector of ABSENT_VISUALIZATION_SELECTORS) {
          await expect(page.locator(selector)).toHaveCount(0)
        }

        // ── OI-5A: chart presence and theme-resolved Coco series colors ───────
        await expect(chart).toHaveCount(1)
        await expect(chart).toHaveAttribute('role', 'img')
        await expect(chart).toHaveAttribute(
          'aria-label',
          `Ventas netas por día del ${EXPECTED_FROM} al ${EXPECTED_TO} (Hasta excluyente)`,
        )
        await expect(chart.locator('svg')).toHaveCount(1)
        const seriesColors = await readSeriesColors(chart)
        expect(
          seriesColors.fills,
          `${theme.mode}: the area must be painted with the resolved ${theme.mode} Coco token`,
        ).toContain(SERIES_COLORS[theme.mode].areaFill)
        expect(
          seriesColors.strokes,
          `${theme.mode}: the line must be stroked with the resolved ${theme.mode} Coco token`,
        ).toContain(SERIES_COLORS[theme.mode].lineStroke)

        // ── OI-5A: metric selector semantics and 44px targets ────────────────
        const metricControls = trend.getByTestId(TREND_METRIC_TESTID)
        await expect(metricControls).toHaveCount(TREND_METRIC_KEYS.length)
        expect(
          await metricControls.evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('data-metric-key')),
          ),
        ).toEqual([...TREND_METRIC_KEYS])
        for (const [index, key] of TREND_METRIC_KEYS.entries()) {
          await expect(metricControls.nth(index)).toHaveAttribute(
            'aria-pressed',
            key === DEFAULT_METRIC_KEY ? 'true' : 'false',
          )
          await expectMinimumTargetHeight(metricControls.nth(index), `trend metric ${key}`)
        }
        await expect(
          trend.locator(`[data-testid="${TREND_METRIC_TESTID}"][aria-pressed="true"]`),
        ).toHaveCount(1)

        // ── OI-5A: keyboard-reachable semantic table with exact backend values ─
        const tableSummary = trend.getByTestId(TREND_TABLE_SUMMARY_TESTID)
        await expect(tableSummary).toHaveCount(1)
        await expectMinimumTargetHeight(tableSummary, 'trend table disclosure')
        // Opening the native disclosure puts the exact backend values on screen.
        await tableSummary.click()

        const table = trend.getByTestId(TREND_TABLE_TESTID)
        await expect(table).toBeVisible()
        const expectedPoints = TIMESERIES.points
        const zeroFilledIndex = expectedPoints.findIndex((point) => point.netSalesCents === 0)
        expect(
          zeroFilledIndex,
          'the intercepted series must contain a zero-filled day',
        ).toBeGreaterThanOrEqual(0)

        await expect(table.locator('thead th')).toHaveCount(2)
        await expect(table.locator('thead th').nth(0)).toHaveText('Fecha')
        await expect(table.locator('thead th').nth(1)).toHaveText('Ventas netas')
        await expect(table.locator('caption')).toContainText(EXPECTED_FROM)
        await expect(table.locator('caption')).toContainText(EXPECTED_TO)
        await expect(table.locator('tbody tr')).toHaveCount(expectedPoints.length)

        const renderedDates = await table.locator('tbody th[scope="row"]').allInnerTexts()
        expect(renderedDates).toEqual(expectedPoints.map((point) => point.date))
        const renderedValues = await table.locator('tbody td').allInnerTexts()
        expect(renderedValues).toEqual(expectedPoints.map((point) => amount(point.netSalesCents)))
        // The zero-filled bucket stays visible instead of being dropped or filled.
        expect(renderedValues[zeroFilledIndex]).toBe(amount(0))

        // ── OI-5A: switching the metric changes only the 1:1 accessor ─────────
        // Capture REAL rendered geometry and the Y-axis labels first: the switch
        // must change Unovis output, not just the table and the button state.
        const netSalesGeometry = await readChartGeometry(chart)
        expect(
          netSalesGeometry.paths.length,
          'the chart must render real SVG path geometry',
        ).toBeGreaterThan(0)
        const netSalesYLabels = numericAxisLabels(netSalesGeometry.texts)
        // Net sales is scaled in CENTS, so `1_000_000` renders as `$10,000.00`: the
        // Y labels are MXN amounts in the tens of thousands, never raw cents.
        expect(
          netSalesYLabels.some((value) => value >= 10_000),
          `net-sales Y labels: ${JSON.stringify(netSalesGeometry.texts)}`,
        ).toBe(true)
        expect(netSalesGeometry.texts.join(' ')).toContain('$')

        const saleCountControl = trend.locator(
          `[data-testid="${TREND_METRIC_TESTID}"][data-metric-key="saleCount"]`,
        )
        await saleCountControl.click()
        await expect(saleCountControl).toHaveAttribute('aria-pressed', 'true')
        await expect(
          trend.locator(`[data-testid="${TREND_METRIC_TESTID}"][aria-pressed="true"]`),
        ).toHaveCount(1)
        await expect(table.locator('thead th').nth(1)).toHaveText('Cantidad de ventas')
        const countValues = await table.locator('tbody td').allInnerTexts()
        expect(countValues).toEqual(expectedPoints.map((point) => counter.format(point.saleCount)))
        expect(countValues.join(' ')).not.toContain('$')
        // A metric switch is not a reorder: backend bucket order is unchanged.
        expect(await table.locator('tbody th[scope="row"]').allInnerTexts()).toEqual(renderedDates)

        // Actual rendered SVG geometry must change. The two metrics are
        // deliberately non-proportional, so a re-rendered series cannot
        // coincidentally reproduce the previous path.
        await expect
          .poll(async () => (await readChartGeometry(chart)).paths)
          .not.toBe(netSalesGeometry.paths)

        const countGeometry = await readChartGeometry(chart)
        // Y-accessor-driven SVG output follows the metric: the MXN labels are gone
        // and the Y scale domain was RECOMPUTED to the count range. A stale cents
        // domain would still label values in the hundreds of thousands.
        expect(countGeometry.texts.join(' ')).not.toContain('$')
        const countYLabels = numericAxisLabels(countGeometry.texts)
        expect(
          countYLabels.length,
          `sale-count Y labels: ${JSON.stringify(countGeometry.texts)}`,
        ).toBeGreaterThan(0)
        expect(
          Math.max(...countYLabels),
          `sale-count Y labels must stay in the count range: ${JSON.stringify(countGeometry.texts)}`,
        ).toBeLessThanOrEqual(Math.max(...expectedPoints.map((point) => point.saleCount)))
        expect(countGeometry.paths).not.toBe(netSalesGeometry.paths)

        await trend
          .locator(
            `[data-testid="${TREND_METRIC_TESTID}"][data-metric-key="${DEFAULT_METRIC_KEY}"]`,
          )
          .click()
        await expect(chart).toHaveAttribute(
          'aria-label',
          `Ventas netas por día del ${EXPECTED_FROM} al ${EXPECTED_TO} (Hasta excluyente)`,
        )
        // The round trip restores both the MXN axis labels and the original geometry.
        await expect
          .poll(async () => (await readChartGeometry(chart)).texts.join(' '))
          .toContain('$')
        await expect
          .poll(async () => (await readChartGeometry(chart)).paths)
          .toBe(netSalesGeometry.paths)

        // Exactly one filters panel owns the boundary and preset controls.
        const filters = page.getByTestId('branch-summary-filters')
        await expect(filters).toHaveCount(1)
        await expectMinimumTargetHeight(
          filters.getByTestId('branch-summary-from'),
          'from date input',
        )
        await expectMinimumTargetHeight(filters.getByTestId('branch-summary-to'), 'to date input')
        const presets = filters.getByTestId('branch-summary-preset')
        await expect(presets).toHaveCount(PRESET_LABELS.length)
        await expect(presets).toHaveText([...PRESET_LABELS])
        for (const [index] of PRESET_LABELS.entries()) {
          await expectMinimumTargetHeight(presets.nth(index), `preset control ${index}`)
        }

        // Selected-preset semantics: `Este mes` is pressed and every sibling is not.
        await expect(presets.nth(SELECTED_PRESET_INDEX)).toHaveAttribute('aria-pressed', 'true')
        for (const index of PRESET_LABELS.keys()) {
          if (index === SELECTED_PRESET_INDEX) continue
          await expect(presets.nth(index)).toHaveAttribute('aria-pressed', 'false')
        }

        // Rendered hierarchy proof: single-column reading order below `lg`, shared
        // top row at `lg`, with the secondary grids full width beneath the overview.
        const overview = await requireBox(
          page.getByTestId('branch-summary-sales-overview'),
          'sales overview row',
        )
        const hero = await requireBox(
          page.getByTestId('branch-summary-net-sales-hero'),
          'net-sales hero',
        )
        const controls = await requireBox(
          page.getByTestId('branch-summary-controls'),
          'controls panel',
        )
        const salesKpis = await requireBox(
          page.getByTestId('branch-summary-sales-kpis'),
          'secondary sales KPI grid',
        )
        const refundsSection = await requireBox(
          page.getByTestId('branch-summary-refunds-section'),
          'refunds section',
        )
        const salesSection = await requireBox(
          page.getByTestId('branch-summary-sales-section'),
          'sales section',
        )

        if (viewport.width >= LAYOUT_WIDE_MIN_WIDTH_PX) {
          expectSingleRow(hero, controls, `${viewport.key} overview`)
          expect(
            rounded(hero.width),
            `${viewport.key}: hero must occupy one half-width column of the two-column overview`,
          ).toBeLessThan(overview.width - LAYOUT_TOLERANCE_PX)
        } else {
          expectAbove(controls, hero, `${viewport.key} overview`)
        }
        expectAbove(overview, salesKpis, `${viewport.key} secondary sales KPIs`)
        expectAbove(salesSection, refundsSection, `${viewport.key} refunds`)
        expectFullWidth(salesKpis, overview, `${viewport.key} secondary sales KPIs`)
        expectFullWidth(refundsSection, overview, `${viewport.key} refunds`)

        // OI-5A: the trend is a full-width sibling BELOW the summary block inside
        // the same card, and the card still contains it.
        const trendBox = await requireBox(trend, 'daily trend section')
        expectAbove(refundsSection, trendBox, `${viewport.key} trend below refunds`)
        expectFullWidth(trendBox, salesSection, `${viewport.key} trend width`)

        // ── OI-5B2 S4: operational grid after the trend, full width, 1 or 3 cols ─
        const gridBox = await requireBox(operationalGrid, 'operational grid')
        const recentPanelBox = await requireBox(
          operationalPanel(page, 'dashboard-recent-sales'),
          'recent sales panel',
        )
        const debtPanelBox = await requireBox(
          operationalPanel(page, 'dashboard-debt-sales'),
          'debt sales panel',
        )
        const refundPanelBox = await requireBox(
          operationalPanel(page, 'dashboard-pending-refunds'),
          'pending refunds panel',
        )
        expectAbove(trendBox, gridBox, `${viewport.key} operational grid below the trend`)
        expectFullWidth(gridBox, salesSection, `${viewport.key} operational grid width`)
        if (viewport.width >= LAYOUT_WIDE_MIN_WIDTH_PX) {
          // Three equal columns on one row at `lg` and above.
          expectSingleRow(recentPanelBox, debtPanelBox, `${viewport.key} operational row`)
          expectSingleRow(debtPanelBox, refundPanelBox, `${viewport.key} operational row`)
          expect(
            rounded(Math.abs(recentPanelBox.width - debtPanelBox.width)),
            `${viewport.key}: a three-column row keeps equal panel widths`,
          ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
          expect(
            rounded(Math.abs(debtPanelBox.width - refundPanelBox.width)),
            `${viewport.key}: a three-column row keeps equal panel widths`,
          ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
          expect(
            recentPanelBox.width,
            `${viewport.key}: each panel of a three-column row stays narrower than the grid`,
          ).toBeLessThan(gridBox.width - LAYOUT_TOLERANCE_PX)
        } else {
          // One ordered column below `lg`: recent -> debt -> refund, same edge.
          expectAbove(recentPanelBox, debtPanelBox, `${viewport.key} operational order 1`)
          expectAbove(debtPanelBox, refundPanelBox, `${viewport.key} operational order 2`)
          expect(
            rounded(Math.abs(recentPanelBox.x - debtPanelBox.x)),
            `${viewport.key}: stacked operational panels share one column edge`,
          ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
          expect(
            rounded(Math.abs(recentPanelBox.width - debtPanelBox.width)),
            `${viewport.key}: stacked operational panels share one column width`,
          ).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX)
        }

        // Explicit geometry evidence for this configured project viewport. The
        // shared `ViewportCase` type pins the four committed policy widths, so the
        // local wide reference asserts the same direct inner measurements rather
        // than widening a shared target type.
        const sharedViewport = RESPONSIVE_VIEWPORTS.find((entry) => entry.key === viewport.key)
        if (sharedViewport) {
          const viewportEvidence = await assertExactViewport(page, sharedViewport)
          expect(viewportEvidence.measurements.innerWidth).toBe(viewport.width)
          expect(viewportEvidence.measurements.innerHeight).toBe(viewport.height)
          expect(viewportEvidence.status, JSON.stringify(viewportEvidence.measurements)).toBe(
            'pass',
          )
        } else {
          const measured = await page.evaluate(() => ({
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
          }))
          expect(measured.innerWidth, JSON.stringify(measured)).toBe(viewport.width)
          expect(measured.innerHeight, JSON.stringify(measured)).toBe(viewport.height)
        }
        const overflowEvidence = await assertDocumentNoHorizontalOverflow(page)
        expect(overflowEvidence.status, JSON.stringify(overflowEvidence.measurements)).toBe('pass')

        // ── Selected/unselected appearance: rendered values, not class tokens ──
        const selectedPresetStyle = await readControlStyle(presets.nth(SELECTED_PRESET_INDEX))
        const unselectedPresetStyle = await readControlStyle(presets.nth(0))
        expect(
          selectedPresetStyle.backgroundColor,
          'selected preset background must differ from an unselected preset',
        ).not.toBe(unselectedPresetStyle.backgroundColor)
        expect(
          selectedPresetStyle.color,
          'selected preset text color must differ from an unselected preset',
        ).not.toBe(unselectedPresetStyle.color)
        expect(
          selectedPresetStyle.boxShadow,
          'selected preset ring must differ from an unselected preset',
        ).not.toBe(unselectedPresetStyle.boxShadow)

        // The selected trend metric must be visually distinguishable too.
        const selectedMetricStyle = await readControlStyle(
          metricControls.nth(TREND_METRIC_KEYS.indexOf(DEFAULT_METRIC_KEY)),
        )
        const unselectedMetricStyle = await readControlStyle(metricControls.nth(1))
        expect(
          selectedMetricStyle.backgroundColor,
          'selected trend metric must differ from an unselected one',
        ).not.toBe(unselectedMetricStyle.backgroundColor)
        expect(
          selectedMetricStyle.color,
          'selected trend metric text color must differ from an unselected one',
        ).not.toBe(unselectedMetricStyle.color)

        // ── Keyboard focus: a visible rendered indicator on every variant ──────
        await prepareKeyboardFocus(page)
        await blurActiveElement(page)
        for (const index of [0, SELECTED_PRESET_INDEX]) {
          await expectKeyboardFocusContract(page, presets.nth(index), `preset ${index}`)
        }
        // The new OI-5A controls declare the same keyboard-focus contract.
        await expectKeyboardFocusContract(
          page,
          trend.locator(
            `[data-testid="${TREND_METRIC_TESTID}"][data-metric-key="${DEFAULT_METRIC_KEY}"]`,
          ),
          'trend metric control',
        )
        await expectKeyboardFocusContract(page, tableSummary, 'trend table disclosure')

        // ── Manual custom-date edit: exact updated requests, preset cleared ────
        await filters.getByTestId('branch-summary-from').fill(CUSTOM_FROM)
        await expect(page.getByTestId('branch-summary-range')).toHaveText(
          `${CUSTOM_FROM} → ${EXPECTED_TO}`,
        )
        await expect(filters.getByTestId('branch-summary-from')).toHaveValue(CUSTOM_FROM)
        await expect(filters.getByTestId('branch-summary-to')).toHaveValue(EXPECTED_TO)
        for (const index of PRESET_LABELS.keys()) {
          await expect(presets.nth(index)).toHaveAttribute('aria-pressed', 'false')
        }
        await expect(page.getByTestId('branch-summary-validation')).toHaveCount(0)
        await expectMetricCard(sales, ['Ventas netas', amount(CUSTOM_SUMMARY.netSalesCents)])

        // The daily series follows the SAME edited window, with its own response.
        const customPoints = CUSTOM_TIMESERIES.points
        await expect(chart).toHaveAttribute(
          'aria-label',
          `Ventas netas por día del ${CUSTOM_FROM} al ${EXPECTED_TO} (Hasta excluyente)`,
        )
        await expect(table.locator('tbody tr')).toHaveCount(customPoints.length)
        expect(await table.locator('tbody td').allInnerTexts()).toEqual(
          customPoints.map((point) => amount(point.netSalesCents)),
        )
        expect(await table.locator('tbody th[scope="row"]').allInnerTexts()).toEqual(
          customPoints.map((point) => point.date),
        )

        const editedRequests = strictNetwork.requests()
        expectExactRequests(editedRequests, CUSTOM_REQUESTS)
        expectDocumentedQuerySurface(editedRequests)
        // The window edit adds ONLY the two analytics queries: the operational
        // modules never re-query, proven from the raw browser log.
        expectExactOperationalRawRequests(rawRequests)
        expectDebtPaymentStatusValues(rawRequests)
        expectNoBracketedOrIdentityKeys(rawRequests)

        expect(strictNetwork.violations()).toEqual([])
      })
    })
  }
}

// ── OI-5B2 S4: permission-denied operational modules ─────────────────────────

/**
 * Analytics-only identity: the shared analytics routes are declared and the two
 * operational modules are NOT. Any operational request would therefore be aborted
 * as undeclared AND captured by the raw recorder, so "zero operational requests"
 * is proven from both instruments independently.
 */
test.describe('branch sales summary permission denied 1024x768 light', () => {
  test.use({ declaredRoutes: ANALYTICS_ONLY_ROUTES, colorScheme: 'light' })

  test('renders no operational module and issues no operational request without read:Sale and read:SaleRefund', async ({
    page,
    strictNetwork,
  }) => {
    await page.setViewportSize({
      width: 1024,
      height: 768,
    })
    await page.clock.setFixedTime(FIXED_NOW_MS)
    await seedAuthSession(page, { permissions: [...ANALYTICS_ONLY_PERMISSIONS] })
    await seedColorMode(page, 'light')
    const rawRequests = recordRawRequests(page)

    await page.goto(`${RESPONSIVE_ORIGIN}${VIEW_PATH}`)

    // The analytics surface itself is fully loaded: the negative proof is not a
    // page that simply failed to render.
    const heading = page.getByRole('heading', { level: 1, name: SUMMARY_H1 })
    await expect(heading).toHaveCount(1, { timeout: INITIAL_RENDER_TIMEOUT_MS })
    await expect(page.getByTestId('branch-summary-metrics')).toBeVisible()
    await expect(page.getByTestId(TREND_TESTID)).toBeVisible({ timeout: INITIAL_RENDER_TIMEOUT_MS })
    expect((await readRootTheme(page)).rootDarkClass).toBe(false)

    // Zero operational DOM: no grid, no panel, no heading, no row of either kind.
    await expect(page.getByTestId(OPERATIONAL_GRID_TESTID)).toHaveCount(0)
    await expect(page.getByTestId(OPERATIONAL_PANEL_TESTID)).toHaveCount(0)
    await expect(page.getByTestId(OPERATIONAL_LIST_TESTID)).toHaveCount(0)
    await expect(page.getByTestId(OPERATIONAL_SALE_ROW_TESTID)).toHaveCount(0)
    await expect(page.getByTestId(OPERATIONAL_REFUND_ROW_TESTID)).toHaveCount(0)
    for (const { id, title } of OPERATIONAL_PANELS) {
      await expect(operationalPanel(page, id)).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 2, name: title })).toHaveCount(0)
    }

    // Zero operational requests, proven from the RAW browser log rather than from
    // the interception outcome alone.
    expect(
      rawRequests.filter((entry) => OPERATIONAL_RAW_PATHS.includes(entry.path)),
      JSON.stringify(rawRequests),
    ).toEqual([])

    // Exactly the two analytics queries, with their documented surface only.
    const requests = strictNetwork.requests()
    expectExactRequests(requests, INITIAL_ANALYTICS_REQUESTS)
    expectDocumentedQuerySurface(requests)
    expect(strictNetwork.violations()).toEqual([])
  })
})
