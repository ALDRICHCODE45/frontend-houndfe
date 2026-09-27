// useSellerSalesReport.spec.ts — query identity/guards plus the fresh-snapshot
// print orchestration.
//
// Mutation-sensitive: sending the tenant identity to the API, enabling the query
// without open + permissions + seller + a valid window, keeping stale data
// visible after a failure, printing the cached (stale) payload instead of a
// fresh refetch, skipping the identity/permission recheck after the await or
// after the frame load, reusing the document when the refresh failed, or leaking
// the isolated session on scope teardown fails at least one of these tests.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { effectScope, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { sellerReportApi } from '../../api/sellerReport.api'
import { sellerSalesReportQueryKeys } from '../../query-keys'
import {
  SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE,
  SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE,
} from '../../utils/sellerReportPresentation'
import { useSellerSalesReport } from '../useSellerSalesReport'
import type { SellerSalesReport } from '../../interfaces/seller-report.types'
import type { SellerReportPrinter } from '../../utils/sellerReportPrint'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQuery: vi.fn(), useQueryClient: vi.fn() }
})

vi.mock('../../api/sellerReport.api', () => ({
  sellerReportApi: { getReport: vi.fn() },
}))

const SELLER_ID = '8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f'
const OTHER_SELLER_ID = '00000000-1111-4222-8333-444444444444'
const TENANT_ID = '11111111-2222-4333-8444-555555555555'
const FROM = '2025-03-01'
const TO = '2025-04-01'

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

const fetchQuery = vi.fn()

function capturedOptions(): CapturedQueryOptions {
  const calls = vi.mocked(useQuery).mock.calls
  const call = calls[calls.length - 1]
  if (!call) throw new Error('useQuery was not called')
  return call[0] as unknown as CapturedQueryOptions
}

interface FakeSession {
  html: string
  ready: Promise<void>
  settle: () => void
  fail: (error: unknown) => void
  commit: Mock<() => void>
  dispose: Mock<() => void>
}

function createFakePrinter() {
  const sessions: FakeSession[] = []
  let settleReady: (() => void) | null = null
  let failReady: ((error: unknown) => void) | null = null

  const printer: SellerReportPrinter = {
    mount: vi.fn((html: string) => {
      const session: FakeSession = {
        html,
        ready: new Promise<void>((resolve, reject) => {
          settleReady = resolve
          failReady = reject
        }),
        settle: () => settleReady?.(),
        fail: (error: unknown) => failReady?.(error),
        commit: vi.fn((): void => {}),
        dispose: vi.fn((): void => {}),
      }
      sessions.push(session)
      return {
        ready: session.ready,
        // Wrapper arrows: the returned session keeps the plain port shape while
        // the fake keeps its spies for assertions.
        commit: () => session.commit(),
        dispose: () => session.dispose(),
      }
    }),
  }

  return { printer, sessions }
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
    vi.mocked(useQueryClient).mockReturnValue({ fetchQuery } as never)
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
    expect(api.canPrint.value).toBe(false)

    result.data.value = makeReport()
    result.isLoading.value = false
    expect(api.report.value).toEqual(makeReport())
    expect(api.isInitialLoading.value).toBe(false)
    expect(api.canPrint.value).toBe(true)

    // A failed refetch masks the retained payload: nothing stale is printable.
    result.isError.value = true
    result.error.value = {
      response: { status: 404, data: { statusCode: 404, error: 'SELLER_NOT_FOUND' } },
    }
    expect(api.report.value).toBeNull()
    expect(api.canPrint.value).toBe(false)
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

describe('useSellerSalesReport — fresh snapshot printing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useQueryClient).mockReturnValue({ fetchQuery } as never)
    fetchQuery.mockReset()
  })

  it('refetches a fresh validated snapshot and prints only that document', async () => {
    const result = setupQueryResult()
    const { printer, sessions } = createFakePrinter()
    const api = useSellerSalesReport(defaultOptions({ printer }))
    result.data.value = makeReport()

    const fresh = makeReport({
      rowCount: 1,
      confirmed: {
        dateBasis: 'confirmedAt',
        summary: {
          saleCount: 1,
          netSalesCents: 232_000,
          collectedCents: 32_000,
          outstandingDebtCents: 200_000,
          averageTicketCents: 232_000,
        },
        rows: [
          {
            id: 'a1111111-1111-4111-8111-111111111111',
            folio: 'F-9999',
            confirmedAt: '2025-03-05T18:30:00.000Z',
            totalCents: 232_000,
            paidCents: 32_000,
            debtCents: 200_000,
            paymentStatus: 'PARTIAL',
          },
        ],
      },
    })
    fetchQuery.mockResolvedValue(fresh)

    const printing = api.print()
    expect(api.isPrinting.value).toBe(true)

    await flushPromises()
    expect(fetchQuery).toHaveBeenCalledTimes(1)
    const fetchOptions = fetchQuery.mock.calls[0]?.[0] as Record<string, unknown>
    expect(fetchOptions.queryKey).toEqual(
      sellerSalesReportQueryKeys.report(TENANT_ID, {
        sellerUserId: SELLER_ID,
        from: FROM,
        to: TO,
      }),
    )
    expect(fetchOptions.staleTime).toBe(0)
    expect(fetchOptions.gcTime).toBe(0)
    expect(fetchOptions.retry).toBe(false)

    const session = sessions[0]!
    // The FRESH row is in the document, and the stale cached payload is not.
    expect(session.html).toContain('F-9999')
    expect(session.html).not.toContain('$1,160.00')
    expect(session.commit).not.toHaveBeenCalled()

    session.settle()
    await printing

    expect(session.commit).toHaveBeenCalledTimes(1)
    expect(session.dispose).not.toHaveBeenCalled()
    expect(api.isPrinting.value).toBe(false)
    expect(api.printError.value).toBe('')
  })

  it('never opens a document when the fresh refetch fails', async () => {
    setupQueryResult()
    const { printer, sessions } = createFakePrinter()
    const api = useSellerSalesReport(defaultOptions({ printer }))
    fetchQuery.mockRejectedValue({
      response: {
        status: 422,
        data: { error: 'SELLER_REPORT_ROW_LIMIT_EXCEEDED', rowLimit: 1000, rowCount: 1500 },
      },
    })

    await api.print()

    expect(sessions).toHaveLength(0)
    expect(printer.mount).not.toHaveBeenCalled()
    expect(api.isPrinting.value).toBe(false)
    expect(api.printError.value).toContain('1,500')
  })

  it('reports an unexpected refresh failure with the refresh copy', async () => {
    setupQueryResult()
    const { printer } = createFakePrinter()
    const api = useSellerSalesReport(defaultOptions({ printer }))
    fetchQuery.mockRejectedValue(new Error('Network Error'))

    await api.print()

    expect(printer.mount).not.toHaveBeenCalled()
    expect(api.printError.value).toBe(SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE)
  })

  it('rechecks identity and permission after the refresh await', async () => {
    setupQueryResult()
    const canRead = ref(true)
    const seller = ref<string | null>(SELLER_ID)
    const { printer } = createFakePrinter()
    const api = useSellerSalesReport(defaultOptions({ canRead, sellerUserId: seller, printer }))

    const deferred = createDeferred<SellerSalesReport>()
    fetchQuery.mockReturnValue(deferred.promise)

    const printing = api.print()
    await flushPromises()

    // The permission is revoked while the refresh is in flight.
    canRead.value = false
    seller.value = OTHER_SELLER_ID
    deferred.resolve(makeReport())
    await printing

    expect(printer.mount).not.toHaveBeenCalled()
    expect(api.printError.value).toBe('')
  })

  it('does not commit when the context is lost while the isolated document loads', async () => {
    setupQueryResult()
    const open = ref(true)
    const { printer, sessions } = createFakePrinter()
    const api = useSellerSalesReport(defaultOptions({ open, printer }))
    fetchQuery.mockResolvedValue(makeReport())
    const printing = api.print()
    await flushPromises()

    const session = sessions[0]!
    expect(session.commit).not.toHaveBeenCalled()

    // The drawer is closed while the frame is still loading.
    open.value = false
    session.settle()
    await printing

    expect(session.commit).not.toHaveBeenCalled()
    expect(session.dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes the isolated session and reports a dialog failure when the load fails', async () => {
    setupQueryResult()
    const { printer, sessions } = createFakePrinter()
    const api = useSellerSalesReport(defaultOptions({ printer }))
    fetchQuery.mockResolvedValue(makeReport())

    const printing = api.print()
    await flushPromises()

    const session = sessions[0]!
    session.fail(new Error('frame exploded'))
    await printing

    expect(session.commit).not.toHaveBeenCalled()
    expect(session.dispose).toHaveBeenCalledTimes(1)
    expect(api.printError.value).toBe(SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE)
  })

  it('ignores a second print request while one is already running', async () => {
    setupQueryResult()
    const { printer, sessions } = createFakePrinter()
    const api = useSellerSalesReport(defaultOptions({ printer }))
    fetchQuery.mockResolvedValue(makeReport())

    const first = api.print()
    const second = api.print()
    await flushPromises()

    expect(fetchQuery).toHaveBeenCalledTimes(1)
    expect(printer.mount).toHaveBeenCalledTimes(1)

    sessions[0]!.settle()
    await first
    await second
    expect(sessions).toHaveLength(1)
  })

  it('refuses to print without an open, permitted and identified context', async () => {
    for (const overrides of [
      { open: false },
      { canRead: false },
      { sellerUserId: null },
      { from: '2025-04-01', to: '2025-03-01' },
    ]) {
      setupQueryResult()
      const { printer } = createFakePrinter()
      const api = useSellerSalesReport(defaultOptions({ printer, ...overrides }))

      await api.print()

      expect(printer.mount).not.toHaveBeenCalled()
    }
    expect(fetchQuery).not.toHaveBeenCalled()
  })

  it('disposes a pending session when its scope is torn down', async () => {
    setupQueryResult()
    const { printer, sessions } = createFakePrinter()
    const scope = effectScope()
    fetchQuery.mockResolvedValue(makeReport())

    const api = scope.run(() => useSellerSalesReport(defaultOptions({ printer })))!

    void api.print()
    await flushPromises()
    expect(sessions).toHaveLength(1)

    scope.stop()

    expect(sessions[0]!.dispose).toHaveBeenCalledTimes(1)
    expect(sessions[0]!.commit).not.toHaveBeenCalled()
  })
})
