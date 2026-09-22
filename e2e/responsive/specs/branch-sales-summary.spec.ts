/**
 * A5 intercepted responsive evidence for the branch sales summary surface
 * (`/analytics/resumen-ventas`).
 *
 * Standalone on purpose: it declares only the strict `/__e2e-api` surface the
 * view really uses, pins the browser clock so the deterministic last-seven-days
 * `[from, to)` window cannot drift across midnight in `America/Mexico_City`, and
 * records explicit document geometry for every configured matrix viewport.
 */
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute } from '../fixtures/network'
import type { Locator } from '@playwright/test'
import { RESPONSIVE_VIEWPORTS } from '../targets/types'
import { assertDocumentNoHorizontalOverflow, assertExactViewport } from '../assertions/geometry'

const VIEW_PATH = '/analytics/resumen-ventas'
const SUMMARY_PATH = '/analytics/sales/summary'
const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City'
const SUMMARY_H1 = 'Resumen de ventas'
const RANGE_HINT = 'El rango incluye el día «Desde» y excluye el día «Hasta».'
const SALES_HEADING = 'Ventas'
const REFUNDS_HEADING = 'Reembolsos'
const DEBT_CUE = 'Con deuda pendiente'
const PENDING_REFUND_CUE = 'Reembolsos pendientes'

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

const TODAY = mexicoCityCalendarDate(FIXED_NOW_MS)
/** The view's committed initial preset is `last7Days`: `[today - 6, today + 1)`. */
const EXPECTED_FROM = shiftCalendarDays(TODAY, -6)
const EXPECTED_TO = shiftCalendarDays(TODAY, 1)

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

const ROUTES: readonly DeclaredRoute[] = [
  {
    method: 'GET',
    path: SUMMARY_PATH,
    query: { from: EXPECTED_FROM, to: EXPECTED_TO },
    json: SUMMARY,
    count: 1,
  },
]

/** The exact request the transport may emit: two calendar boundaries, nothing else. */
const EXPECTED_REQUEST = {
  method: 'GET',
  path: SUMMARY_PATH,
  query: { from: EXPECTED_FROM, to: EXPECTED_TO },
  body: undefined,
}

/** One labelled card must be the only match in its section and render the formatted value. */
async function expectMetricCard(
  section: Locator,
  [label, value]: readonly [string, string],
): Promise<void> {
  const card = section.locator('dl > div').filter({ hasText: label })
  await expect(card).toHaveCount(1)
  await expect(card.locator('dd').first()).toContainText(value)
}

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test.describe(`branch sales summary ${viewport.key} ${viewport.width}x${viewport.height}`, () => {
    test.use({ declaredRoutes: ROUTES })

    test('renders the eight intercepted metrics for the exact last-seven-days window', async ({
      page,
      strictNetwork,
    }) => {
      await page.setViewportSize(viewport)
      // Fixed clock before any app script: the view resolves one stable preset window.
      await page.clock.setFixedTime(FIXED_NOW_MS)
      await seedAuthSession(page, { permissions: ['read:Analytics'] })

      await page.goto(`${RESPONSIVE_ORIGIN}${VIEW_PATH}`)

      // One H1 and the explicit inclusive/exclusive boundary contract.
      const heading = page.getByRole('heading', { level: 1, name: SUMMARY_H1 })
      await expect(heading).toHaveCount(1)
      await expect(heading).toBeVisible()
      await expect(page.getByText(RANGE_HINT)).toBeVisible()
      await expect(page.getByTestId('branch-summary-from')).toHaveValue(EXPECTED_FROM)
      await expect(page.getByTestId('branch-summary-to')).toHaveValue(EXPECTED_TO)
      await expect(page.getByTestId('branch-summary-range')).toHaveText(
        `${EXPECTED_FROM} → ${EXPECTED_TO}`,
      )

      // Rendered metrics prove the intercepted response settled; then audit the wire exactly.
      await expect(page.getByTestId('branch-summary-metrics')).toBeVisible()
      // Exact window: 2025-06-15 in Mexico City -> [2025-06-09, 2025-06-16).
      expect([EXPECTED_FROM, EXPECTED_TO]).toEqual(['2025-06-09', '2025-06-16'])
      expect(METRIC_KEYS).toHaveLength(8)
      expect([...SALES_CARDS, ...REFUNDS_CARDS]).toHaveLength(8)
      expect(strictNetwork.requests()).toEqual([EXPECTED_REQUEST])

      // Both labelled sections, the complete card inventory, and every formatted value.
      const sales = page.getByTestId('branch-summary-sales-section')
      const refunds = page.getByTestId('branch-summary-refunds-section')
      await expect(sales.getByRole('heading', { level: 2, name: SALES_HEADING })).toBeVisible()
      await expect(refunds.getByRole('heading', { level: 2, name: REFUNDS_HEADING })).toBeVisible()
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

      // Explicit geometry evidence for this configured project viewport.
      const viewportEvidence = await assertExactViewport(page, viewport)
      const overflowEvidence = await assertDocumentNoHorizontalOverflow(page)
      expect(viewportEvidence.measurements.innerWidth).toBe(viewport.width)
      expect(viewportEvidence.measurements.innerHeight).toBe(viewport.height)
      expect(viewportEvidence.status, JSON.stringify(viewportEvidence.measurements)).toBe('pass')
      expect(overflowEvidence.status, JSON.stringify(overflowEvidence.measurements)).toBe('pass')

      expect(strictNetwork.violations()).toEqual([])
    })
  })
}
