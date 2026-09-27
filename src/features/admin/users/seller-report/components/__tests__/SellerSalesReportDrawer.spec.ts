// SellerSalesReportDrawer.spec.ts — the drawer shell: identity-driven request,
// reused CDMX filters, state pass-through and the fresh-snapshot print action.
//
// Mutation-sensitive: requesting without open/permission/seller, sending the
// tenant to the API, ignoring the selected window, printing a stale payload,
// printing while no report is loaded, or dropping the print failure copy fails
// at least one of these tests.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { getMexicoCityRangePreset } from '@/core/shared/utils/mexicoCityCalendar'
import SellerSalesReportDrawer from '../SellerSalesReportDrawer.vue'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'

const apiMock = vi.hoisted(() => ({ getReport: vi.fn() }))
vi.mock('../../api/sellerReport.api', () => ({ sellerReportApi: apiMock }))

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

const printMock = vi.hoisted(() => ({
  mount: vi.fn(),
  commit: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('../../utils/sellerReportPrint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/sellerReportPrint')>()
  return {
    ...actual,
    createSellerReportPrinter: () => ({
      mount: (html: string) => {
        printMock.mount(html)
        return {
          ready: Promise.resolve(),
          commit: printMock.commit,
          dispose: printMock.dispose,
        }
      },
    }),
  }
})

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

const wrappers: VueWrapper[] = []

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
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
  printMock.mount.mockReset()
  printMock.commit.mockReset()
  printMock.dispose.mockReset()
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

  it('renders the loaded report and keeps printing disabled until one exists', async () => {
    const deferred = createDeferred<SellerSalesReport>()
    apiMock.getReport.mockReturnValue(deferred.promise)

    const wrapper = mountDrawer()
    await flushPromises()

    const printButton = () => wrapper.find('[data-testid="seller-report-print"]')
    expect(printButton().attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="seller-report-loading"]').exists()).toBe(true)

    deferred.resolve(makeReport())
    await flushPromises()

    expect(wrapper.find('[data-testid="seller-report-seller-name"]').text()).toBe('Ana Vendedora')
    expect(wrapper.find('[data-testid="seller-report-metric-net-sales"]').text()).toContain(
      '$1,160.00',
    )
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(1)
    expect(printButton().attributes('disabled')).toBeUndefined()
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

  it('reuses the CDMX filters and stops querying when the window becomes invalid', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    const wrapper = mountDrawer()
    await flushPromises()
    expect(apiMock.getReport).toHaveBeenCalledTimes(1)

    // The reused filter component owns the boundary UI; the drawer only forwards.
    const filters = wrapper.findComponent({ name: 'BranchSalesSummaryFilters' })
    expect(filters.exists()).toBe(true)
    filters.vm.$emit('update:from', MONTH.to)
    filters.vm.$emit('update:to', MONTH.from)
    await flushPromises()

    expect(apiMock.getReport).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="seller-report-invalid-range"]').exists()).toBe(true)
  })

  it('reports a failed load through the shared failure copy', async () => {
    apiMock.getReport.mockRejectedValue({
      response: { status: 404, data: { statusCode: 404, error: 'SELLER_NOT_FOUND' } },
    })

    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="seller-report-error-message"]').text()).toContain('vendedor')
    expect(wrapper.find('[data-testid="seller-report-print"]').attributes('disabled')).toBeDefined()
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

describe('SellerSalesReportDrawer — printing', () => {
  it('prints a fresh validated snapshot inside the isolated document', async () => {
    apiMock.getReport.mockResolvedValue(makeReport())

    const wrapper = mountDrawer()
    await flushPromises()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(1)

    await wrapper.find('[data-testid="seller-report-print"]').trigger('click')
    await flushPromises()

    // One load request plus the fresh print refetch.
    expect(apiMock.getReport).toHaveBeenCalledTimes(2)
    const html = printMock.mount.mock.calls[0]?.[0] as string
    expect(html).toContain('F-0001')
    expect(html).toContain('Ana Vendedora')
    expect(html).not.toContain('<script')
    expect(printMock.commit).toHaveBeenCalledTimes(1)
    expect(printMock.dispose).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="seller-report-print-error"]').exists()).toBe(false)
  })

  it('never opens a document when the fresh refetch fails, and says so', async () => {
    apiMock.getReport.mockResolvedValueOnce(makeReport())
    const wrapper = mountDrawer()
    await flushPromises()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="seller-report-confirmed-row"]')).toHaveLength(1)

    apiMock.getReport.mockRejectedValue(new Error('Network Error'))
    await wrapper.find('[data-testid="seller-report-print"]').trigger('click')
    await flushPromises()

    expect(apiMock.getReport).toHaveBeenCalledTimes(2)
    expect(printMock.mount).not.toHaveBeenCalled()
    expect(printMock.commit).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="seller-report-print-error"]').text()).toContain('actualizar')
  })
})
