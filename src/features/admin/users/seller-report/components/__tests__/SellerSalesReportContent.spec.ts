// SellerSalesReportContent.spec.ts — presentation contract of the loaded report.
//
// Mutation-sensitive: aggregating canceled amounts into the confirmed metrics,
// recomputing a metric from the rows, hiding a row, dropping the Mexico City
// zone label, keeping a stale row while a failure is reported, or dropping the
// retry action fails at least one of these tests.

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SellerSalesReportContent from '@/features/admin/users/seller-report/components/SellerSalesReportContent.vue'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'

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
  })
}

function metric(wrapper: ReturnType<typeof mountContent>, name: string) {
  return wrapper.find(`[data-testid="seller-report-metric-${name}"]`).text()
}

describe('SellerSalesReportContent — loaded report', () => {
  it('renders the authoritative seller, window, generation instant and zone', () => {
    const wrapper = mountContent()

    expect(wrapper.find('[data-testid="seller-report-seller-name"]').text()).toBe('Ana Vendedora')
    expect(wrapper.find('[data-testid="seller-report-period"]').text()).toContain('01/03/2025')
    expect(wrapper.find('[data-testid="seller-report-period"]').text()).toContain('01/04/2025')
    // 15:04 UTC is 09:04 in Mexico City.
    expect(wrapper.find('[data-testid="seller-report-generated-at"]').text()).toContain(
      '01/04/2025, 09:04',
    )
    expect(wrapper.find('[data-testid="seller-report-zone"]').text()).toContain(
      'America/Mexico_City',
    )
  })

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
    const rows = wrapper.findAll('[data-testid="seller-report-confirmed-row"]')

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
    const canceled = wrapper.findAll('[data-testid="seller-report-canceled-row"]')

    expect(canceled).toHaveLength(1)
    expect(canceled[0]?.text()).toContain('F-0003')
    expect(canceled[0]?.text()).toContain('$700.00')
    expect(canceled[0]?.text()).toContain('—')
    expect(canceled[0]?.text()).toContain('08/03/2025, 09:00')

    const text = wrapper.text()
    expect(text).toContain('No se suman a las ventas confirmadas')
    // The canceled-only amount must appear ONLY in the canceled section.
    expect(wrapper.find('[data-testid="seller-report-metrics"]').text()).not.toContain('$700.00')
  })

  it('reports the returned row count against the backend cap', () => {
    expect(mountContent().find('[data-testid="seller-report-row-count"]').text()).toContain(
      '3 de 1,000',
    )
  })

  it('renders the empty-period copy for both sections instead of a fake row', () => {
    const wrapper = mountContent({
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

    expect(wrapper.find('[data-testid="seller-report-confirmed-empty"]').text()).toContain(
      'Sin ventas confirmadas',
    )
    expect(wrapper.find('[data-testid="seller-report-canceled-empty"]').text()).toContain(
      'Sin ventas canceladas',
    )
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(0)
  })

  it('flags an inactive seller without hiding the report', () => {
    const wrapper = mountContent({ sellerIsActive: false })

    expect(wrapper.find('[data-testid="seller-report-inactive-note"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(2)
  })
})

describe('SellerSalesReportContent — states', () => {
  it('shows a loading status and claims no report while the first load runs', () => {
    const wrapper = mountContent({ report: null, isInitialLoading: true })

    expect(wrapper.find('[data-testid="seller-report-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="seller-report-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seller-report-seller-name"]').exists()).toBe(false)
  })

  it('shows the failure message with a single retry action and no stale row', () => {
    const wrapper = mountContent({
      report: null,
      isError: true,
      errorMessage: 'El reporte supera el límite de 1,000 filas: el periodo tiene 1,500 ventas.',
    })

    expect(wrapper.find('[data-testid="seller-report-error-message"]').text()).toBe(
      'El reporte supera el límite de 1,000 filas: el periodo tiene 1,500 ventas.',
    )
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="seller-report-summary"]').exists()).toBe(false)

    const retry = wrapper.findAll('[data-testid="seller-report-retry"]')
    expect(retry).toHaveLength(1)
  })

  it('emits retry once when the retry action is used', async () => {
    const wrapper = mountContent({ report: null, isError: true, errorMessage: 'Falló' })

    await wrapper.find('[data-testid="seller-report-retry"]').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
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
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(2)
  })

  it('never shows the refreshing indicator when nothing is loaded', () => {
    const wrapper = mountContent({ report: null, isFetching: true, isInitialLoading: true })

    expect(wrapper.find('[data-testid="seller-report-refreshing"]').exists()).toBe(false)
  })
})
