/**
 * useCustomerStatementDownload.ts — one customer statement PDF download (handoff 29).
 *
 * - The range is validated first (1-366 days, half-open): an invalid one never reaches the wire.
 * - One run at a time: a click while a download is in flight is ignored.
 * - The file is saved only after the complete, validated PDF arrives. A customer change or an
 *   unmount aborts the run, and an aborted run saves nothing and shows no error.
 */
import { getCurrentScope, onScopeDispose, readonly, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { customerApi } from '../api/customer.api'
import {
  customerStatementErrorMessage,
  saveCustomerStatementPdf,
  type CustomerStatementFailure,
} from './customerStatementFile'
import {
  validateCustomerStatementRange,
  type CustomerStatementRange,
} from './customerStatementPeriod'

export function useCustomerStatementDownload(
  customerId: MaybeRefOrGetter<string | null | undefined>,
) {
  const isDownloading = shallowRef(false)
  const error = shallowRef<CustomerStatementFailure | null>(null)
  let controller: AbortController | null = null

  function abort() {
    controller?.abort()
    controller = null
    isDownloading.value = false
  }

  watch(
    () => toValue(customerId),
    () => {
      abort()
      error.value = null
    },
  )
  if (getCurrentScope()) onScopeDispose(abort)

  /** `true` when the PDF was saved. */
  async function download(range: CustomerStatementRange): Promise<boolean> {
    const id = toValue(customerId)
    if (isDownloading.value || !id || validateCustomerStatementRange(range) !== null) return false

    const run = new AbortController()
    controller = run
    isDownloading.value = true
    error.value = null
    try {
      const { blob, fileName } = await customerApi.getStatementPdf(id, range, {
        signal: run.signal,
      })
      if (run.signal.aborted) return false
      saveCustomerStatementPdf(blob, fileName)
      return true
    } catch (failure) {
      if (!run.signal.aborted) error.value = customerStatementErrorMessage(failure)
      return false
    } finally {
      if (controller === run) {
        controller = null
        isDownloading.value = false
      }
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    isDownloading: readonly(isDownloading),
    error: readonly(error),
    download,
    clearError,
  }
}
