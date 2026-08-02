/**
 * `useQuotationDraft.ts` — write-side composable for the Quotations module.
 *
 * Mirrors the `useSalesDrafts` shape (one composable owning every per-draft
 * mutation) but trimmed to the four item mutations owned by Slice 5
 * (REQ-QTN-005 / REQ-QTN-006 / REQ-QTN-015 — see `tasks.md` §S5). The
 * `assignCustomer` and `changePriceList` mutations stay on `useQuotationDetail`
 * (Slice 4) and will migrate here in a later slice; nothing in this file
 * touches that seam.
 *
 * Each mutation:
 *   1. Calls the relevant `quotationApi` method.
 *   2. Replaces the cached detail + every cached list page with the
 *      backend's response (`setQueryData` / `setQueriesData`) — see
 *      REQ-QTN-015 and design.md §"Data Flow".
 *   3. Toasts a user-facing error when the API rejects, with special care
 *      for 400 (client validation already ran client-side) and 409
 *      (not DRAFT — the only legal edit window).
 *
 * Client-side validation: the backend rejects `quantity < 1` (400) and
 * `unitPriceCents < 0` (400). We pre-check those here so the error
 * path stays out of the network on the common case and the toast
 * wording is identical to what the API would have returned.
 */
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useToast } from '@nuxt/ui/composables/useToast'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { quotationApi } from '../api/quotation.api'
import type {
  CancelReason,
  PaginatedQuotations,
  QuotationResponseDto,
} from '../interfaces/quotation.types'

// ─── Local error surface ───────────────────────────────────────────────────────

interface QuotationItemMutationError extends Error {
  response?: { status?: number }
  status?: number
}

/** Best-effort extraction of the HTTP status attached to an Axios error. */
function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as QuotationItemMutationError
  return e.response?.status ?? e.status
}

/** Surface a localized toast so the cashier sees something useful on failure. */
function toastError(
  toastHandle: { add: (toast: { title: string; description: string; color: string }) => void },
  message: string,
  error: unknown,
): void {
  const status = extractStatus(error)
  const tone: 'info' | 'warning' | 'error' = status === 409 ? 'warning' : 'error'
  toastHandle.add({
    title: status === 409 ? 'Cotización bloqueada' : 'Error',
    description: message,
    color: tone,
  })
}

// ─── Client-side validation ───────────────────────────────────────────────────

/** Throws when quantity is below 1. Mirrors backend §3.7 / §3.8 validation. */
function assertValidQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error('La cantidad debe ser al menos 1')
  }
}

/** Throws when `unitPriceCents` is negative. Mirrors backend §3.10. */
function assertValidPrice(unitPriceCents: number): void {
  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('El precio no puede ser negativo')
  }
}

function userMessageForError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const status = extractStatus(error)
  const innerCode = extractErrorCode(error)

  // Map known backend error messages to user-facing Spanish copy. Anything
  // unrecognized falls through to the raw message — keeps the surface
  // testable (every assertion reads exactly what the backend sent) while
  // letting us localize incrementally per backend doc §8.
  if (status === 409) return 'La cotización ya no admite cambios'
  if (status === 502) return 'Error al enviar, reintentá'
  if (status === 422 && innerCode === 'QUOTATION_HAS_NO_ITEMS') {
    return 'La cotización no tiene productos'
  }
  if (status === 422 && innerCode === 'QUOTATION_CUSTOMER_HAS_NO_EMAIL') {
    return 'El cliente no tiene email'
  }
  if (message.toLowerCase().includes('invalid quantity')) {
    return 'La cantidad debe ser al menos 1'
  }
  if (message.toLowerCase().includes('unitpricecents must be >= 0')) {
    return 'El precio no puede ser negativo'
  }
  return message || 'No se pudo guardar el cambio'
}

/** Extract the `error` code from the backend's structured response body
 *  (e.g. `QUOTATION_HAS_NO_ITEMS`). Returns undefined when the shape
 *  doesn't match — used by 422 mapping for the send endpoint. */
function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const data = (error as { response?: { data?: { error?: unknown } } }).response?.data
  if (!data || typeof data !== 'object') return undefined
  const code = (data as { error?: unknown }).error
  return typeof code === 'string' ? code : undefined
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useQuotationDraft(
  quotationId: MaybeRefOrGetter<string | null | undefined>,
) {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()
  // `useToast` from Nuxt UI — auto-imported in production. Resolved inside
  // the composable (NOT at module top-level) so test mocks set up via
  // `vi.mock('@nuxt/ui/composables/useToast')` can intercept it.
  const toast = useToast()

  const tenantId = computed(() => authStore.currentTenantId)
  const id = computed(() => toValue(quotationId) ?? '')
  const detailKey = computed(() => quotationQueryKeys.detail(tenantId.value, id.value))
  const listKey = computed(() => quotationQueryKeys.list(tenantId.value))

  /**
   * Replace the detail cache + every cached list page with the backend's
   * response (REQ-QTN-015). Mirrors `useQuotationDetail`'s helper exactly so
   * a single helper would be a logical next refactor; kept private here so
   * this slice stays self-contained.
   */
  function updateCaches(updated: QuotationResponseDto, addToList = false): void {
    queryClient.setQueryData(quotationQueryKeys.detail(tenantId.value, updated.id), updated)
    queryClient.setQueriesData<PaginatedQuotations>(
      { queryKey: listKey.value },
      (page) => {
        if (!page) return page
        const exists = page.data.some((quotation) => quotation.id === updated.id)
        if (addToList && !exists) {
          return {
            ...page,
            data: [updated, ...page.data],
            pagination: { ...page.pagination, total: page.pagination.total + 1 },
          }
        }
        return {
          ...page,
          data: page.data.map((quotation) =>
            quotation.id === updated.id ? updated : quotation,
          ),
        }
      },
    )
  }

  // ─── addItem (REQ-QTN-005 / backend §3.7) ──────────────────────────────────

  const addItemMutation = useMutation<
    QuotationResponseDto,
    Error,
    { productId: string; variantId?: string; quantity: number }
  >({
    mutationFn: ({ productId, variantId, quantity }) =>
      quotationApi.addItem(id.value, { productId, variantId, quantity }),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── updateQuantity (REQ-QTN-005 / backend §3.8) ──────────────────────────

  const updateQuantityMutation = useMutation<
    QuotationResponseDto,
    Error,
    { itemId: string; quantity: number }
  >({
    mutationFn: ({ itemId, quantity }) =>
      quotationApi.updateQuantity(id.value, itemId, quantity),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── removeItem (REQ-QTN-005 / backend §3.9) ─────────────────────────────

  const removeItemMutation = useMutation<
    QuotationResponseDto,
    Error,
    string
  >({
    mutationFn: (itemId) => quotationApi.removeItem(id.value, itemId),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── overridePrice (REQ-QTN-006 / backend §3.10) ──────────────────────────

  const overridePriceMutation = useMutation<
    QuotationResponseDto,
    Error,
    { itemId: string; unitPriceCents: number }
  >({
    mutationFn: ({ itemId, unitPriceCents }) =>
      quotationApi.overridePrice(id.value, itemId, unitPriceCents),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── applyManualPromotion (REQ-QTN-007 / backend §3.11) ───────────────────

  const applyManualPromotionMutation = useMutation<
    QuotationResponseDto,
    Error,
    string
  >({
    mutationFn: (promotionId) =>
      quotationApi.applyManualPromotion(id.value, promotionId),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── removeManualPromotion (REQ-QTN-007 / backend §3.11) ──────────────────

  const removeManualPromotionMutation = useMutation<
    QuotationResponseDto,
    Error,
    string
  >({
    mutationFn: (promotionId) =>
      quotationApi.removeManualPromotion(id.value, promotionId),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── vetoPromotion (REQ-QTN-007 / backend §3.12) ─────────────────────────

  const vetoPromotionMutation = useMutation<
    QuotationResponseDto,
    Error,
    string
  >({
    mutationFn: (promotionId) => quotationApi.vetoPromotion(id.value, promotionId),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── unvetoPromotion (REQ-QTN-007 / backend §3.12) ───────────────────────

  const unvetoPromotionMutation = useMutation<
    QuotationResponseDto,
    Error,
    string
  >({
    mutationFn: (promotionId) => quotationApi.unvetoPromotion(id.value, promotionId),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── setExpiry (REQ-QTN-008 / backend §3.13) ─────────────────────────────
  // `expiresAt` is ISO 8601 or `null` (= never expires, per backend §3.13).

  const setExpiryMutation = useMutation<
    QuotationResponseDto,
    Error,
    string | null
  >({
    mutationFn: (expiresAt) => quotationApi.setExpiry(id.value, expiresAt),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── sendQuotation (REQ-QTN-010 / backend §3.14) ──────────────────────────
  // POST /quotations/drafts/:id/send?email=true|false. The backend's atomic:
  // a Resend failure (502) keeps the quotation in DRAFT — the caller can
  // retry without risking an inconsistent state. The success path transitions
  // to SENT and replaces the cache. 422 (no items / no email) and 502 each
  // map to a distinct, user-facing toast via `userMessageForError`.

  const sendMutation = useMutation<
    QuotationResponseDto,
    Error,
    boolean
  >({
    mutationFn: (email) => quotationApi.send(id.value, email),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── cancelQuotation (REQ-QTN-011 / backend §3.15) ───────────────────────
  // POST /quotations/drafts/:id/cancel with a required `cancelReason`. The
  // only business-level error the backend documents is 404 (already covered
  // by the generic toast). Terminal — sets status=CANCELLED + reason.

  const cancelMutation = useMutation<
    QuotationResponseDto,
    Error,
    CancelReason
  >({
    mutationFn: (cancelReason) => quotationApi.cancel(id.value, cancelReason),
    onSuccess: (updated) => updateCaches(updated),
  })

  // ─── Public surface ───────────────────────────────────────────────────────

  // When no quotation id is available (e.g. the `/nueva` create route
  // before `createDraft` returns the new id), return safe no-op stubs so
  // the view can mount without a crash. The template guards (`isDraft`,
  // `v-if`) prevent the user from reaching these until the real id is ready.
  if (!id.value) {
    const noop = async (): Promise<QuotationResponseDto> => {
      throw new Error('No quotation id available — the draft has not been created yet')
    }
    return {
      addItem: noop,
      updateQuantity: noop,
      removeItem: noop,
      overridePrice: noop,
      applyManualPromotion: noop,
      removeManualPromotion: noop,
      vetoPromotion: noop,
      unvetoPromotion: noop,
      setExpiry: noop,
      clearExpiry: noop,
      sendQuotation: noop,
      cancelQuotation: noop,
      isMutating: computed(() => false),
      detailKey,
    }
  }

  async function addItem(productId: string, quantity = 1, variantId?: string): Promise<QuotationResponseDto> {
    assertValidQuantity(quantity)
    try {
      return await addItemMutation.mutateAsync({ productId, variantId, quantity })
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function updateQuantity(itemId: string, quantity: number): Promise<QuotationResponseDto> {
    assertValidQuantity(quantity)
    try {
      return await updateQuantityMutation.mutateAsync({ itemId, quantity })
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function removeItem(itemId: string): Promise<QuotationResponseDto> {
    try {
      return await removeItemMutation.mutateAsync(itemId)
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function overridePrice(itemId: string, unitPriceCents: number): Promise<QuotationResponseDto> {
    assertValidPrice(unitPriceCents)
    try {
      return await overridePriceMutation.mutateAsync({ itemId, unitPriceCents })
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function applyManualPromotion(promotionId: string): Promise<QuotationResponseDto> {
    try {
      return await applyManualPromotionMutation.mutateAsync(promotionId)
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function removeManualPromotion(promotionId: string): Promise<QuotationResponseDto> {
    try {
      return await removeManualPromotionMutation.mutateAsync(promotionId)
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function vetoPromotion(promotionId: string): Promise<QuotationResponseDto> {
    try {
      return await vetoPromotionMutation.mutateAsync(promotionId)
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function unvetoPromotion(promotionId: string): Promise<QuotationResponseDto> {
    try {
      return await unvetoPromotionMutation.mutateAsync(promotionId)
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function setExpiry(expiresAt: string | null): Promise<QuotationResponseDto> {
    try {
      return await setExpiryMutation.mutateAsync(expiresAt)
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  /**
   * Convenience wrapper around `setExpiry(null)` — the cashier-facing label
   * "Quitar expiración" reads more naturally than "Set expiry to never".
   */
  async function clearExpiry(): Promise<QuotationResponseDto> {
    return await setExpiry(null)
  }

  async function sendQuotation(email: boolean = true): Promise<QuotationResponseDto> {
    try {
      const updated = await sendMutation.mutateAsync(email)
      toast.add({
        title: 'Cotización enviada',
        description: email
          ? 'Se envió el PDF al cliente'
          : 'Marcada como enviada',
        color: 'success',
      })
      return updated
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  async function cancelQuotation(cancelReason: CancelReason): Promise<QuotationResponseDto> {
    try {
      const updated = await cancelMutation.mutateAsync(cancelReason)
      toast.add({
        title: 'Cotización cancelada',
        description: 'La cotización pasó a estado cancelado',
        color: 'success',
      })
      return updated
    } catch (error) {
      toastError(toast, userMessageForError(error), error)
      throw error
    }
  }

  const isMutating = computed(
    () =>
      addItemMutation.isPending.value
      || updateQuantityMutation.isPending.value
      || removeItemMutation.isPending.value
      || overridePriceMutation.isPending.value
      || applyManualPromotionMutation.isPending.value
      || removeManualPromotionMutation.isPending.value
      || vetoPromotionMutation.isPending.value
      || unvetoPromotionMutation.isPending.value
      || setExpiryMutation.isPending.value
      || sendMutation.isPending.value
      || cancelMutation.isPending.value,
  )

  return {
    addItem,
    updateQuantity,
    removeItem,
    overridePrice,
    applyManualPromotion,
    removeManualPromotion,
    vetoPromotion,
    unvetoPromotion,
    setExpiry,
    clearExpiry,
    sendQuotation,
    cancelQuotation,
    isMutating,
    detailKey,
  }
}
