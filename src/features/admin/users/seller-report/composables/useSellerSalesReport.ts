import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { useQuery } from '@tanstack/vue-query'
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
  SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE,
  sellerReportFailureMessage,
} from '../utils/sellerReportPresentation'
import { triggerSellerReportPdfDownload } from '../utils/sellerReportDownload'

/**
 * useSellerSalesReport.ts — one seller report: its on-screen query and its PDF
 * download flow.
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
 *     disables downloading. Everything the UI shows comes from one validated
 *     snapshot.
 *
 * Download contract:
 *   - Downloading asks the backend for a FRESH PDF for the same seller/window
 *     (`GET …/report/pdf`). The bytes are an independent server snapshot: the
 *     browser neither renders HTML nor recalculates a metric, and the on-screen
 *     JSON payload is never reused as the document.
 *   - One run at a time: a second request while one is in flight is ignored, and
 *     a completed run can be repeated for the same filter.
 *   - Identity, permission, seller, window and drawer visibility are fenced
 *     before the request AND after the response (including the bounded blob
 *     parse). Any change aborts the in-flight request and discards its bytes, so
 *     a tenant switch, a permission revoke, a seller/window change or a drawer
 *     close can never download a document that no longer matches the screen.
 *   - Loading ownership is token-based: a run only clears the loading flag it
 *     owns, so a superseded/cancelled run cannot strand or hijack the UI.
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
  /** Drawer visibility. A closed report issues no request and cannot download. */
  open: MaybeRefOrGetter<boolean>
  /** Single permission authority: `read:User` AND `read:Sale` AND `read:Analytics`. */
  canRead: MaybeRefOrGetter<boolean>
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
  canDownload: ComputedRef<boolean>
  isDownloading: ComputedRef<boolean>
  /** Download-specific failure copy; empty while nothing failed. */
  downloadError: ComputedRef<string>
  retry: () => Promise<void>
  download: () => Promise<void>
}

/** The exact context a download run was started for. */
interface SellerReportDownloadContext {
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

  const query = useQuery({
    queryKey: computed(() => sellerSalesReportQueryKeys.report(tenantId.value, request.value)),
    queryFn: ({ signal }) =>
      sellerReportApi.getReport(request.value, { tenantId: tenantId.value, signal }),
    enabled: isEnabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  const isDownloadingFlag = ref(false)
  const downloadErrorFlag = ref('')
  // The run that currently owns the loading flag. Only this run may clear it.
  let activeDownloadController: AbortController | null = null

  /**
   * Every fact a download depends on. A change invalidates whatever is in
   * flight: the bytes it will return no longer belong to the current state.
   */
  const downloadContextSignature = computed(() =>
    [tenantId.value, sellerUserId.value, from.value, to.value, isOpen.value, canRead.value].join(
      '\u0000',
    ),
  )
  const stopDownloadContextWatch = watch(downloadContextSignature, () => {
    activeDownloadController?.abort()
  })

  // A report may be unmounted mid-download (drawer closed, route left): the
  // request must not outlive its owner.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopDownloadContextWatch()
      activeDownloadController?.abort()
    })
  }

  /** Mask the payload on failure: nothing stale may be shown or downloaded. */
  const report = computed<SellerSalesReport | null>(() =>
    query.isError.value ? null : (query.data.value ?? null),
  )
  const failure = computed(() =>
    query.isError.value ? parseSellerReportFailure(query.error.value) : null,
  )
  const errorMessage = computed(() =>
    failure.value ? sellerReportFailureMessage(failure.value) : null,
  )

  function currentDownloadContext(): SellerReportDownloadContext | null {
    if (!isEnabled.value) return null
    return {
      tenantId: tenantId.value,
      sellerUserId: sellerUserId.value,
      from: from.value,
      to: to.value,
    }
  }

  /** True while every fact the download run started with is still the current one. */
  function isDownloadContextCurrent(context: SellerReportDownloadContext): boolean {
    return (
      isEnabled.value &&
      tenantId.value === context.tenantId &&
      sellerUserId.value === context.sellerUserId &&
      from.value === context.from &&
      to.value === context.to
    )
  }

  /** A domain error explains itself; anything else is the generic download copy. */
  function downloadFailureMessage(error: unknown): string {
    const parsed = parseSellerReportFailure(error)
    return parsed.kind === 'unknown'
      ? SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE
      : sellerReportFailureMessage(parsed)
  }

  async function retry(): Promise<void> {
    if (!isEnabled.value || query.isFetching.value) return
    await query.refetch()
  }

  async function download(): Promise<void> {
    // One download at a time: a repeat while a request is in flight is ignored,
    // but the same filter may be downloaded again once the run settles.
    if (isDownloadingFlag.value) return

    const context = currentDownloadContext()
    if (!context) return

    const controller = new AbortController()
    activeDownloadController = controller
    isDownloadingFlag.value = true
    downloadErrorFlag.value = ''

    try {
      const request: SellerReportRequest = {
        sellerUserId: context.sellerUserId,
        from: context.from,
        to: context.to,
      }

      const { blob, fileName } = await sellerReportApi.getReportPdf(request, {
        tenantId: context.tenantId,
        signal: controller.signal,
      })

      // Fence after the await AND after the bounded blob parse: the bytes must
      // belong to the context that is still on screen.
      if (controller.signal.aborted || !isDownloadContextCurrent(context)) return

      triggerSellerReportPdfDownload(blob, fileName)
    } catch (error) {
      // A cancelled run is not a failure to report: the user moved on.
      if (controller.signal.aborted) return
      if (isDownloadContextCurrent(context)) {
        downloadErrorFlag.value = downloadFailureMessage(error)
      }
    } finally {
      if (activeDownloadController === controller) {
        activeDownloadController = null
        isDownloadingFlag.value = false
      }
    }
  }

  return {
    report,
    isInitialLoading: computed(() => query.isLoading.value && query.data.value === undefined),
    isFetching: computed(() => query.isFetching.value),
    isError: computed(() => query.isError.value),
    failure,
    errorMessage,
    canDownload: computed(() => report.value !== null && !isDownloadingFlag.value),
    isDownloading: computed(() => isDownloadingFlag.value),
    downloadError: computed(() => downloadErrorFlag.value),
    retry,
    download,
  }
}
