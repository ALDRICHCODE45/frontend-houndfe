import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { isValidMexicoCityDateRange } from '@/core/shared/utils/mexicoCityCalendar'
import { sellerReportApi } from '../api/sellerReport.api'
import { sellerSalesReportQueryKeys } from '../query-keys'
import {
  parseSellerReportFailure,
  type SellerReportFailure,
  type SellerReportRequest,
  type SellerSalesReport,
} from '../interfaces/seller-report.types'
import {
  SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE,
  SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE,
  sellerReportFailureMessage,
} from '../utils/sellerReportPresentation'
import {
  createSellerReportPrinter,
  renderSellerReportDocumentHtml,
  type SellerReportPrintSession,
  type SellerReportPrinter,
} from '../utils/sellerReportPrint'

/**
 * useSellerSalesReport.ts — one seller report: its query and its print flow.
 *
 * Query contract:
 *   - The key carries tenant + seller + both boundaries. The tenant is cache
 *     isolation only and is NEVER sent; the request body is exactly
 *     `{ sellerUserId, from, to }`.
 *   - `enabled` requires ALL of: the drawer open, the caller's permission
 *     (`read:User` AND `read:Sale` AND `read:Analytics`, decided by the view), a
 *     resolved tenant, a seller identity, and a valid Mexico City `[from,to)`
 *     window of at most 366 days. A denied or half-specified context issues no
 *     request at all.
 *   - `staleTime: 0` + `gcTime: 0` + `retry: false` + no placeholder, because a
 *     report is a point-in-time accounting statement: a cached or speculative
 *     payload must never be presented as current, and a failed request must
 *     surface as a failure instead of an automatic retry storm.
 *   - A failure MASKS the retained payload (`report` becomes undefined) and
 *     disables printing. Everything the UI shows and prints therefore comes from
 *     one validated snapshot.
 *
 * Print contract:
 *   - Printing refetches a FRESH snapshot through `queryClient.fetchQuery` with
 *     the same key and no caching, validates it through the API boundary, and
 *     prints ONLY that snapshot inside an isolated document. A stale payload is
 *     never reused, and a failed refresh prints nothing.
 *   - Identity, permission, seller and window are rechecked after the refresh
 *     await AND after the isolated document loads; if any of them changed, the
 *     document is disposed and nothing is committed.
 *   - Print failures are reported separately from load failures, and the session
 *     is disposed on every failure path and on scope teardown.
 */

export interface UseSellerSalesReportOptions {
  /** Tenant identity. Cache isolation only — never sent to the API. */
  tenantId: MaybeRefOrGetter<string | null | undefined>
  /** Seller UUID the report belongs to; also the request path segment. */
  sellerUserId: MaybeRefOrGetter<string | null | undefined>
  /** Inclusive `YYYY-MM-DD` Mexico City boundary. */
  from: MaybeRefOrGetter<string>
  /** Exclusive `YYYY-MM-DD` Mexico City boundary. */
  to: MaybeRefOrGetter<string>
  /** Drawer visibility. A closed report issues no request and cannot print. */
  open: MaybeRefOrGetter<boolean>
  /** Single permission authority: `read:User` AND `read:Sale` AND `read:Analytics`. */
  canRead: MaybeRefOrGetter<boolean>
  /** Injectable isolated-document printer (deterministic lifecycle tests). */
  printer?: SellerReportPrinter
}

export interface UseSellerSalesReportResult {
  /** The validated snapshot, or `null` while loading, idle or after a failure. */
  report: ComputedRef<SellerSalesReport | null>
  isInitialLoading: ComputedRef<boolean>
  isFetching: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  /** Normalized failure, or `null` on success/loading. */
  failure: ComputedRef<SellerReportFailure | null>
  /** Actionable Spanish copy for `failure`, or `null`. */
  errorMessage: ComputedRef<string | null>
  canPrint: ComputedRef<boolean>
  isPrinting: ComputedRef<boolean>
  /** Print-specific failure copy; empty while nothing failed. */
  printError: ComputedRef<string>
  retry: () => Promise<void>
  print: () => Promise<void>
}

/** The exact context a print run was started for. */
interface SellerReportPrintContext {
  tenantId: string
  sellerUserId: string
  from: string
  to: string
}

export function useSellerSalesReport(
  options: UseSellerSalesReportOptions,
): UseSellerSalesReportResult {
  const tenantId = computed(() => (toValue(options.tenantId) ?? '').trim())
  const sellerUserId = computed(() => (toValue(options.sellerUserId) ?? '').trim())
  const from = computed(() => toValue(options.from))
  const to = computed(() => toValue(options.to))
  const isOpen = computed(() => toValue(options.open))
  const canRead = computed(() => toValue(options.canRead))

  const hasValidRange = computed(() => isValidMexicoCityDateRange(from.value, to.value))
  /** The single enable guard: open + permission + identity + a valid window. */
  const isEnabled = computed(
    () =>
      isOpen.value &&
      canRead.value &&
      tenantId.value !== '' &&
      sellerUserId.value !== '' &&
      hasValidRange.value,
  )

  const request = computed<SellerReportRequest>(() => ({
    sellerUserId: sellerUserId.value,
    from: from.value,
    to: to.value,
  }))

  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: computed(() => sellerSalesReportQueryKeys.report(tenantId.value, request.value)),
    queryFn: ({ signal }) =>
      sellerReportApi.getReport(request.value, { tenantId: tenantId.value, signal }),
    enabled: isEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  const printer = options.printer ?? createSellerReportPrinter()
  const isPrintingFlag = ref(false)
  const printErrorFlag = ref('')
  let activeSession: SellerReportPrintSession | null = null

  // A report may be unmounted mid-print (drawer closed, route left): the
  // isolated frame must not outlive its owner.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      activeSession?.dispose()
      activeSession = null
    })
  }

  /** Mask the payload on failure: nothing stale may be shown or printed. */
  const report = computed<SellerSalesReport | null>(() =>
    query.isError.value ? null : (query.data.value ?? null),
  )
  const failure = computed(() =>
    query.isError.value ? parseSellerReportFailure(query.error.value) : null,
  )
  const errorMessage = computed(() =>
    failure.value ? sellerReportFailureMessage(failure.value) : null,
  )

  function currentPrintContext(): SellerReportPrintContext | null {
    if (!isEnabled.value) return null
    return {
      tenantId: tenantId.value,
      sellerUserId: sellerUserId.value,
      from: from.value,
      to: to.value,
    }
  }

  /** True while every fact the print run started with is still the current one. */
  function isContextCurrent(context: SellerReportPrintContext): boolean {
    return (
      isEnabled.value &&
      tenantId.value === context.tenantId &&
      sellerUserId.value === context.sellerUserId &&
      from.value === context.from &&
      to.value === context.to
    )
  }

  /** Refresh-failure copy: a domain error explains itself, anything else is generic. */
  function refreshFailureMessage(error: unknown): string {
    const parsed = parseSellerReportFailure(error)
    return parsed.kind === 'unknown'
      ? SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE
      : sellerReportFailureMessage(parsed)
  }

  async function retry(): Promise<void> {
    if (!isEnabled.value || query.isFetching.value) return
    await query.refetch()
  }

  async function print(): Promise<void> {
    // One print run at a time: a second request while a dialog is opening must
    // not mount a parallel document.
    if (isPrintingFlag.value) return

    const context = currentPrintContext()
    if (!context) return

    isPrintingFlag.value = true
    printErrorFlag.value = ''
    let session: SellerReportPrintSession | null = null
    let stage: 'refresh' | 'document' = 'refresh'

    try {
      const request: SellerReportRequest = {
        sellerUserId: context.sellerUserId,
        from: context.from,
        to: context.to,
      }

      // Fresh, freshly validated snapshot: never the cached payload, never a
      // placeholder, never the previous window.
      const snapshot = await queryClient.fetchQuery({
        queryKey: sellerSalesReportQueryKeys.report(context.tenantId, request),
        queryFn: () => sellerReportApi.getReport(request, { tenantId: context.tenantId }),
        staleTime: 0,
        gcTime: 0,
        retry: false,
      })

      if (!isContextCurrent(context)) return

      stage = 'document'
      session = printer.mount(renderSellerReportDocumentHtml(snapshot))
      activeSession = session
      await session.ready

      // The frame load is another await: what was approved at the start of the
      // run may no longer be true.
      if (!isContextCurrent(context)) {
        session.dispose()
        return
      }

      session.commit()
    } catch (error) {
      session?.dispose()
      // A context that moved on is not a failure to report: the user did not ask
      // for this report any more.
      if (isContextCurrent(context)) {
        printErrorFlag.value =
          stage === 'document'
            ? SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE
            : refreshFailureMessage(error)
      }
    } finally {
      if (activeSession === session) activeSession = null
      isPrintingFlag.value = false
    }
  }

  return {
    report,
    isInitialLoading: computed(() => query.isLoading.value && query.data.value === undefined),
    isFetching: computed(() => query.isFetching.value),
    isError: computed(() => query.isError.value),
    failure,
    errorMessage,
    canPrint: computed(() => report.value !== null && !isPrintingFlag.value),
    isPrinting: computed(() => isPrintingFlag.value),
    printError: computed(() => printErrorFlag.value),
    retry,
    print,
  }
}
