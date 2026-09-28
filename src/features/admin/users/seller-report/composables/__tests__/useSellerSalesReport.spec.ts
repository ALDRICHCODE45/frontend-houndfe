// useSellerSalesReport.spec.ts — query identity/guards plus the PDF download
// orchestration.
//
// Mutation-sensitive: sending the tenant identity to the API, enabling the query
// without open + permissions + seller + a valid window, keeping stale data
// visible after a failure, reusing the on-screen JSON payload instead of asking
// the backend for a fresh PDF, skipping the context fence after the await,
// failing to abort on a context change, clearing another run's loading flag,
// blocking a legitimate repeat of the same filter, or leaking an unbounded
// transport error into user copy fails at least one of these tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useQuery } from '@tanstack/vue-query'
import { sellerReportApi } from '../../api/sellerReport.api'
import { triggerSellerReportPdfDownload } from '../../utils/sellerReportDownload'
import { sellerSalesReportQueryKeys } from '../../query-keys'
import { SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE } from '../../utils/sellerReportPresentation'
import { useSellerSalesReport } from '../useSellerSalesReport'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'
import type { SellerReportPdf } from '../../api/sellerReport.api'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQuery: vi.fn() }
})

vi.mock('../../api/sellerReport.api', () => ({
  sellerReportApi: { getReport: vi.fn(), getReportPdf: vi.fn() },
}))

vi.mock('../../utils/sellerReportDownload', () => ({
  triggerSellerReportPdfDownload: vi.fn(),
}))

const SELLER_ID = '8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f'
const OTHER_SELLER_ID = '00000000-1111-4222-8333-444444444444'
const TENANT_ID = '11111111-2222-4333-8444-555555555555'
const OTHER_TENANT_ID = '99999999-2222-4333-8444-555555555555'
const FROM = '2025-03-01'
const TO = '2025-04-01'

const getReportPdf = vi.mocked(sellerReportApi.getReportPdf)
const triggerDownload = vi.mocked(triggerSellerReportPdfDownload)

function makeReport(overrides: Partial<SellerSalesReport> = {}): SellerSalesReport {
  return {
    seller: { id: SELLER_ID, name: 'Ana Vendedora' },
    tenantId: TENANT_ID,
    timeZone: 'America/Mexico_City',
    from: FROM,
    to: TO,
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
          confirmedAt: '2025-03-05T18:30:00.000Z',
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

function pdfResult(): SellerReportPdf {
  return {
    blob: new Blob(['%PDF-1.7\nbytes'], { type: 'application/pdf' }),
    fileName: 'reporte-ana.pdf',
  }
}

interface CapturedQueryOptions {
  queryKey: { value: unknown }
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
  enabled: { value: boolean }
  staleTime: number
  gcTime: number
  retry: unknown
  placeholderData: unknown
}

function setupQueryResult() {
  const result = {
    data: ref<SellerSalesReport | undefined>(undefined),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref<unknown>(null),
    refetch: vi.fn().mockResolvedValue(undefined),
  }
  vi.mocked(useQuery).mockReturnValue(result as never)
  return result
}

function capturedOptions(): CapturedQueryOptions {
  const calls = vi.mocked(useQuery).mock.calls
  const call = calls[calls.length - 1]
  if (!call) throw new Error('useQuery was not called')
  return call[0] as unknown as CapturedQueryOptions
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function defaultOptions(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID,
    sellerUserId: SELLER_ID,
    from: FROM,
    to: TO,
    open: true,
    canRead: true,
    ...overrides,
  }
}

describe('useSellerSalesReport — query identity and guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks tenant, seller and both boundaries independently in the cache key', () => {
    setupQueryResult()
    const tenant = ref(TENANT_ID)
    const seller = ref(SELLER_ID)
    const from = ref(FROM)
    const to = ref(TO)

    useSellerSalesReport(defaultOptions({ tenantId: tenant, sellerUserId: seller, from, to }))
    const options = capturedOptions()

    expect(options.queryKey.value).toEqual([
      'admin',
      'users',
      TENANT_ID,
      'seller-sales-report',
      SELLER_ID,
      FROM,
      TO,
    ])

    seller.value = OTHER_SELLER_ID
    expect(options.queryKey.value).toEqual(
      sellerSalesReportQueryKeys.report(TENANT_ID, {
        sellerUserId: OTHER_SELLER_ID,
        from: FROM,
        to: TO,
      }),
    )
    // A different seller is a different cache slot: never shared.
    expect(options.queryKey.value).not.toEqual(
      sellerSalesReportQueryKeys.report(TENANT_ID, { sellerUserId: SELLER_ID, from: FROM, to: TO }),
    )

    from.value = '2025-02-01'
    to.value = '2025-03-01'
    expect(options.queryKey.value).toEqual(
      sellerSalesReportQueryKeys.report(TENANT_ID, {
        sellerUserId: OTHER_SELLER_ID,
        from: '2025-02-01',
        to: '2025-03-01',
      }),
    )
  })

  it('enables the query only while the drawer is open, permitted, identified and in range', () => {
    const cases: Array<{ label: string; overrides: Record<string, unknown> }> = [
      { label: 'all conditions met', overrides: {} },
      { label: 'closed drawer', overrides: { open: false } },
      { label: 'missing permission', overrides: { canRead: false } },
      { label: 'missing tenant', overrides: { tenantId: '' } },
      { label: 'blank tenant', overrides: { tenantId: '   ' } },
      { label: 'missing seller', overrides: { sellerUserId: null } },
      { label: 'blank seller', overrides: { sellerUserId: ' ' } },
      { label: 'inverted range', overrides: { from: TO, to: FROM } },
      { label: 'impossible date', overrides: { from: '2025-02-30' } },
      { label: '367 days', overrides: { from: '2024-01-01', to: '2025-01-02' } },
      // Exactly 366 local days is the longest accepted window.
      { label: '366 days', overrides: { from: '2024-01-01', to: '2025-01-01' } },
    ]

    // Keyed by case label so a failure names the exact condition that drifted.
    const enabledByCase: Record<string, boolean> = {}
    for (const testCase of cases) {
      setupQueryResult()
      useSellerSalesReport(defaultOptions(testCase.overrides))
      enabledByCase[testCase.label] = capturedOptions().enabled.value
    }

    expect(enabledByCase).toEqual({
      'all conditions met': true,
      'closed drawer': false,
      'missing permission': false,
      'missing tenant': false,
      'blank tenant': false,
      'missing seller': false,
      'blank seller': false,
      'inverted range': false,
      'impossible date': false,
      '367 days': false,
      '366 days': true,
    })
  })

  it('sends exactly { sellerUserId, from, to } and forwards the abort signal', async () => {
    setupQueryResult()
    const payload = makeReport()
    vi.mocked(sellerReportApi.getReport).mockResolvedValue(payload)

    useSellerSalesReport(defaultOptions())
    const controller = new AbortController()
    const result = await capturedOptions().queryFn({ signal: controller.signal })

    expect(result).toBe(payload)
    expect(vi.mocked(sellerReportApi.getReport)).toHaveBeenCalledTimes(1)
    const call = vi.mocked(sellerReportApi.getReport).mock.calls[0]
    const request = call?.[0]
    expect(request).toEqual({ sellerUserId: SELLER_ID, from: FROM, to: TO })
    expect(Object.keys(request as object)).toEqual(['sellerUserId', 'from', 'to'])
    expect(call?.[1]?.signal).toBe(controller.signal)
  })

  it('never reuses a cached payload: staleTime 0, gcTime 0, no placeholder, no retry', () => {
    setupQueryResult()

    useSellerSalesReport(defaultOptions())
    const options = capturedOptions()

    expect(options.staleTime).toBe(0)
    expect(options.gcTime).toBe(0)
    expect(options.retry).toBe(false)
    expect(options.placeholderData).toBeUndefined()
  })

  it('exposes the report only while the query is healthy', () => {
    const result = setupQueryResult()
    const api = useSellerSalesReport(defaultOptions())

    // An initial load with no payload: the drawer must not claim a report exists.
    result.isLoading.value = true
    expect(api.report.value).toBeNull()
    expect(api.isInitialLoading.value).toBe(true)
    expect(api.canDownload.value).toBe(false)

    result.data.value = makeReport()
    result.isLoading.value = false
    expect(api.report.value).toEqual(makeReport())
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.canDownload.value).toBe(true)

    // A failed refetch masks the retained payload: nothing stale is downloadable.
    result.isError.value = true
    result.error.value = {
      response: { status: 404, data: { statusCode: 404, error: 'SELLER_NOT_FOUND' } },
    }
    expect(api.report.value).toBeNull()
    expect(api.canDownload.value).toBe(false)
    expect(api.failure.value?.kind).toBe('seller-not-found')
    expect(api.errorMessage.value).toContain('vendedor')
  })

  it('guards manual retry against disabled queries and in-flight refetches', async () => {
    const result = setupQueryResult()
    const api = useSellerSalesReport(defaultOptions())

    result.isFetching.value = true
    await api.retry()
    expect(result.refetch).not.toHaveBeenCalled()

    result.isFetching.value = false
    await api.retry()
    expect(result.refetch).toHaveBeenCalledTimes(1)

    const disabled = setupQueryResult()
    const closed = useSellerSalesReport(defaultOptions({ open: false }))
    await closed.retry()
    expect(disabled.refetch).not.toHaveBeenCalled()
  })
})

describe('useSellerSalesReport — PDF download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests a fresh PDF for the seller/window and hands the validated bytes to the browser', async () => {
    const result = setupQueryResult()
    const api = useSellerSalesReport(defaultOptions())
    result.data.value = makeReport()
    const pdf = pdfResult()
    getReportPdf.mockResolvedValue(pdf)

    const downloading = api.download()
    expect(api.isDownloading.value).toBe(true)
    await downloading

    expect(getReportPdf).toHaveBeenCalledTimes(1)
    const [request, context] = getReportPdf.mock.calls[0] ?? []
    expect(request).toEqual({ sellerUserId: SELLER_ID, from: FROM, to: TO })
    expect(context?.tenantId).toBe(TENANT_ID)
    expect(context?.signal).toBeInstanceOf(AbortSignal)
    // The JSON endpoint is never touched by a download.
    expect(vi.mocked(sellerReportApi.getReport)).not.toHaveBeenCalled()
    expect(triggerDownload).toHaveBeenCalledWith(pdf.blob, pdf.fileName)
    expect(api.isDownloading.value).toBe(false)
    expect(api.downloadError.value).toBe('')
  })

  it('refuses to download without an open, permitted, identified and in-range context', async () => {
    const attempts: Record<string, number> = {}
    for (const overrides of [
      { open: false },
      { canRead: false },
      { sellerUserId: null },
      { tenantId: null },
      { from: TO, to: FROM },
    ]) {
      setupQueryResult()
      const api = useSellerSalesReport(defaultOptions(overrides))
      await api.download()
      attempts[JSON.stringify(overrides)] = getReportPdf.mock.calls.length
    }

    expect(Object.values(attempts).every((count) => count === 0)).toBe(true)
    expect(triggerDownload).not.toHaveBeenCalled()
  })

  it('aborts and never downloads when the context changes while the request is in flight', async () => {
    const changes: Array<{
      label: string
      apply: (context: ReturnType<typeof makeContextRefs>) => void
    }> = [
      { label: 'seller', apply: (c) => (c.sellerUserId.value = OTHER_SELLER_ID) },
      { label: 'tenant', apply: (c) => (c.tenantId.value = OTHER_TENANT_ID) },
      { label: 'from', apply: (c) => (c.from.value = '2025-02-01') },
      { label: 'to', apply: (c) => (c.to.value = '2025-05-01') },
      { label: 'permission', apply: (c) => (c.canRead.value = false) },
      { label: 'dialog', apply: (c) => (c.open.value = false) },
    ]

    const observed: Record<
      string,
      { aborted: boolean; triggered: number; error: string; loading: boolean }
    > = {}

    for (const change of changes) {
      vi.clearAllMocks()
      setupQueryResult()
      const context = makeContextRefs()
      const api = useSellerSalesReport(context)
      const deferred = createDeferred<SellerReportPdf>()
      getReportPdf.mockReturnValueOnce(deferred.promise)

      const running = api.download()
      await flushPromises()
      const signal = getReportPdf.mock.calls[0]?.[1]?.signal

      change.apply(context)
      await flushPromises()
      // The bytes arrive AFTER the context moved on: they must be discarded.
      deferred.resolve(pdfResult())
      await running

      observed[change.label] = {
        aborted: signal?.aborted ?? false,
        triggered: triggerDownload.mock.calls.length,
        error: api.downloadError.value,
        loading: api.isDownloading.value,
      }
    }

    for (const change of changes) {
      expect(observed[change.label]).toEqual({
        aborted: true,
        triggered: 0,
        error: '',
        loading: false,
      })
    }
  })

  it('ignores a second download while one is already running', async () => {
    setupQueryResult()
    const api = useSellerSalesReport(defaultOptions())
    const deferred = createDeferred<SellerReportPdf>()
    getReportPdf.mockReturnValue(deferred.promise)

    const first = api.download()
    const second = api.download()
    await flushPromises()

    expect(getReportPdf).toHaveBeenCalledTimes(1)

    deferred.resolve(pdfResult())
    await first
    await second
    expect(triggerDownload).toHaveBeenCalledTimes(1)
    expect(api.isDownloading.value).toBe(false)
  })

  it('allows repeating the same filter once the previous download settled', async () => {
    setupQueryResult()
    const api = useSellerSalesReport(defaultOptions())
    getReportPdf.mockResolvedValue(pdfResult())

    await api.download()
    await api.download()

    expect(getReportPdf).toHaveBeenCalledTimes(2)
    expect(triggerDownload).toHaveBeenCalledTimes(2)
  })

  it('treats an abort caused by a context change as a silent cancellation', async () => {
    setupQueryResult()
    const open = ref(true)
    const api = useSellerSalesReport(defaultOptions({ open }))
    const deferred = createDeferred<SellerReportPdf>()
    getReportPdf.mockReturnValueOnce(deferred.promise)

    const running = api.download()
    await flushPromises()
    open.value = false
    await flushPromises()
    deferred.reject({ code: 'ERR_CANCELED' })
    await running

    expect(triggerDownload).not.toHaveBeenCalled()
    expect(api.downloadError.value).toBe('')
    expect(api.isDownloading.value).toBe(false)
  })

  it('maps domain and transport failures to bounded copy', async () => {
    const cases: Array<{ label: string; error: unknown; expected: (message: string) => boolean }> =
      [
        {
          label: 'row limit',
          error: {
            response: {
              status: 422,
              data: { error: 'SELLER_REPORT_ROW_LIMIT_EXCEEDED', rowLimit: 1000, rowCount: 1500 },
            },
          },
          expected: (message) => message.includes('1,500'),
        },
        {
          label: 'pdf generation',
          error: { response: { status: 500, data: { error: 'PDF_GENERATION_FAILED' } } },
          expected: (message) => message.includes('PDF'),
        },
        {
          label: 'network',
          error: new Error('Network Error'),
          expected: (message) => message === SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE,
        },
        {
          label: 'non-pdf body',
          error: new Error('SELLER_REPORT_PDF_NON_PDF_BODY'),
          expected: (message) => message === SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE,
        },
      ]

    const observed: Record<string, boolean> = {}
    for (const testCase of cases) {
      vi.clearAllMocks()
      setupQueryResult()
      const api = useSellerSalesReport(defaultOptions())
      getReportPdf.mockRejectedValue(testCase.error)

      await api.download()

      observed[testCase.label] = testCase.expected(api.downloadError.value)
      expect(triggerDownload).not.toHaveBeenCalled()
      expect(api.isDownloading.value).toBe(false)
      expect(api.downloadError.value).not.toMatch(/[A-Z_]{6,}/)
    }

    expect(observed).toEqual({
      'row limit': true,
      'pdf generation': true,
      network: true,
      'non-pdf body': true,
    })
  })

  it('reports no failure when the context moved on before the request rejected', async () => {
    setupQueryResult()
    const open = ref(true)
    const api = useSellerSalesReport(defaultOptions({ open }))
    const deferred = createDeferred<SellerReportPdf>()
    getReportPdf.mockReturnValueOnce(deferred.promise)

    const running = api.download()
    await flushPromises()
    open.value = false
    await flushPromises()
    deferred.reject({ response: { status: 500, data: { error: 'PDF_GENERATION_FAILED' } } })
    await running

    expect(api.downloadError.value).toBe('')
  })

  it('aborts an in-flight download when its scope is torn down', async () => {
    setupQueryResult()
    const scope = effectScope()
    const api = scope.run(() => useSellerSalesReport(defaultOptions()))!
    const deferred = createDeferred<SellerReportPdf>()
    getReportPdf.mockReturnValueOnce(deferred.promise)

    void api.download()
    await flushPromises()
    const signal = getReportPdf.mock.calls[0]?.[1]?.signal

    scope.stop()

    expect(signal?.aborted).toBe(true)
    deferred.resolve(pdfResult())
    await flushPromises()
    expect(triggerDownload).not.toHaveBeenCalled()
  })
})

function makeContextRefs() {
  return {
    tenantId: ref(TENANT_ID),
    sellerUserId: ref<string | null>(SELLER_ID),
    from: ref(FROM),
    to: ref(TO),
    open: ref(true),
    canRead: ref(true),
  }
}
