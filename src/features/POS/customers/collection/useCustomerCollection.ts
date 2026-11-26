/**
 * useCustomerCollection.ts — the «Cobrar todo» flow (handoff 30 §9).
 *
 * - Opening previews without tenders (order, overdue marks, `debtCents`).
 * - Every tender change previews again ~300 ms after the last change; a response that is not
 *   the latest request is dropped, and the preview counts as loading from the first keystroke.
 * - Confirm is off while the preview loads or failed, without valid tenders (1-5, ≥ 1 cent) or
 *   without the caller's open cash session.
 * - One idempotency key per submission. After an uncertain outcome (network failure,
 *   `IDEMPOTENCY_KEY_IN_FLIGHT`, any 5xx, a non-4xx status or a 4xx without a JSON body) the key
 *   AND body stay unresolved per signed-in user + tenant + customer at module scope, so closing,
 *   reopening or remounting the sheet keeps them: tender edits are ignored and confirm/`retry()`
 *   resend exactly that submission until a definitive answer (success or any 4xx with a JSON
 *   body) frees it; that 4xx gives the next confirm a new key. A user change or a sign-out drops
 *   every unresolved submission: another cashier never resends one with someone else's session.
 * - `409 COLLECTION_DEBT_CHANGED`: «La deuda del cliente cambió», the screen shows `body.preview`
 *   and a new confirm is required. `IDEMPOTENCY_KEY_IN_FLIGHT`: a short wait and one retry with
 *   the same key and body. Any other answer: its message, and the preview is refreshed.
 * - Success refreshes the customer history (and its metrics), the monthly chart, the sales lists
 *   and the detail of every sale that received money.
 */
import {
  computed,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  reactive,
  shallowRef,
  toValue,
  watch,
} from 'vue'
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

const UNCERTAIN =
  'No sabemos si el cobro se registró. Vuelve a confirmar con los mismos montos; no se duplicará.'

/**
 * Whether an apply answer guarantees nothing was written, so the key is free: any 4xx with a JSON
 * error body (handoff 30 §5.2, §8: every 4xx is decided before or instead of the write), except
 * `IDEMPOTENCY_KEY_IN_FLIGHT`, which means the same key is still being processed.
 */
const isDefinitive = (failure: CollectionFailure) => {
  const status = failure.status ?? 0
  return (
    !failure.network &&
    failure.code !== 'IDEMPOTENCY_KEY_IN_FLIGHT' &&
    status >= 400 &&
    status < 500 &&
    !!failure.hasBody
  )
}

interface UnresolvedSubmission {
  key: string
  body: CollectionApplyBody
}

/**
 * Submissions whose outcome is unknown, per `userId:tenantId:customerId`. Module scope on purpose:
 * the sheet may unmount (close, customer change) and a fresh key would risk a second collection.
 */
const unresolved = reactive(new Map<string, UnresolvedSubmission>())

/** Id of the signed-in user, `''` when nobody is (or the auth store is not available). */
function signedInUserId(): string {
  try {
    return useAuthStore().user?.id ?? ''
  } catch {
    return ''
  }
}

let watchingSession = false
/**
 * One module-level watcher (it outlives every sheet): a user change or a sign-out drops every
 * unresolved submission, even with no sheet mounted. Same approach as the live chat stores.
 */
function watchSession() {
  if (watchingSession) return
  watchingSession = true
  effectScope(true).run(() => {
    watch(signedInUserId, () => unresolved.clear(), { flush: 'sync' })
  })
}

const scopeOf = (tenantId: string | null | undefined, customerId: string) =>
  `${signedInUserId()}:${tenantId ?? ''}:${customerId}`

/** Whether `customerId` has a collection whose outcome is still unknown (reactive). */
export function hasUnresolvedCollection(
  tenantId: string | null | undefined,
  customerId: string | null | undefined,
): boolean {
  watchSession()
  return !!customerId && unresolved.has(scopeOf(tenantId, customerId))
}

/** Forgets every unresolved submission (tests). */
export function clearUnresolvedCollections() {
  unresolved.clear()
}

const uncertainFailure = (): CollectionFailure => ({
  code: 'UNKNOWN',
  message: UNCERTAIN,
  network: false,
})

export function useCustomerCollection(options: UseCustomerCollectionOptions) {
  const debounceMs = options.debounceMs ?? 300
  const inFlightRetryMs = options.inFlightRetryMs ?? 1500
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  watchSession()

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

  const scope = computed(() => {
    const customerId = toValue(options.customerId)
    return customerId ? scopeOf(authStore.currentTenantId, customerId) : null
  })
  const stored = computed(() => (scope.value ? unresolved.get(scope.value) : undefined))
  /** This instance's first send of a fresh submission: in flight, not yet uncertain. */
  const freshInFlight = shallowRef(false)
  /** A submission may have been written: the sheet stays locked until a definitive answer. */
  const uncertain = computed(() => !!stored.value && !freshInFlight.value)
  const pendingPayments = computed(() => stored.value?.body.payments ?? null)
  const pendingCashSessionId = computed(() => stored.value?.body.cashSessionId ?? null)

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
    // Locked: only the unresolved submission may be resent.
    if (uncertain.value) return
    payments.value = next
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
    payments.value = []
    preview.value = null
    previewLoading.value = false
    previewError.value = null
    result.value = null
    isSubmitting.value = false
    applyError.value = uncertain.value ? uncertainFailure() : null
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
    if (uncertain.value) return !isSubmitting.value && !result.value
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

  function refreshHistory(customerId: string) {
    const tenantId = authStore.currentTenantId ?? ''
    for (const queryKey of [
      saleQueryKeys.customerHistoryPrefix(tenantId, customerId),
      saleQueryKeys.customerMonthlyPrefix(tenantId, customerId),
    ])
      void queryClient.invalidateQueries({ queryKey })
  }

  /** Lets the cashier see whether the unresolved collection landed (history, monthly, debt). */
  function checkOutcome() {
    const customerId = toValue(options.customerId)
    if (!customerId) return
    refreshHistory(customerId)
    refreshPreview()
  }

  function onApplyFailure(failure: CollectionFailure, submission: string, customerId: string) {
    if (!isDefinitive(failure)) {
      // Maybe committed: keep the key and body (stored before sending); no preview refresh, which
      // could lower expectedDebtCents and turn the retry into a second collection.
      const network = failure.network || failure.code === 'IDEMPOTENCY_KEY_IN_FLIGHT'
      applyError.value = network ? failure : { ...failure, message: UNCERTAIN }
      refreshHistory(customerId)
      return
    }
    // A 4xx with a JSON body: nothing was written, the key is free, the next confirm gets a new one.
    unresolved.delete(submission)
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
    const submission = scope.value
    if (!canConfirm.value || !customerId || !submission) return null
    let current = stored.value
    if (!current) {
      const cashSessionId = toValue(options.cashSessionId)
      if (!cashSessionId || !preview.value) return null
      current = {
        key: newIdempotencyKey(),
        body: {
          payments: payments.value,
          cashSessionId,
          expectedDebtCents: preview.value.debtCents,
        },
      }
      // Unresolved from the moment it leaves: an unmount mid-request still keeps the key.
      unresolved.set(submission, current)
      freshInFlight.value = true
    }
    const { key, body } = current

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
      unresolved.delete(submission)
      result.value = data
      refreshAfterSuccess(data, customerId)
      return data
    } catch (error) {
      onApplyFailure(readCollectionError(error), submission, customerId)
      return null
    } finally {
      isSubmitting.value = false
      freshInFlight.value = false
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
    uncertain,
    pendingPayments,
    pendingCashSessionId,
    setPayments,
    refreshPreview,
    confirm,
    /** Resends the unresolved submission with the same key and body; no-op without one. */
    retry: () => (uncertain.value ? confirm() : Promise.resolve(null)),
    checkOutcome,
  }
}
