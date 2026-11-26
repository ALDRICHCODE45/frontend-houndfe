/**
 * useCustomerCollection.ts — the «Cobrar todo» flow (handoff 30 §9).
 *
 * - Opening previews without tenders (order, overdue marks, `debtCents`).
 * - Every tender change previews again ~300 ms after the last change; a response that is not
 *   the latest request is dropped, and the preview counts as loading from the first keystroke.
 * - Confirm is off while the preview loads or failed, without valid tenders (1-5, ≥ 1 cent) or
 *   without the caller's open cash session.
 * - One idempotency key per submission. It is reused only to resend the very same body after a
 *   network failure or `IDEMPOTENCY_KEY_IN_FLIGHT`; any server answer, a tender change or a
 *   different session/expected debt gives the next submission a new key.
 * - `409 COLLECTION_DEBT_CHANGED`: «La deuda del cliente cambió», the screen shows `body.preview`
 *   and a new confirm is required. `IDEMPOTENCY_KEY_IN_FLIGHT`: a short wait and one retry with
 *   the same key and body. Any other answer: its message, and the preview is refreshed.
 * - Success refreshes the customer history (and its metrics), the monthly chart, the sales lists
 *   and the detail of every sale that received money.
 */
import { computed, getCurrentScope, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { analyticsQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { newIdempotencyKey } from '@/features/POS/sales/utils/idempotency.utils'
import { MAX_PAYMENT_ENTRIES } from '@/features/POS/sales/utils/paymentEntries.utils'
import { customerCollectionApi } from './collection.api'
import { readCollectionError, type CollectionFailure } from './collectionErrors'
import type {
  CollectionApplyBody,
  CollectionPreview,
  CollectionResult,
  CollectionTender,
} from './collection.types'

export interface UseCustomerCollectionOptions {
  customerId: MaybeRefOrGetter<string | null | undefined>
  open: MaybeRefOrGetter<boolean>
  /** The caller's OPEN cash session (required on apply, Q7); `null` keeps confirm off. */
  cashSessionId: MaybeRefOrGetter<string | null | undefined>
  debounceMs?: number
  inFlightRetryMs?: number
}

const isValidTender = (tender: CollectionTender) =>
  Number.isInteger(tender.amountCents) && tender.amountCents >= 1

/** Read-only view of a state ref (no deep readonly typing of the wire shapes). */
const readonly = <T>(state: ShallowRef<T>): Readonly<Ref<T>> => state

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function useCustomerCollection(options: UseCustomerCollectionOptions) {
  const debounceMs = options.debounceMs ?? 300
  const inFlightRetryMs = options.inFlightRetryMs ?? 1500
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  const payments = shallowRef<CollectionTender[]>([])
  const preview = shallowRef<CollectionPreview | null>(null)
  const previewLoading = shallowRef(false)
  const previewError = shallowRef<CollectionFailure | null>(null)
  const result = shallowRef<CollectionResult | null>(null)
  const isSubmitting = shallowRef(false)
  const applyError = shallowRef<CollectionFailure | null>(null)
  const notice = shallowRef<string | null>(null)

  let previewSeq = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  /** The submission whose key may be resent: only for the exact same body. */
  let pending: { key: string; body: string } | null = null

  function clearTimer() {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = null
  }

  async function requestPreview(tenders: CollectionTender[]) {
    const customerId = toValue(options.customerId)
    if (!customerId) return
    const seq = ++previewSeq
    previewLoading.value = true
    previewError.value = null
    try {
      const data = await customerCollectionApi.preview(
        customerId,
        tenders.length > 0 ? { payments: tenders } : {},
      )
      if (seq !== previewSeq) return
      preview.value = data
    } catch (error) {
      if (seq !== previewSeq) return
      previewError.value = readCollectionError(error)
    } finally {
      if (seq === previewSeq) previewLoading.value = false
    }
  }

  function refreshPreview() {
    clearTimer()
    void requestPreview(payments.value.filter(isValidTender))
  }

  function setPayments(next: CollectionTender[]) {
    payments.value = next
    pending = null
    notice.value = null
    applyError.value = null
    clearTimer()
    // Any older response is now stale, and confirm stays off until the new preview lands.
    previewSeq++
    previewLoading.value = true
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void requestPreview(payments.value.filter(isValidTender))
    }, debounceMs)
  }

  function reset() {
    clearTimer()
    previewSeq++
    pending = null
    payments.value = []
    preview.value = null
    previewLoading.value = false
    previewError.value = null
    result.value = null
    isSubmitting.value = false
    applyError.value = null
    notice.value = null
  }

  watch(
    () => [toValue(options.open), toValue(options.customerId)] as const,
    ([open, customerId]) => {
      reset()
      if (open && customerId) void requestPreview([])
    },
    { immediate: true },
  )
  if (getCurrentScope()) onScopeDispose(clearTimer)

  const canConfirm = computed(() => {
    const tenders = payments.value
    return (
      !!preview.value &&
      !previewLoading.value &&
      !previewError.value &&
      !isSubmitting.value &&
      !result.value &&
      tenders.length >= 1 &&
      tenders.length <= MAX_PAYMENT_ENTRIES &&
      tenders.every(isValidTender) &&
      preview.value.appliedCents > 0 &&
      !!toValue(options.cashSessionId)
    )
  })

  function refreshAfterSuccess(collection: CollectionResult, customerId: string) {
    const tenantId = authStore.currentTenantId ?? ''
    const keys: ReadonlyArray<readonly unknown[]> = [
      saleQueryKeys.customerHistoryPrefix(tenantId, customerId),
      saleQueryKeys.customerMonthlyPrefix(tenantId, customerId),
      saleQueryKeys.confirmedPrefix(tenantId),
      saleQueryKeys.dashboardDebt(tenantId),
      saleQueryKeys.dashboardRecent(tenantId),
      analyticsQueryKeys.salesSummaryPrefix(tenantId),
      ...collection.sales.map((sale) => saleQueryKeys.detail(tenantId, sale.saleId)),
    ]
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey })
  }

  function onApplyFailure(failure: CollectionFailure) {
    if (failure.network || failure.code === 'IDEMPOTENCY_KEY_IN_FLIGHT') {
      // Maybe written: only the same key with the same body may follow.
      applyError.value = failure
      return
    }
    // The backend answered and wrote nothing: the key is free, the next confirm gets a new one.
    pending = null
    if (failure.code === 'COLLECTION_DEBT_CHANGED') {
      notice.value = failure.message
      if (failure.preview) {
        clearTimer()
        previewSeq++
        previewLoading.value = false
        previewError.value = null
        preview.value = failure.preview
      } else {
        refreshPreview()
      }
      return
    }
    applyError.value = failure
    if (failure.code !== 'FORBIDDEN') refreshPreview()
  }

  async function confirm(): Promise<CollectionResult | null> {
    const customerId = toValue(options.customerId)
    const cashSessionId = toValue(options.cashSessionId)
    if (!canConfirm.value || !customerId || !cashSessionId || !preview.value) return null

    const body: CollectionApplyBody = {
      payments: payments.value,
      cashSessionId,
      expectedDebtCents: preview.value.debtCents,
    }
    const serialized = JSON.stringify(body)
    if (!pending || pending.body !== serialized)
      pending = { key: newIdempotencyKey(), body: serialized }
    const key = pending.key

    isSubmitting.value = true
    applyError.value = null
    notice.value = null
    try {
      let data: CollectionResult
      try {
        data = await customerCollectionApi.apply(customerId, body, key)
      } catch (error) {
        if (readCollectionError(error).code !== 'IDEMPOTENCY_KEY_IN_FLIGHT') throw error
        await sleep(inFlightRetryMs)
        data = await customerCollectionApi.apply(customerId, body, key)
      }
      pending = null
      result.value = data
      refreshAfterSuccess(data, customerId)
      return data
    } catch (error) {
      onApplyFailure(readCollectionError(error))
      return null
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    payments: readonly(payments),
    preview: readonly(preview),
    previewLoading: readonly(previewLoading),
    previewError: readonly(previewError),
    result: readonly(result),
    isSubmitting: readonly(isSubmitting),
    applyError: readonly(applyError),
    notice: readonly(notice),
    canConfirm,
    setPayments,
    refreshPreview,
    confirm,
  }
}
