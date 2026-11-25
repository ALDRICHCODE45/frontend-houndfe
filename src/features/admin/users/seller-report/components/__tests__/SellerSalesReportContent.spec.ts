// SellerSalesReportContent.spec.ts — presentation contract of the loaded report.
//
// Mutation-sensitive: aggregating canceled amounts into the confirmed metrics,
// recomputing a metric from the rows, hiding a row, re-sorting the backend rows,
// keeping a stale row while a failure is reported, dropping the retry action, or
// opening more than one GET /sales/:id per opened row fails at least one test.
//
// Sales history redesign T2: the report now uses the same aligned table and
// expandable row as the customer history (SaleHistoryRowDetail); the seller,
// period, generation instant and row count moved to the drawer header/footer.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import SellerSalesReportContent from '@/features/admin/users/seller-report/components/SellerSalesReportContent.vue'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'

const { getByIdMock, routerPush } = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  routerPush: vi.fn(async () => undefined),
}))
vi.mock('@/features/POS/sales/api/sale.api', () => ({ saleApi: { getById: getByIdMock } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: routerPush }),
}))

const SELLER_ID = '8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f'
const TENANT_ID = '11111111-2222-4333-8444-555555555555'

function makeReport(overrides: Partial<SellerSalesReport> = {}): SellerSalesReport {
  return {
    seller: { id: SELLER_ID, name: 'Ana Vendedora' },
    tenantId: TENANT_ID,
    timeZone: 'America/Mexico_City',
    from: '2025-03-01',
    to: '2025-04-01',
    generatedAt: '2025-04-01T15:04:05.000Z',
    attribution: 'CURRENT_SELLER',
    balances: 'CURRENT',
    rowLimit: 1000,
    rowCount: 3,
    confirmed: {
      dateBasis: 'confirmedAt',
      summary: {
        saleCount: 2,
        // Deliberately NOT the row sum: the UI must render the backend value.
        netSalesCents: 999_999,
        collectedCents: 74_000,
        outstandingDebtCents: 100_000,
        averageTicketCents: 87_000,
      },
      rows: [
        {
          id: 'a1111111-1111-4111-8111-111111111111',
          folio: 'F-0001',
          confirmedAt: '2025-03-05T18:30:00.000Z',
          totalCents: 116_000,
          paidCents: 16_000,
          debtCents: 100_000,
          paymentStatus: 'PARTIAL',
        },
        {
          id: 'b2222222-2222-4222-8222-222222222222',
          folio: null,
          confirmedAt: '2025-03-06T17:00:00.000Z',
          totalCents: 58_000,
          paidCents: 58_000,
          debtCents: 0,
          paymentStatus: 'PAID',
        },
      ],
    },
    canceled: {
      dateBasis: 'canceledAt',
      saleCount: 1,
      rows: [
        {
          id: 'c3333333-3333-4333-8333-333333333333',
          folio: 'F-0003',
          confirmedAt: null,
          canceledAt: '2025-03-08T15:00:00.000Z',
          totalCents: 70_000,
        },
      ],
    },
    ...overrides,
  }
}

function mountContent(props: Record<string, unknown> = {}) {
  return mount(SellerSalesReportContent, {
    props: {
      report: makeReport(),
      isInitialLoading: false,
      isFetching: false,
      isError: false,
      errorMessage: null,
      sellerIsActive: true,
      ...props,
    },
    global: {
      plugins: [
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
}

// Body rows of a section's aligned table (the opened-detail rows carry no data-row-id).
function tableRows(wrapper: VueWrapper, name: 'confirmed' | 'canceled') {
  const table = wrapper.find(`[data-testid="seller-report-${name}-table"]`)
  if (!table.exists()) return []
  return table.findAll('tbody tr[data-row-id]')
}
const confirmedRows = (wrapper: VueWrapper) => tableRows(wrapper, 'confirmed')
const canceledRows = (wrapper: VueWrapper) => tableRows(wrapper, 'canceled')

function metric(wrapper: ReturnType<typeof mountContent>, name: string) {
  return wrapper.find(`[data-testid="seller-report-metric-${name}"]`).text()
}

function confirmedRow(index: number, overrides: Record<string, unknown> = {}) {
  const suffix = String(index).padStart(4, '0')
  return {
    id: `d0000000-0000-4000-8000-00000000${suffix}`,
    folio: `S-${suffix}`,
    confirmedAt: `2025-03-10T18:${String(index % 60).padStart(2, '0')}:00.000Z`,
    totalCents: 10_000,
    paidCents: 10_000,
    debtCents: 0,
    paymentStatus: 'PAID' as const,
    ...overrides,
  }
}

beforeEach(() => {
  getByIdMock.mockReset()
  getByIdMock.mockResolvedValue({
    id: 'a1111111-1111-4111-8111-111111111111',
    folio: 'F-0001',
    status: 'CONFIRMED',
    paidCents: 16_000,
    debtCents: 100_000,
    dueDate: null,
    deliveryStatus: 'DELIVERED',
    customer: { id: 'c-1', name: 'Rodrigo Salinas' },
    cashier: { id: 'u-2', name: 'Jorge Ríos' },
    seller: { id: SELLER_ID, name: 'Ana Vendedora' },
    items: [],
    payments: [],
  })
})

describe('SellerSalesReportContent — loaded report', () => {
  it('renders every backend metric verbatim instead of aggregating the rows', () => {
    const wrapper = mountContent()

    expect(metric(wrapper, 'sale-count')).toContain('2')
    // The payload says 999,999 while the rows sum to 174,000: the UI shows 999,999.
    expect(metric(wrapper, 'net-sales')).toContain('$9,999.99')
    expect(metric(wrapper, 'net-sales')).not.toContain('$1,740.00')
    expect(metric(wrapper, 'collected')).toContain('$740.00')
    expect(metric(wrapper, 'outstanding')).toContain('$1,000.00')
    expect(metric(wrapper, 'average-ticket')).toContain('$870.00')
  })

  it('discloses current attribution, reassignment across periods and current balances', () => {
    const wrapper = mountContent()
    const attribution = wrapper.find('[data-testid="seller-report-attribution"]')

    expect(attribution.exists()).toBe(true)
    // Approved business rule: the report is attributed to the CURRENTLY assigned
    // seller, and a reassignment also moves past periods in this report.
    expect(attribution.text()).toContain('Ventas atribuidas al vendedor asignado actualmente.')
    expect(attribution.text()).toContain(
      'Si una venta se reasigna a otro vendedor, su atribución cambia también en este reporte de periodos anteriores.',
    )
    // The current-balances caveat is retained next to the attribution disclosure.
    expect(attribution.text()).toContain('Saldos actuales')
    // The previous wording implied the seller had confirmed the sales personally.
    expect(attribution.text()).not.toContain('Ventas confirmadas por este vendedor')
    expect(wrapper.text()).not.toContain('Ventas confirmadas por este vendedor')
  })

  it('renders every confirmed row with its authoritative status and amounts', () => {
    const wrapper = mountContent()
    const rows = confirmedRows(wrapper)

    expect(rows).toHaveLength(2)
    expect(rows[0]?.attributes('data-row-id')).toBe('a1111111-1111-4111-8111-111111111111')
    expect(rows[0]?.text()).toContain('F-0001')
    expect(rows[0]?.text()).toContain('Parcial')
    expect(rows[0]?.text()).toContain('$1,160.00')
    expect(rows[0]?.text()).toContain('$160.00')
    expect(rows[0]?.text()).toContain('$1,000.00')
    expect(rows[0]?.text()).toContain('05/03/2025, 12:30')

    expect(rows[1]?.text()).toContain('Sin folio')
    expect(rows[1]?.text()).toContain('Pagada')
    expect(rows[1]?.text()).toContain('$580.00')
  })

  it('keeps canceled rows separate and never aggregates them into the metrics', () => {
    const wrapper = mountContent()
    const canceled = canceledRows(wrapper)

    expect(canceled).toHaveLength(1)
    expect(canceled[0]?.text()).toContain('F-0003')
    expect(canceled[0]?.text()).toContain('$700.00')
    expect(canceled[0]?.text()).toContain('—')
    expect(canceled[0]?.text()).toContain('08/03/2025, 09:00')

    const summary = wrapper.get('[data-testid="seller-report-canceled"] summary').text()
    expect(summary).toContain('Ventas canceladas')
    expect(summary).toContain('1 · informativas')

    const text = wrapper.text()
    expect(text).toContain('No se suman a las ventas confirmadas')
    // The canceled-only amount must appear ONLY in the canceled section.
    expect(wrapper.find('[data-testid="seller-report-metrics"]').text()).not.toContain('$700.00')
  })

  it('renders one period-without-sales state with real zeros and a wider-period shortcut', async () => {
    const wrapper = mountContent({
      canWidenPeriod: true,
      report: makeReport({
        rowCount: 0,
        confirmed: {
          dateBasis: 'confirmedAt',
          summary: {
            saleCount: 0,
            netSalesCents: 0,
            collectedCents: 0,
            outstandingDebtCents: 0,
            averageTicketCents: 0,
          },
          rows: [],
        },
        canceled: { dateBasis: 'canceledAt', saleCount: 0, rows: [] },
      }),
    })

    const empty = wrapper.get('[data-testid="seller-report-period-empty"]')
    expect(empty.text()).toContain('Sin ventas en este periodo')
    expect(empty.text()).toContain('Ana Vendedora no tiene ventas confirmadas ni canceladas en este periodo.')
    expect(metric(wrapper, 'net-sales')).toContain('$0.00')
    expect(confirmedRows(wrapper)).toHaveLength(0)
    expect(wrapper.find('input[aria-label="Buscar ventas del reporte por folio"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seller-report-canceled"]').exists()).toBe(false)

    await empty.get('button').trigger('click')
    expect(wrapper.emitted('widen-period')).toHaveLength(1)
  })

  it('offers no shortcut when the period cannot be widened', () => {
    const wrapper = mountContent({
      canWidenPeriod: false,
      report: makeReport({
        rowCount: 0,
        confirmed: { ...makeReport().confirmed, rows: [] },
        canceled: { dateBasis: 'canceledAt', saleCount: 0, rows: [] },
      }),
    })

    expect(wrapper.get('[data-testid="seller-report-period-empty"]').find('button').exists()).toBe(false)
  })

  it('keeps the canceled section when only the confirmed list is empty', () => {
    const wrapper = mountContent({
      report: makeReport({ rowCount: 1, confirmed: { ...makeReport().confirmed, rows: [] } }),
    })

    expect(wrapper.get('[data-testid="seller-report-confirmed-empty"]').text()).toContain(
      'Sin ventas confirmadas',
    )
    expect(canceledRows(wrapper)).toHaveLength(1)
  })

  it('says the canceled list is empty inside its section', () => {
    const wrapper = mountContent({
      report: makeReport({ canceled: { dateBasis: 'canceledAt', saleCount: 0, rows: [] } }),
    })

    expect(wrapper.get('[data-testid="seller-report-canceled-empty"]').text()).toContain(
      'Sin ventas canceladas',
    )
  })

  it('flags an inactive seller without hiding the report', () => {
    const wrapper = mountContent({ sellerIsActive: false })

    expect(wrapper.find('[data-testid="seller-report-inactive-note"]').exists()).toBe(true)
    expect(confirmedRows(wrapper)).toHaveLength(2)
  })
})

describe('SellerSalesReportContent — design system', () => {
  it('renders each payment state as a shared StatusBadge with the mapped tone', () => {
    const wrapper = mountContent()
    const badges = confirmedRows(wrapper)
      .flatMap((row) => row.findAll('.hf-status-badge'))
      .map((badge) => [badge.text(), badge.attributes('data-tone')])

    expect(badges).toEqual([
      ['Parcial', 'warning'],
      ['Pagada', 'success'],
    ])
  })

  it('keeps money tabular and right-aligned in the aligned table', () => {
    const wrapper = mountContent()

    const money = confirmedRows(wrapper).flatMap((row) => row.findAll('td.hf-figure'))
    expect(money).toHaveLength(6)
    expect(money.every((cell) => cell.classes().includes('text-right'))).toBe(true)
    const headers = wrapper
      .get('[data-testid="seller-report-confirmed-table"]')
      .findAll('thead th')
      .map((cell) => cell.text())
    expect(headers).toEqual(['Abrir', 'Venta', 'Estado', 'Total', 'Pagado', 'Saldo'])
  })
})

describe('SellerSalesReportContent — states', () => {
  it('shows a loading skeleton shaped like the report and claims no report while the first load runs', () => {
    const wrapper = mountContent({ report: null, isInitialLoading: true })

    const loading = wrapper.get('[data-testid="seller-report-loading"]')
    expect(loading.attributes('aria-busy')).toBe('true')
    // Metric tiles plus table rows, not a bare bar.
    expect(loading.findAll('[data-slot="base"], .animate-pulse').length).toBeGreaterThanOrEqual(8)
    expect(wrapper.find('[data-testid="seller-report-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seller-report-seller-name"]').exists()).toBe(false)
  })

  it('shows the failure message with a single retry action and no stale row', () => {
    const wrapper = mountContent({
      report: null,
      isError: true,
      errorMessage: 'El reporte supera el límite de 1,000 filas: el periodo tiene 1,500 ventas.',
    })

    const failure = wrapper.get('[data-testid="seller-report-error"]')
    expect(failure.attributes('data-kind')).toBe('error')
    expect(failure.attributes('role')).toBe('alert')
    expect(failure.get('.hf-empty-state__title').text()).toBe('No se pudo cargar el reporte')
    expect(failure.get('.hf-empty-state__description').text()).toBe(
      'El reporte supera el límite de 1,000 filas: el periodo tiene 1,500 ventas.',
    )
    expect(confirmedRows(wrapper)).toHaveLength(0)
    expect(wrapper.find('[data-testid="seller-report-summary"]').exists()).toBe(false)

    const retry = wrapper.findAll('[data-testid="seller-report-retry"]')
    expect(retry).toHaveLength(1)
  })

  it('emits retry once when the retry action is used', async () => {
    const wrapper = mountContent({ report: null, isError: true, errorMessage: 'Falló' })

    await wrapper.find('[data-testid="seller-report-retry"]').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('offers «Cambiar periodo» instead of a retry on the row-limit error', async () => {
    const wrapper = mountContent({
      report: null,
      isError: true,
      failureKind: 'row-limit-exceeded',
      errorMessage: 'El reporte supera el límite de 1,000 filas: el periodo tiene 1,284 ventas.',
    })

    const failure = wrapper.get('[data-testid="seller-report-error"]')
    expect(failure.attributes('data-failure-kind')).toBe('row-limit-exceeded')
    expect(failure.text()).toContain('1,284 ventas')
    expect(wrapper.find('[data-testid="seller-report-retry"]').exists()).toBe(false)

    await wrapper.get('[data-testid="seller-report-change-period"]').trigger('click')
    expect(wrapper.emitted('change-period')).toHaveLength(1)
    expect(wrapper.emitted('retry')).toBeUndefined()
  })

  it('shows an idle status when there is no active query', () => {
    const wrapper = mountContent({ report: null })

    expect(wrapper.find('[data-testid="seller-report-idle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="seller-report-loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seller-report-error"]').exists()).toBe(false)
  })

  it('shows a refreshing indicator over a loaded report', () => {
    const wrapper = mountContent({ isFetching: true })

    expect(wrapper.find('[data-testid="seller-report-refreshing"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="seller-report-summary"]').exists()).toBe(true)
    expect(confirmedRows(wrapper)).toHaveLength(2)
  })

  it('never shows the refreshing indicator when nothing is loaded', () => {
    const wrapper = mountContent({ report: null, isFetching: true, isInitialLoading: true })

    expect(wrapper.find('[data-testid="seller-report-refreshing"]').exists()).toBe(false)
  })
})

describe('SellerSalesReportContent — rows open in place (sales history redesign T2)', () => {
  it('opens a row into the shared sale detail with one GET /sales/:id, naming the customer', async () => {
    const wrapper = mountContent()
    const toggle = wrapper.get('button[aria-label="Detalle de la venta F-0001"]')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.classes()).toContain('size-11')
    await toggle.trigger('click')
    await flushPromises()

    expect(toggle.attributes('aria-expanded')).toBe('true')
    const detail = wrapper.get('[data-testid="sale-history-detail"]')
    expect(getByIdMock).toHaveBeenCalledTimes(1)
    expect(getByIdMock).toHaveBeenCalledWith('a1111111-1111-4111-8111-111111111111')
    expect(detail.text()).toContain('Cliente')
    expect(detail.text()).toContain('Rodrigo Salinas')
    expect(detail.text()).toContain('Abrir venta')
    // The seller report never charges: no «Cobrar» even on a sale that still owes.
    expect(detail.text()).not.toContain('Cobrar')

    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="sale-history-detail"]').exists()).toBe(false)
  })

  it('«Abrir venta» routes to the sale detail', async () => {
    const wrapper = mountContent()
    await wrapper.get('button[aria-label="Detalle de la venta F-0001"]').trigger('click')
    await flushPromises()

    const open = wrapper.findAll('button').find((button) => button.text().includes('Abrir venta'))
    await open!.trigger('click')

    expect(routerPush).toHaveBeenCalledWith({
      name: 'pos-sale-detail',
      params: { id: 'a1111111-1111-4111-8111-111111111111' },
    })
  })

  it('never sums the rows: no totals row on either list', () => {
    const wrapper = mountContent()
    expect(wrapper.find('tfoot').exists()).toBe(false)
  })
})

describe('SellerSalesReportContent — browser filters (no sums, no re-sorting)', () => {
  it('filters the confirmed rows by the current payment labels and keeps the metrics', async () => {
    const wrapper = mountContent()
    const chips = wrapper.findAll('[data-testid="seller-report-status-chip"]')

    expect(chips.map((chip) => chip.text())).toEqual(['Todas', 'Pagada', 'Parcial', 'A crédito'])
    expect(chips.every((chip) => chip.classes().includes('min-h-11'))).toBe(true)

    await chips[2]!.trigger('click')

    expect(chips[2]!.attributes('aria-pressed')).toBe('true')
    expect(confirmedRows(wrapper).map((row) => row.attributes('data-row-id'))).toEqual([
      'a1111111-1111-4111-8111-111111111111',
    ])
    expect(wrapper.get('[data-testid="seller-report-confirmed-count"]').text()).toContain('1 de 2')
    expect(metric(wrapper, 'net-sales')).toContain('$9,999.99')
  })

  it('searches by folio and offers to clear when nothing matches', async () => {
    const wrapper = mountContent()
    const search = wrapper.get('input[aria-label="Buscar ventas del reporte por folio"]')

    await search.setValue('0001')
    expect(confirmedRows(wrapper)).toHaveLength(1)

    await search.setValue('zzz')
    const noMatch = wrapper.get('[data-testid="seller-report-filter-empty"]')
    expect(confirmedRows(wrapper)).toHaveLength(0)
    await noMatch.get('button').trigger('click')
    expect(confirmedRows(wrapper)).toHaveLength(2)
  })

  it('keeps the backend order and reveals long periods in steps', async () => {
    const rows = Array.from({ length: 55 }, (_, index) => confirmedRow(index + 1))
    const wrapper = mountContent({
      report: makeReport({ rowCount: 55, confirmed: { ...makeReport().confirmed, rows } }),
    })

    expect(confirmedRows(wrapper)).toHaveLength(50)
    expect(confirmedRows(wrapper)[0]!.attributes('data-row-id')).toBe(rows[0]!.id)
    const more = wrapper.get('[data-testid="seller-report-show-more"]')
    expect(more.text()).toContain('Mostrar las 5 ventas restantes')

    await more.trigger('click')

    expect(confirmedRows(wrapper).map((row) => row.attributes('data-row-id'))).toEqual(
      rows.map((row) => row.id),
    )
    expect(wrapper.find('[data-testid="seller-report-show-more"]').exists()).toBe(false)
  })
})
