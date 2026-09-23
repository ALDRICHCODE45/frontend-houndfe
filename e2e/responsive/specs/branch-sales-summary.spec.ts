/**
 * A5 intercepted responsive evidence for the branch sales summary surface,
 * routed at the canonical `/dashboard` destination (ODD dashboard-analytics D1).
 *
 * Standalone on purpose: it declares only the strict `/__e2e-api` surface the
 * view really uses, pins the browser clock so the deterministic current-month
 * `[from, to)` window cannot drift across midnight in `America/Mexico_City`,
 * seeds the committed `vueuse-color-mode` preference so both light and dark
 * resolve deterministically for every matrix viewport, and records explicit
 * document geometry plus the rendered responsive hierarchy proof.
 *
 * `/dashboard` is the only authorized route under test. `/` and
 * `/analytics/resumen-ventas` are not application routes any more; the focused
 * router unit suite (not this spec) owns that negative proof.
 */
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute } from '../fixtures/network'
import type { Locator, Page } from '@playwright/test'
import { RESPONSIVE_VIEWPORTS } from '../targets/types'
import { assertDocumentNoHorizontalOverflow, assertExactViewport } from '../assertions/geometry'

const VIEW_PATH = '/dashboard'
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
 * No chart, progress, trend, comparison or derived aggregate visualization may
 * exist: the committed surface renders the eight backend metrics verbatim and
 * fabricates no series, target or computed delta.
 */
const ABSENT_VISUALIZATION_SELECTORS = [
  'canvas',
  'progress',
  '[role="progressbar"]',
  '[role="meter"]',
  '[data-testid*="chart"]',
  '[data-testid*="sparkline"]',
  '[data-testid*="trend"]',
  '[data-testid*="comparison"]',
  '[data-testid*="derived"]',
] as const

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

const ROUTES: readonly DeclaredRoute[] = [
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
]

/**
 * Wrapped in the fixture's object form on purpose: Playwright reads a plain
 * two-element array option value as a `[fixtureFn, options]` tuple, so a second
 * route entry would otherwise replace the option with the first route object.
 */
const DECLARED_ROUTES = { routes: ROUTES } as const

/** The exact request the transport may emit: two calendar boundaries, nothing else. */
const EXPECTED_REQUEST = {
  method: 'GET',
  path: SUMMARY_PATH,
  query: { from: EXPECTED_FROM, to: EXPECTED_TO },
  body: undefined,
}

/** Exact second request a manual `from` edit must produce: only `from` moved. */
const CUSTOM_REQUEST = {
  method: 'GET',
  path: SUMMARY_PATH,
  query: { from: CUSTOM_FROM, to: EXPECTED_TO },
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

interface PresetComputedStyle {
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
function readPresetStyle(locator: Locator): Promise<PresetComputedStyle> {
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
    ;(element as HTMLElement).focus({ focusVisible: true } satisfies KeyboardFocusOptions)
  })
}

/** Sequential-focus reachability contract of the rendered control. */
function readFocusReachability(
  locator: Locator,
): Promise<{ readonly tabIndex: number; readonly disabled: boolean }> {
  return locator.evaluate((element) => {
    const button = element as HTMLButtonElement
    return { tabIndex: button.tabIndex, disabled: button.disabled }
  })
}

/** Committed focus indicator strength: a `2px` outline or ring, never the resting `1px` ring. */
const FOCUS_INDICATOR_MIN_PX = 2

/** Every `px` length inside a computed `box-shadow`, normalized by the browser. */
function boxShadowWidths(boxShadow: string): readonly number[] {
  return [...boxShadow.matchAll(/(\d+(?:\.\d+)?)px/g)].map((match) => Number.parseFloat(match[1]!))
}

/** Rendered outline or ring strong enough to be the committed focus indicator. */
function rendersFocusIndicator(style: PresetComputedStyle): boolean {
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
function focusIndicatorSignature(style: PresetComputedStyle): string {
  return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow].join('|')
}

for (const viewport of RESPONSIVE_VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`branch sales summary ${viewport.key} ${viewport.width}x${viewport.height} ${theme.mode}`, () => {
      test.use({ declaredRoutes: DECLARED_ROUTES, colorScheme: theme.mode })

      test(`renders the eight intercepted metrics in ${theme.mode} for the exact current-month window`, async ({
        page,
        strictNetwork,
      }) => {
        await page.setViewportSize(viewport)
        // Fixed clock before any app script: the view resolves one stable preset window.
        await page.clock.setFixedTime(FIXED_NOW_MS)
        await seedAuthSession(page, { permissions: ['read:Analytics'] })
        await seedColorMode(page, theme.mode)

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

        // Rendered metrics prove the intercepted response settled; then audit the wire exactly.
        await expect(page.getByTestId('branch-summary-metrics')).toBeVisible()
        // Exact window: 2025-06-15 in Mexico City -> [2025-06-01, 2025-06-16).
        expect([EXPECTED_FROM, EXPECTED_TO]).toEqual(['2025-06-01', '2025-06-16'])
        expect(METRIC_KEYS).toHaveLength(8)
        expect([...SALES_CARDS, ...REFUNDS_CARDS]).toHaveLength(8)
        // Strict two-parameter request proof: exactly `from` and `to`, no extras.
        expect(Object.keys(EXPECTED_REQUEST.query)).toHaveLength(2)
        const requests = strictNetwork.requests()
        expect(requests).toEqual([EXPECTED_REQUEST])
        expect(Object.keys(requests[0]!.query).sort()).toEqual(['from', 'to'])

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

        // Explicit geometry evidence for this configured project viewport.
        const viewportEvidence = await assertExactViewport(page, viewport)
        const overflowEvidence = await assertDocumentNoHorizontalOverflow(page)
        expect(viewportEvidence.measurements.innerWidth).toBe(viewport.width)
        expect(viewportEvidence.measurements.innerHeight).toBe(viewport.height)
        expect(viewportEvidence.status, JSON.stringify(viewportEvidence.measurements)).toBe('pass')
        expect(overflowEvidence.status, JSON.stringify(overflowEvidence.measurements)).toBe('pass')

        // ── Selected/unselected appearance: rendered values, not class tokens ──
        const selectedPresetStyle = await readPresetStyle(presets.nth(SELECTED_PRESET_INDEX))
        const unselectedPresetStyle = await readPresetStyle(presets.nth(0))
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

        // ── Keyboard focus: a visible rendered indicator on both variants ──────
        await prepareKeyboardFocus(page)
        for (const index of [0, SELECTED_PRESET_INDEX]) {
          const preset = presets.nth(index)
          const reachability = await readFocusReachability(preset)
          expect(reachability.disabled, `preset ${index} must be enabled`).toBe(false)
          expect(
            reachability.tabIndex,
            `preset ${index} must be reachable by sequential keyboard focus`,
          ).toBeGreaterThanOrEqual(0)

          const beforeFocus = await readPresetStyle(preset)
          expect(
            beforeFocus.focusVisible,
            `preset ${index} must not be :focus-visible before focus`,
          ).toBe(false)
          expect(
            rendersFocusIndicator(beforeFocus),
            `preset ${index} must not show the focus indicator before focus`,
          ).toBe(false)

          await requestKeyboardFocus(preset)
          expect(
            await isActiveElement(preset),
            `preset ${index} must become the focused element; active element is ${await describeActiveElement(page)}`,
          ).toBe(true)

          const afterFocus = await readPresetStyle(preset)
          expect(afterFocus.focusVisible, `preset ${index} must match :focus-visible`).toBe(true)
          expect(
            focusIndicatorSignature(afterFocus),
            `preset ${index} outline/ring must change on keyboard focus`,
          ).not.toBe(focusIndicatorSignature(beforeFocus))
          expect(
            rendersFocusIndicator(afterFocus),
            `preset ${index} must render a visible focus indicator`,
          ).toBe(true)
        }

        // ── Manual custom-date edit: exact updated request, preset cleared ────
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

        const editedRequests = strictNetwork.requests()
        expect(editedRequests).toEqual([EXPECTED_REQUEST, CUSTOM_REQUEST])
        expect(Object.keys(editedRequests[1]!.query).sort()).toEqual(['from', 'to'])

        expect(strictNetwork.violations()).toEqual([])
      })
    })
  }
}
