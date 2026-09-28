// SellerSalesReportDrawer.spec.ts — the drawer shell: identity-driven request,
// the report-local Nuxt UI date filter, desktop width override, state
// pass-through and the fresh-PDF download action.
//
// Mutation-sensitive: requesting without open/permission/seller, sending the
// tenant to the API, ignoring the selected window, reverting to the shared
// analytics filter (native date inputs), dropping the ~45vw desktop width,
// downloading a stale payload instead of a backend PDF, downloading while no
// report is loaded, mislabeling the action, or dropping the download failure
// copy fails at least one of these tests.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { getMexicoCityRangePreset } from '@/core/shared/utils/mexicoCityCalendar'
import SellerSalesReportDrawer from '../SellerSalesReportDrawer.vue'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'

const apiMock = vi.hoisted(() => ({ getReport: vi.fn(), getReportPdf: vi.fn() }))
vi.mock('../../api/sellerReport.api', () => ({ sellerReportApi: apiMock }))

const downloadMock = vi.hoisted(() => ({ triggerSellerReportPdfDownload: vi.fn() }))
vi.mock('../../utils/sellerReportDownload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/sellerReportDownload')>()
  return { ...actual, triggerSellerReportPdfDownload: downloadMock.triggerSellerReportPdfDownload }
})

// The committed responsive drawer renders its body through a teleported slide
// over, which this spec deliberately does not exercise: the drawer's own layout
// component is already covered elsewhere, and this slice needs its authored
// content/footer findable in the mounted tree.
vi.mock('@/core/shared/components/AppResponsiveDrawer.vue', () => ({
  default: {
    name: 'AppResponsiveDrawer',
    template: `
      <div
        data-testid="responsive-drawer"
        :data-open="String(open)"
        :data-title="title"
        :data-description="description"
        :data-desktop-ui="desktopUi ? JSON.stringify(desktopUi) : ''"
      >
        <slot name="title" />
        <slot name="body" />
        <slot name="footer" />
        <button data-testid="responsive-drawer-close" @click="$emit('update:open', false)">
          Cerrar
        </button>
      </div>
    `,
    props: ['open', 'title', 'description', 'closeAriaLabel', 'desktopUi', 'mobileBodyClass'],
    emits: ['update:open', 'after:enter', 'after:leave'],
  },
}))

const SELLER_ID = '8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f'
const TENANT_ID = '11111111-2222-4333-8444-555555555555'
const MONTH = getMexicoCityRangePreset('thisMonth')

function makeReport(overrides: Partial<SellerSalesReport> = {}): SellerSalesReport {
  return {
    seller: { id: SELLER_ID, name: 'Ana Vendedora' },
    tenantId: TENANT_ID,
    timeZone: 'America/Mexico_City',
    from: MONTH.from,
    to: MONTH.to,
    generatedAt: '2025-04-01T15:04:05.000Z',
    attribution: 'CURRENT_SELLER',
    balances: 'CURRENT',
    rowLimit: 1000,
    rowCount: 1,
    confirmed: {
      dateBasis: 'confirmedAt',
      summary: {
        saleCount: 1,
        netSalesCents: 116_000,
        collectedCents: 16_000,
        outstandingDebtCents: 100_000,
        averageTicketCents: 116_000,
      },
      rows: [
        {
          id: 'a1111111-1111-4111-8111-111111111111',
          folio: 'F-0001',
          confirmedAt: `${MONTH.from}T18:30:00.000Z`,
          totalCents: 116_000,
          paidCents: 16_000,
          debtCents: 100_000,
          paymentStatus: 'PARTIAL',
        },
      ],
    },
    canceled: { dateBasis: 'canceledAt', saleCount: 0, rows: [] },
    ...overrides,
  }
}

function pdfResult() {
  return {
    blob: new Blob(['%PDF-1.7\nbytes'], { type: 'application/pdf' }),
    fileName: 'reporte-ana.pdf',
  }
}

const wrappers: VueWrapper[] = []

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function mountDrawer(props: Record<string, unknown> = {}) {
  const wrapper = mount(SellerSalesReportDrawer, {
    props: {
      open: true,
      tenantId: TENANT_ID,
      seller: { id: SELLER_ID, name: 'Ana Vendedora', isActive: true },
      canRead: true,
      ...props,
    },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ],
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

beforeEach(() => {
  apiMock.getReport.mockReset()
  apiMock.getReportPdf.mockReset()
  downloadMock.triggerSellerReportPdfDownload.mockReset()
})

describe('SellerSalesReportDrawer — request identity', () => {
  it('requests the opened seller over the current-month Mexico City window', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    mountDrawer()
    await flushPromises()

    expect(apiMock.getReport).toHaveBeenCalledTimes(1)
    const [request, context] = apiMock.getReport.mock.calls[0] ?? []
    expect(request).toEqual({ sellerUserId: SELLER_ID, from: MONTH.from, to: MONTH.to })
    // The tenant is an echo expectation, never a wire parameter.
    expect(context?.tenantId).toBe(TENANT_ID)
  })

  it('issues no request while closed, unpermitted, unidentified or out of range', async () => {
    const cases: Array<{ label: string; props: Record<string, unknown> }> = [
      { label: 'closed', props: { open: false } },
      { label: 'unpermitted', props: { canRead: false } },
      { label: 'no seller', props: { seller: null } },
      { label: 'no tenant', props: { tenantId: null } },
      { label: 'blank seller id', props: { seller: { id: '', name: 'Sin id', isActive: true } } },
    ]

    const attempts: Record<string, number> = {}
    for (const testCase of cases) {
      apiMock.getReport.mockClear().mockResolvedValue(makeReport())
      mountDrawer(testCase.props)
      await flushPromises()
      attempts[testCase.label] = apiMock.getReport.mock.calls.length
    }

    expect(attempts).toEqual({
      closed: 0,
      unpermitted: 0,
      'no seller': 0,
      'no tenant': 0,
      'blank seller id': 0,
    })
  })

  it('renders the loaded report and keeps downloading disabled until one exists', async () => {
    const deferred = createDeferred<SellerSalesReport>()
    apiMock.getReport.mockReturnValue(deferred.promise)

    const wrapper = mountDrawer()
    await flushPromises()

    const downloadButton = () => wrapper.find('[data-testid="seller-report-download"]')
    expect(downloadButton().attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="seller-report-loading"]').exists()).toBe(true)

    deferred.resolve(makeReport())
    await flushPromises()

    expect(wrapper.find('[data-testid="seller-report-seller-name"]').text()).toBe('Ana Vendedora')
    expect(wrapper.find('[data-testid="seller-report-metric-net-sales"]').text()).toContain(
      '$1,160.00',
    )
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(1)
    expect(downloadButton().attributes('disabled')).toBeUndefined()
    expect(downloadButton().text()).toContain('Descargar PDF')
  })

  it('keeps an inactive seller reportable and says so', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    const wrapper = mountDrawer({
      seller: { id: SELLER_ID, name: 'Ana Vendedora', isActive: false },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="seller-report-inactive-note"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(1)
  })

  it('renders the report-local Nuxt UI date filter and stops querying when the window becomes invalid', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    const wrapper = mountDrawer()
    await flushPromises()
    expect(apiMock.getReport).toHaveBeenCalledTimes(1)

    // The report no longer reuses the shared analytics filter (which renders a
    // native date input); it renders the report-local Nuxt UI calendar filter.
    const filters = wrapper.findComponent({ name: 'SellerReportDateRangeFilter' })
    expect(filters.exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'BranchSalesSummaryFilters' }).exists()).toBe(false)
    expect(wrapper.findAll('input[type="date"]:not([aria-hidden="true"])')).toHaveLength(0)

    // The local filter owns the boundary UI; the drawer only forwards.
    filters.vm.$emit('update:from', MONTH.to)
    filters.vm.$emit('update:to', MONTH.from)
    await flushPromises()

    expect(apiMock.getReport).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="seller-report-invalid-range"]').exists()).toBe(true)
  })

  it('forwards a desktop-only width override a little under half the viewport', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    const wrapper = mountDrawer()
    await flushPromises()

    const drawn = wrapper.findComponent({ name: 'AppResponsiveDrawer' })
    const forwarded = JSON.parse(
      wrapper.find('[data-testid="responsive-drawer"]').attributes('data-desktop-ui') ?? '{}',
    ) as { content?: string }

    expect(forwarded.content).toContain('sm:w-[45vw]')
    expect(forwarded.content).toContain('sm:max-w-[45vw]')
    expect(forwarded.content).toContain('max-w-none')
    // Mobile bottom sheet stays untouched: no mobile class override is sent.
    expect(drawn.props('mobileBodyClass')).toBeUndefined()
  })

  it('reports a failed load through the shared failure copy', async () => {
    apiMock.getReport.mockRejectedValue({
      response: { status: 404, data: { statusCode: 404, error: 'SELLER_NOT_FOUND' } },
    })

    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="seller-report-error-message"]').text()).toContain('vendedor')
    expect(
      wrapper.find('[data-testid="seller-report-download"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('forwards drawer closure to the caller', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="responsive-drawer"]').attributes('data-open')).toBe('true')
    await wrapper.find('[data-testid="responsive-drawer-close"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})

describe('SellerSalesReportDrawer — PDF download', () => {
  it('downloads a fresh backend PDF for the current seller and window', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())
    const pdf = pdfResult()
    apiMock.getReportPdf.mockResolvedValue(pdf)

    const wrapper = mountDrawer()
    await flushPromises()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(1)

    await wrapper.find('[data-testid="seller-report-download"]').trigger('click')
    await flushPromises()

    expect(apiMock.getReportPdf).toHaveBeenCalledTimes(1)
    const [request, context] = apiMock.getReportPdf.mock.calls[0] ?? []
    expect(request).toEqual({ sellerUserId: SELLER_ID, from: MONTH.from, to: MONTH.to })
    expect(context?.tenantId).toBe(TENANT_ID)
    expect(downloadMock.triggerSellerReportPdfDownload).toHaveBeenCalledWith(pdf.blob, pdf.fileName)
    expect(wrapper.find('[data-testid="seller-report-download-error"]').exists()).toBe(false)
  })

  it('shows the loading state on the action while the PDF request is in flight', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())
    const deferred = createDeferred<ReturnType<typeof pdfResult>>()
    apiMock.getReportPdf.mockReturnValue(deferred.promise)

    const wrapper = mountDrawer()
    await flushPromises()
    await flushPromises()

    const button = () => wrapper.find('[data-testid="seller-report-download"]')
    expect(button().attributes('disabled')).toBeUndefined()

    await button().trigger('click')
    await flushPromises()
    expect(button().attributes('disabled')).toBeDefined()

    deferred.resolve(pdfResult())
    await flushPromises()
    expect(button().attributes('disabled')).toBeUndefined()
  })

  it('never downloads when the fresh PDF request fails, and says so', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())
    apiMock.getReportPdf.mockRejectedValue({
      response: { status: 500, data: { error: 'PDF_GENERATION_FAILED' } },
    })

    const wrapper = mountDrawer()
    await flushPromises()
    await flushPromises()

    await wrapper.find('[data-testid="seller-report-download"]').trigger('click')
    await flushPromises()

    expect(downloadMock.triggerSellerReportPdfDownload).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="seller-report-download-error"]').text()).toContain('PDF')
  })

  it('discloses that the PDF is an independent, freshly generated snapshot', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    const wrapper = mountDrawer()
    await flushPromises()
    await flushPromises()

    const notice = wrapper.find('[data-testid="seller-report-pdf-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text().toLowerCase()).toContain('pdf')
  })
})
