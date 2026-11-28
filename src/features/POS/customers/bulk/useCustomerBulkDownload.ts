/**
 * useCustomerBulkDownload.ts — one bulk download of the customers table at a time
 * (customers-bulk-actions S3, handoff 33 «Flujo sugerido»).
 *
 * - The body is built from the current selection on every run, so «Reintentar sin ellos» (404)
 *   removes the missing ids from an ids selection and runs again with what is left. In filter mode
 *   the server re-evaluates the filter (a deleted customer drops out by itself) and `excludeIds` is
 *   never touched — removing from it would re-include customers the user unmarked — so the same
 *   selection is retried once; a second 404 shows the message without another retry.
 * - 429 BULK_EXPORT_BUSY: nothing starts until `retryAfterSeconds` (read from the body; the
 *   Retry-After header is not exposed by CORS) is over, counted down every second. The wait lives
 *   here, not in the dialog: closing it (`reset`) keeps the countdown, `start()` refuses meanwhile
 *   and `waitReason` lets the screen disable its actions with the countdown as the reason.
 * - 400 TOO_LARGE / EMPTY: explain and refetch the table (LISTING_* 400s do not: the table would
 *   get the same 400).
 * - «Cancelar» (or an unmount) aborts the request: nothing is saved and no error shows.
 * - The file is saved only once the whole Blob arrived.
 */
import { computed, getCurrentScope, onScopeDispose, readonly, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { saveBlobAsFile } from '@/core/shared/utils/downloadFile'
import { customerApi } from '../api/customer.api'
import type { CustomerListingSortBy, CustomerListingSortOrder } from '../interfaces/customer-listing.types'
import { validateCustomerStatementRange, type CustomerStatementRange } from '../statement/customerStatementPeriod'
import { customerBulkBusyMessage, customerBulkFailure, type CustomerBulkFailure } from './customerBulkErrors'
import type { CustomerBulkKind, CustomerBulkSelection } from './customerBulkSelection'

export type CustomerBulkRequest = { kind: 'csv' } | { kind: 'statements'; range: CustomerStatementRange }

export function useCustomerBulkDownload(options: {
  selection: () => CustomerBulkSelection | null
  /** The table's sort for the CSV rows. */
  sort: MaybeRefOrGetter<{ sortBy: CustomerListingSortBy; sortOrder: CustomerListingSortOrder }>
  removeIds: (ids: string[]) => void
  refetch: () => void
  onSaved: (fileName: string, kind: CustomerBulkKind) => void
}) {
  const isRunning = shallowRef(false)
  const failure = shallowRef<CustomerBulkFailure | null>(null)
  const retryIn = shallowRef(0)
  const lastRequest = shallowRef<CustomerBulkRequest | null>(null)
  /** The one filter-mode «Reintentar sin ellos» of the current run was used. */
  const filterMissingRetried = shallowRef(false)
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  function stopCountdown() {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  function startCountdown(seconds: number) {
    stopCountdown()
    retryIn.value = seconds
    timer = setInterval(() => {
      retryIn.value = Math.max(0, retryIn.value - 1)
      if (retryIn.value === 0) stopCountdown()
    }, 1_000)
  }

  function cancel() {
    controller?.abort()
    controller = null
    isRunning.value = false
  }

  /** Forget the last error (closing the dialog); a run in flight and a 429 wait are not touched. */
  function reset() {
    failure.value = null
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      cancel()
      stopCountdown()
    })
  }

  /** A new run from the screen (bar action, dialog submit, «Reintentar»). */
  function start(request: CustomerBulkRequest): Promise<boolean> {
    return run(request, true)
  }

  async function run(request: CustomerBulkRequest, fresh: boolean): Promise<boolean> {
    if (isRunning.value || retryIn.value > 0) return false
    if (request.kind === 'statements' && validateCustomerStatementRange(request.range) !== null) return false
    const selection = options.selection()
    if (!selection) return false
    if (fresh) filterMissingRetried.value = false

    const current = new AbortController()
    controller = current
    lastRequest.value = request
    isRunning.value = true
    reset()
    try {
      const file =
        request.kind === 'csv'
          ? await customerApi.bulkExportCustomers({ selection, ...toValue(options.sort) }, { signal: current.signal })
          : await customerApi.bulkCustomerStatements(
              { selection, from: request.range.from, to: request.range.to },
              { signal: current.signal },
            )
      if (current.signal.aborted) return false
      saveBlobAsFile(file.blob, file.fileName)
      options.onSaved(file.fileName, request.kind)
      return true
    } catch (error) {
      if (current.signal.aborted) return false
      const mapped = customerBulkFailure(error, request.kind)
      failure.value = mapped
      if (mapped.retryAfterSeconds) startCountdown(mapped.retryAfterSeconds)
      if (mapped.refetch) options.refetch()
      return false
    } finally {
      if (controller === current) {
        controller = null
        isRunning.value = false
      }
    }
  }

  const error = computed<CustomerBulkFailure | null>(() => {
    const current = failure.value
    if (current?.code !== 'BULK_EXPORT_BUSY') return current
    return { ...current, message: customerBulkBusyMessage(retryIn.value) }
  })

  const canRetry = computed(
    () => !isRunning.value && lastRequest.value !== null && failure.value?.canRetry === true && retryIn.value === 0,
  )

  const missingIds = computed(() => failure.value?.missingIds ?? [])
  /** Retrying without the missing customers leaves someone to download. */
  const canRetryWithoutMissing = computed(() => {
    if (isRunning.value || missingIds.value.length === 0 || lastRequest.value === null) return false
    const selection = options.selection()
    if (!selection) return false
    if (selection.mode === 'filter') return !filterMissingRetried.value
    const gone = new Set(missingIds.value)
    return selection.customerIds.some((id) => !gone.has(id))
  })

  async function retry(): Promise<boolean> {
    if (!canRetry.value || !lastRequest.value) return false
    return start(lastRequest.value)
  }

  async function retryWithoutMissing(): Promise<boolean> {
    if (!canRetryWithoutMissing.value || !lastRequest.value) return false
    if (options.selection()?.mode === 'filter') {
      filterMissingRetried.value = true
      return run(lastRequest.value, false)
    }
    options.removeIds([...missingIds.value])
    return run(lastRequest.value, false)
  }

  /** While a 429 wait runs: why nothing can start (the countdown), else null. */
  const waitReason = computed(() => (retryIn.value > 0 ? customerBulkBusyMessage(retryIn.value) : null))

  return {
    isRunning: readonly(isRunning),
    kind: computed(() => lastRequest.value?.kind ?? null),
    error,
    retryIn: readonly(retryIn),
    waitReason,
    canRetry,
    canRetryWithoutMissing,
    start,
    cancel,
    retry,
    retryWithoutMissing,
    reset,
  }
}
