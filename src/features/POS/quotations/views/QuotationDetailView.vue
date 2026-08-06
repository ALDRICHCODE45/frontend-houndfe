<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation } from '@tanstack/vue-query'
// REQ-UI-001 — Coco design tokens are scoped to `.quotation-detail-view`
// via an `@layer coco-quotations` block. Importing the stylesheet here
// keeps the token lifecycle tied to the view that owns it.
import '../styles/coco-tokens.css'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import AssignCustomerSlideover from '@/features/POS/sales/components/AssignCustomerSlideover.vue'
import PriceListSelector from '@/features/POS/sales/components/PriceListSelector.vue'
import ProductSearchPanel from '@/features/POS/sales/components/ProductSearchPanel.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import {
  CANCEL_REASON_LABEL,
  QUOTATION_STATUS_LABEL,
  QUOTATION_STATUS_TONE,
} from '../constants/quotation.constants'
import { quotationApi, QuotationPdfError } from '../api/quotation.api'
import { useQuotationDetail } from '../composables/useQuotationDetail'
import { useQuotationDraft } from '../composables/useQuotationDraft'
import { useAvailablePromotions } from '../composables/useAvailablePromotions'
import { PROMOTION_TYPE_LABELS } from '@/features/POS/promotions/interfaces/promotion.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import QuotationItemRow from '../components/QuotationItemRow.vue'
import QuotationPriceOverrideModal from '../components/QuotationPriceOverrideModal.vue'
import QuotationExpiryPicker from '../components/QuotationExpiryPicker.vue'
import QuotationTotalsFooter from '../components/QuotationTotalsFooter.vue'
import QuotationSendDialog from '../components/QuotationSendDialog.vue'
import QuotationCancelDialog from '../components/QuotationCancelDialog.vue'
import QuotationProgressStepper from '../components/QuotationProgressStepper.vue'
import QuotationCustomerCard from '../components/QuotationCustomerCard.vue'
import QuotationPromotionCard from '../components/QuotationPromotionCard.vue'
import { formatCentsMXN } from '../utils/currency.utils'
import { isExpired, statusToLabel, statusToTone } from '../utils/quotation.utils'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const isAssignCustomerOpen = ref(false)
const isCreating = ref(false)
const createError = ref<unknown>(null)

const canUpdateQuotation = computed(() => authStore.userCan('update', 'Quotation'))
const canDeleteQuotation = computed(() => authStore.userCan('delete', 'Quotation'))

const isCreateRoute = computed(() => route.path === '/pos/cotizaciones/nueva')
const quotationId = computed(() => {
  if (isCreateRoute.value) return null
  const value = route.params.id
  return typeof value === 'string' && value ? value : null
})

const {
  quotation,
  isLoading,
  isError,
  error,
  createDraft,
  assignCustomer,
  changePriceList,
} = useQuotationDetail(quotationId)

// `useQuotationDraft` is only safe to instantiate when we have a real
// quotation id. `createDraft` lives on `useQuotationDetail` because it
// drives the route replace; the other 15 mutations live here (S5).
const draft = useQuotationDraft(quotationId)

const isDraft = computed(() => quotation.value?.status === 'DRAFT')
const folio = computed(() => quotation.value?.id.slice(0, 8) ?? 'Nueva')

// ── S8: lazy EXPIRED detection (REQ-QTN-008 / backend §7.4) ────────────────
// The backend only flips SENT → EXPIRED on the next read. Until the cache
// catches up, the view can mirror that transition locally. DRAFT is never
// lazy-expired (the cashier can still edit it). The transition is purely
// visual — we never persist it.
const isLazyExpired = computed(() => {
  const q = quotation.value
  if (!q || q.status !== 'SENT') return false
  return isExpired(q)
})

/** Status badge tone/label: prefer the lazy-EXPIRED view when applicable. */
const headerStatus = computed(() => {
  const q = quotation.value
  if (!q) return null
  if (isLazyExpired.value) {
    return { tone: QUOTATION_STATUS_TONE.EXPIRED, label: QUOTATION_STATUS_LABEL.EXPIRED }
  }
  return { tone: statusToTone(q.status), label: statusToLabel(q.status) }
})

const customerName = computed(() => {
  const customer = quotation.value?.customer
  if (!customer) return ''
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ')
})

const cancelReasonLabel = computed<string | null>(() => {
  const reason = quotation.value?.cancelReason
  if (!reason) return null
  return CANCEL_REASON_LABEL[reason] ?? null
})

const canceledAtFormatted = computed<string | null>(() => {
  const at = quotation.value?.canceledAt
  if (!at) return null
  return formatDate(at)
})

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

function goBack(): void {
  void router.push('/pos/cotizaciones')
}

async function handleCustomerSelected(customerId: string): Promise<void> {
  if (!isDraft.value) return // defense-in-depth — UI also hides the button
  await assignCustomer(customerId)
  isAssignCustomerOpen.value = false
}

async function handlePriceListChange(globalPriceListId: string | null): Promise<void> {
  if (!isDraft.value) return
  await changePriceList(globalPriceListId)
}

// ── S5: item management ──────────────────────────────────────────────────────

const items = computed(() => quotation.value?.items ?? [])

const isProductSearchOpen = ref(false)

// T-UI-21/22 / REQ-UI-010 — customer notes. The backend does not yet
// expose a `notes` endpoint, so the textarea is local-state only. To
// avoid losing in-flight notes when the cashier navigates away or
// refreshes, the value is cached in `localStorage` under
// `quotation-notes-${id}` with a 300ms debounce so storage isn't
// thrashed on every keystroke. The "(no implementado aún)" hint stays
// until the backend endpoint lands — the localStorage cache is purely
// a non-persistent safety net (REQ-UI-010 spec).
const NOTES_MAX_LENGTH = 280
const NOTES_STORAGE_DEBOUNCE_MS = 300

const customerNotes = ref('')

function notesStorageKey(id: string | null): string | null {
  return id ? `quotation-notes-${id}` : null
}

function loadNotesFromStorage(id: string | null): string {
  const key = notesStorageKey(id)
  if (!key) return ''
  try {
    const cached = window.localStorage.getItem(key)
    return cached ?? ''
  } catch {
    return ''
  }
}

let notesPersistTimer: ReturnType<typeof setTimeout> | null = null

function persistNotesToStorage(id: string | null, value: string): void {
  const key = notesStorageKey(id)
  if (!key) return
  if (notesPersistTimer !== null) {
    clearTimeout(notesPersistTimer)
  }
  notesPersistTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Storage may be full or disabled — silently no-op. The notes
      // stay in the textarea so the cashier never loses work in the UI.
    }
  }, NOTES_STORAGE_DEBOUNCE_MS)
}

function handleNotesInput(value: string): void {
  // Defensive clamp: the textarea already enforces `maxlength`, but a
  // paste event with > 280 chars could land us at 281. Slice so the
  // counter always reads "N / 280" where N ≤ 280.
  const clamped = value.length > NOTES_MAX_LENGTH ? value.slice(0, NOTES_MAX_LENGTH) : value
  customerNotes.value = clamped
  persistNotesToStorage(quotationId.value, clamped)
}

// Sync the local notes ref whenever the route changes to a new
// quotation id (so navigating between drafts doesn't leak notes).
watch(
  () => quotationId.value,
  (nextId) => {
    customerNotes.value = loadNotesFromStorage(nextId)
  },
  { immediate: true },
)

async function handleAddProduct(
  productId: string,
  variantId: string | null,
): Promise<void> {
  if (!isDraft.value) return // defense-in-depth
  await draft.addItem(productId, 1, variantId ?? undefined)
  isProductSearchOpen.value = false
}

async function handleUpdateQuantity(
  itemId: string,
  quantity: number,
): Promise<void> {
  if (!isDraft.value) return
  await draft.updateQuantity(itemId, quantity)
}

// ── Remove confirmation flow ─────────────────────────────────────────────────
// The row never deletes state directly — it emits `request-remove`, we
// pop the ConfirmModal, and only after the user confirms do we hit the
// backend (`quotationApi.removeItem` returns the updated quotation; the
// composable mutates the cache).

const pendingRemoveItemId = ref<string | null>(null)
const isRemoveConfirmOpen = computed(() => pendingRemoveItemId.value !== null)

function handleRequestRemove(itemId: string): void {
  pendingRemoveItemId.value = itemId
}

function handleRemoveCancel(): void {
  pendingRemoveItemId.value = null
}

async function handleRemoveConfirm(): Promise<void> {
  if (!isDraft.value) {
    pendingRemoveItemId.value = null
    return
  }
  const itemId = pendingRemoveItemId.value
  pendingRemoveItemId.value = null
  if (!itemId) return
  await draft.removeItem(itemId)
}

async function handleOverridePrice(
  itemId: string,
  unitPriceCents: number,
): Promise<void> {
  if (!isDraft.value) return
  // Slice 5 commits the override value as-is (the row passes back the
  // current unit price when the cashier clicks the pencil). Slice 8/9 can
  // upgrade this to a dedicated modal without changing the public contract.
  await draft.overridePrice(itemId, unitPriceCents)
}

// ── Price override flow ───────────────────────────────────────────────────────
// The row never commits anything on its own — it emits `request-price-override`
// with just the item id, we pop the QuotationPriceOverrideModal, and only after
// the cashier types a value and confirms do we hit the backend
// (`draft.overridePrice`).

const pendingOverrideItemId = ref<string | null>(null)
const isPriceOverrideOpen = computed(() => pendingOverrideItemId.value !== null)
const pendingOverrideItem = computed(
  () => items.value.find((i) => i.id === pendingOverrideItemId.value) ?? null,
)

function handleRequestPriceOverride(itemId: string): void {
  if (!isDraft.value) return
  pendingOverrideItemId.value = itemId
}

function handlePriceOverrideCancel(): void {
  pendingOverrideItemId.value = null
}

async function handlePriceOverrideSubmit(itemId: string, unitPriceCents: number): Promise<void> {
  if (!isDraft.value) return
  await draft.overridePrice(itemId, unitPriceCents)
  pendingOverrideItemId.value = null
}

// ── S6: promotions + expiry + totals footer ───────────────────────────────────

const appliedPromotions = computed(() => quotation.value?.appliedPromotions ?? [])

/** Applied promotions enriched with resolved titles. The backend may send
 *  `title: null` when `discountTitle` on the item is null, so we resolve
 *  via `promotionLookup` (active promotions API) before passing to the card. */
const resolvedAppliedPromotions = computed(() =>
  appliedPromotions.value.map((p) => ({
    ...p,
    title: resolvePromotionTitle(p.promotionId, p.title),
  })),
)

const vetoedPromotionIds = computed(() => quotation.value?.vetoedPromotionIds ?? [])

/** Two-way binding shim for the expiry picker — the picker emits ISO/null,
 *  the composable owns the cache invalidation + toast. */
function handleExpiryUpdate(value: string | null): void {
  if (!isDraft.value) return
  if (value === null) {
    void draft.clearExpiry()
    return
  }
  void draft.setExpiry(value)
}

/** Remove an applied promotion from the quotation. MANUAL promotions are
 *  removed via the manual opt-in endpoint; AUTOMATIC promotions are removed
 *  by vetoing them (the backend re-evaluates totals and moves the promo to
 *  the vetoed set). */
async function handleRemoveAppliedPromotion(promotionId: string): Promise<void> {
  if (!isDraft.value) return
  const isManual = quotation.value?.optedInManualPromotionIds.includes(promotionId) ?? false
  if (isManual) {
    await draft.removeManualPromotion(promotionId)
  } else {
    await draft.vetoPromotion(promotionId)
  }
}

async function handleUnvetoPromotion(promotionId: string): Promise<void> {
  if (!isDraft.value) return
  await draft.unvetoPromotion(promotionId)
}

// The manual apply picker (USelectMenu) over ACTIVE promotions — the cashier
// never types a raw UUID. Options apply immediately on selection (the backend
// still validates the ID + type server-side).
const { promotions: manualPromotions, isLoading: isLoadingManualPromos } =
  useAvailablePromotions(tenantId, 'MANUAL')
const { promotions: automaticPromotions, isLoading: isLoadingAutomaticPromos } =
  useAvailablePromotions(tenantId, 'AUTOMATIC')

const promotionLookup = computed(() => {
  const map = new Map<string, { title: string; type: string; method: string }>()
  for (const p of manualPromotions.value) {
    map.set(p.id, { title: p.title, type: p.type, method: p.method })
  }
  for (const p of automaticPromotions.value) {
    map.set(p.id, { title: p.title, type: p.type, method: p.method })
  }
  return map
})

const vetoedPromotions = computed(() =>
  vetoedPromotionIds.value.map((id) => {
    const info = promotionLookup.value.get(id)
    return {
      promotionId: id,
      title: info?.title ?? 'Promoción desconocida',
      type: info?.type ?? null,
      method: info?.method ?? null,
    }
  }),
)

function appliedMethod(promotionId: string): string {
  if (quotation.value?.optedInManualPromotionIds.includes(promotionId)) {
    return 'Manual'
  }
  return 'Automática'
}

/** Resolve a promotion title for display. The active-promotions API is the
 *  authoritative source (same data as the dropdown picker). Falls back to the
 *  backend-provided title from appliedPromotions (derived from item.discountTitle,
 *  which can be null). Uses the raw ID only as a last resort. */
function resolvePromotionTitle(promotionId: string, backendTitle?: string | null): string {
  const lookupTitle = promotionLookup.value.get(promotionId)?.title
  if (lookupTitle) return lookupTitle
  if (backendTitle) return backendTitle
  return promotionId
}

const isLoadingAllPromos = computed(() => isLoadingManualPromos.value || isLoadingAutomaticPromos.value)

const allPromoItems = computed(() => {
  const appliedIds = new Set(appliedPromotions.value.map((p) => p.promotionId))
  const all = [...manualPromotions.value, ...automaticPromotions.value]
  return all.map((p) => {
    const isApplied = appliedIds.has(p.id)
    const typeLabel = PROMOTION_TYPE_LABELS[p.type] ?? p.type
    const methodLabel = p.method === 'MANUAL' ? 'Manual' : 'Automática'
    return {
      value: p.id,
      label: p.title,
      description: isApplied
        ? `(Aplicada) · ${typeLabel} · ${methodLabel}`
        : `${typeLabel} · ${methodLabel}`,
    }
  })
})

const selectedPromotion = ref<string | null>(null)

/** Select → apply. Re-select an already-applied promo → remove it (toggle).
 *  Routes by promotion method: MANUAL promos use the manual-opt-in endpoint;
 *  AUTOMATIC promos use the veto opt-in (DELETE /veto) so the engine
 *  re-evaluates and applies them when conditions match. */
async function handleSelectPromotion(selected: string | null): Promise<void> {
  if (!isDraft.value || !selected) return
  const isApplied = appliedPromotions.value.some((p) => p.promotionId === selected)
  if (isApplied) {
    await handleRemoveAppliedPromotion(selected)
  } else {
    const promo = promotionLookup.value.get(selected)
    if (promo?.method === 'AUTOMATIC') {
      await draft.unvetoPromotion(selected)
    } else {
      await draft.applyManualPromotion(selected)
    }
  }
  selectedPromotion.value = null
}

// ── S7: PDF preview + send dialog + cancel dialog ────────────────────────────

/** Tracks which fetch is currently in flight so the button can't be clicked
 *  twice in parallel (R2 mirror of SaleDetailView's PDF download). */
const isPdfLoading = ref(false)
const pdfAbortController = ref<AbortController | null>(null)

async function handlePreviewPdf(): Promise<void> {
  if (!quotation.value || isPdfLoading.value) return
  isPdfLoading.value = true
  let objectUrl: string | null = null
  const controller = new AbortController()
  pdfAbortController.value = controller
  try {
    const blob = await quotationApi.getPdfBlob(quotation.value.id, {
      signal: controller.signal,
    })
    objectUrl = URL.createObjectURL(blob)
    const opened = window.open(objectUrl, '_blank')
    if (!opened) {
      // Popup blocked — fall back to a direct download via anchor click.
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `cotizacion-${quotation.value.id}.pdf`
      link.click()
      useToast().add({
        title: 'Cotización descargada',
        description: 'Permití ventanas emergentes para previsualizar en el navegador.',
        color: 'primary',
      })
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_CANCELED') return
    if (error instanceof QuotationPdfError) {
      if (error.code === 'INVALID_FORMAT') {
        useToast().add({ title: 'Formato no soportado', color: 'error' })
        return
      }
      if (error.code === 'QUOTATION_NOT_FOUND') {
        useToast().add({ title: 'Cotización no encontrada', color: 'error' })
        return
      }
      if (error.code === 'PDF_GENERATION_FAILED') {
        useToast().add({
          title: 'Error al generar el PDF',
          description: 'Intenta nuevamente',
          color: 'error',
        })
        return
      }
    }
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 401) {
      useToast().add({ title: 'Sesión expirada. Iniciá sesión nuevamente', color: 'error' })
      return
    }
    if (status === 403) {
      useToast().add({ title: 'No tienes permiso para ver este PDF', color: 'error' })
      return
    }
    if (status === 404) {
      useToast().add({ title: 'Cotización no encontrada', color: 'error' })
      return
    }
    if (!status) {
      useToast().add({
        title: 'Error de conexión',
        description: 'Verifica tu red e intenta nuevamente',
        color: 'error',
      })
      return
    }
    useToast().add({ title: 'No se pudo generar el PDF', color: 'error' })
  } finally {
    const urlToRevoke = objectUrl
    if (urlToRevoke) {
      setTimeout(() => URL.revokeObjectURL(urlToRevoke), 1_000)
    }
    isPdfLoading.value = false
    if (pdfAbortController.value === controller) {
      pdfAbortController.value = null
    }
  }
}

const isSendDialogOpen = ref(false)
const isCancelDialogOpen = ref(false)

function openSendDialog(): void {
  if (!isDraft.value) return
  isSendDialogOpen.value = true
}

function openCancelDialog(): void {
  if (!isDraft.value) return
  isCancelDialogOpen.value = true
}

function handleSendDialogClose(): void {
  isSendDialogOpen.value = false
}

function handleCancelDialogClose(): void {
  isCancelDialogOpen.value = false
}

async function handleSend(email: boolean): Promise<void> {
  if (!isDraft.value) return
  await draft.sendQuotation(email)
}

/** T-UI-23 — sidebar "Guardar borrador" CTA. The view already saves
 *  the draft on every mutation (the composable patches the cache and
 *  the backend persists the changes), so this handler is a no-op
 *  acknowledgement: it confirms to the cashier that their latest
 *  edits are persisted. The toast mirrors the UX pattern in other
 *  POS surfaces so the button feels responsive. */
function handleSaveDraftFromSidebar(): void {
  if (!isDraft.value) return
  useToast().add({
    title: 'Borrador guardado',
    description: 'Los cambios ya están guardados en el servidor.',
    color: 'success',
  })
}

async function handleCancel(reason: Parameters<typeof draft.cancelQuotation>[0]): Promise<void> {
  if (!isDraft.value) return
  await draft.cancelQuotation(reason)
}

// ── Delete confirmation flow (REQ-QTN-013 / backend §3.16) ─────────────────
// DELETE /quotations/:id only accepts DRAFT or CANCELLED quotations
// (409 QUOTATION_CANNOT_DELETE otherwise), but the UI gate keeps it to
// DRAFT to mirror the read-only invariant: a CANCELLED quotation in the
// detail view is terminal, so the cashier can already see why it ended
// via the cancel reason banner. Deletion is the "I never sent this,
// just nuke it" affordance for abandoned drafts.

const isDeleteConfirmOpen = ref(false)

const deleteMutation = useMutation({
  mutationFn: () => quotationApi.deleteQuotation(quotationId.value!),
  onSuccess: async () => {
    isDeleteConfirmOpen.value = false
    useToast().add({ title: 'Cotización eliminada', color: 'success' })
    await router.push('/pos/cotizaciones')
  },
  onError: (error) => {
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    const message =
      err.response?.data?.message ?? err.message ?? 'No se pudo eliminar la cotización'
    useToast().add({ title: 'Error', description: message, color: 'error' })
  },
})

onUnmounted(() => {
  pdfAbortController.value?.abort()
  // Flush the debounced notes persist before teardown so the latest
  // keystroke isn't dropped if the cashier navigates away.
  if (notesPersistTimer !== null) {
    clearTimeout(notesPersistTimer)
    notesPersistTimer = null
    const key = notesStorageKey(quotationId.value)
    if (key && customerNotes.value) {
      try {
        window.localStorage.setItem(key, customerNotes.value)
      } catch {
        // No-op: storage may be full / disabled.
      }
    }
  }
})

/** Tiny helper used by the applied-promotions list to render the discount
 *  next to the title. formatCentsMXN lives in `../utils/currency.utils` so
 *  we don't reach across to the core helper directly from the view. */
function formatDiscountCents(cents: number): string {
  return formatCentsMXN(cents)
}

onMounted(async () => {
  if (!isCreateRoute.value) return
  const rawCustomerId = route.query.customerId
  const customerId = typeof rawCustomerId === 'string' && rawCustomerId
    ? rawCustomerId
    : undefined

  isCreating.value = true
  createError.value = null
  try {
    await createDraft(customerId)
  } catch (caught) {
    createError.value = caught
  } finally {
    isCreating.value = false
  }
})
</script>

<template>
  <section class="quotation-detail-view flex flex-col gap-6 px-4 sm:px-8 lg:px-10" data-testid="quotation-detail-view">
    <header class="flex flex-col gap-4 border-b border-default pb-5">
      <button
        type="button"
        class="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted hover:text-highlighted"
        data-testid="back-button"
        @click="goBack"
      >
        <span aria-hidden="true">←</span>
        Cotizaciones
      </button>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-highlighted">
            Cotización #{{ folio }}
          </h1>
          <div v-if="quotation" class="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            <StatusDotBadge
              v-if="headerStatus"
              :label="headerStatus.label"
              :tone="headerStatus.tone"
              compact
              data-testid="status-badge"
            />
            <span v-if="quotation.expiresAt">Expira {{ formatDate(quotation.expiresAt) }}</span>
            <span v-else>Sin fecha de expiración</span>
            <span>Creada {{ formatDate(quotation.createdAt) }}</span>
          </div>
        </div>

        <!-- S7 — actions bar: PDF preview (always), cancel (DRAFT only).
             T-UI-28 — REQ-UI-004 + design.md testid migration: the old
             `quotation-actions` testid is renamed to `detail-header-actions`
             (PDF/cancel) so it stays distinguishable from the new
             `detail-sidebar-actions` wrapper (send/save) that owns the
             RESUMEN sidebar CTAs. -->
        <div class="flex flex-wrap items-center gap-2" data-testid="detail-header-actions">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isPdfLoading"
            data-testid="preview-pdf-button"
            @click="handlePreviewPdf"
          >
            <UIcon name="i-lucide-file-text" class="h-4 w-4" />
            <span>{{ isPdfLoading ? 'Generando…' : 'Previsualizar PDF' }}</span>
          </button>
          <!-- T-UI-23 — REQ-UI-009: the "Enviar cotización" CTA moved out
               of the header into the RESUMEN sidebar (QuotationTotalsFooter).
               The header keeps the destructive "Cancelar" action since
               it operates on the quotation, not the totals. -->
          <button
            v-if="isDraft && canUpdateQuotation"
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-2 text-sm font-medium text-error hover:bg-elevated"
            data-testid="cancel-button"
            @click="openCancelDialog"
          >
            <UIcon name="i-lucide-ban" class="h-4 w-4" />
            <span>Cancelar</span>
          </button>
          <!-- REQ-QTN-013 — Delete (DRAFT only, gated by `delete:Quotation`).
               Permanently removes the quotation via DELETE /quotations/:id.
               SENT / EXPIRED / CANCELLED rows don't show this affordance —
               the backend would reject the mutation with 409 anyway. -->
          <button
            v-if="isDraft && canDeleteQuotation"
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-2 text-sm font-medium text-error hover:bg-elevated"
            data-testid="delete-button"
            @click="isDeleteConfirmOpen = true"
          >
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span>Eliminar</span>
          </button>
        </div>
      </div>

      <!-- REQ-UI-003: 3-state progress stepper placed below the status
           metadata so it reads as a secondary detail, not the primary
           visual anchor. Compact presentation — smaller nodes and text. -->
      <QuotationProgressStepper
        v-if="quotation"
        :status="quotation.status"
        compact
      />
    </header>

    <div
      v-if="isCreating"
      class="flex min-h-56 items-center justify-center gap-3 text-muted"
      data-testid="create-loading"
    >
      <span class="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      Creando cotización…
    </div>

    <div
      v-else-if="isLoading"
      class="flex min-h-56 items-center justify-center gap-3 text-muted"
      data-testid="detail-loading"
    >
      <span class="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      Cargando cotización…
    </div>

    <div
      v-else-if="isError || createError"
      class="rounded-lg border border-error/30 bg-error/5 p-6 text-error"
      data-testid="detail-error"
    >
      No se pudo cargar la cotización.
      <span class="sr-only">{{ String(error ?? createError) }}</span>
    </div>

    <template v-else-if="quotation">
      <!-- T-UI-03 — REQ-UI-002: 2-column Coco layout. The grid splits at the
           lg breakpoint into a left col-span-2 (main sections) and a right
           col-span-1 sticky sidebar (RESUMEN). Below lg, everything stacks
           into a single column and the sticky behavior is dropped. -->
      <div
        class="grid gap-4 lg:grid-cols-3"
        data-testid="quotation-detail-layout"
      >
        <div
          class="flex flex-col gap-4 lg:col-span-2"
          data-testid="quotation-detail-main"
        >
          <div class="grid gap-4 lg:grid-cols-2">
            <!-- T-UI-16 — REQ-UI-005 customer card. Extracted into
                 QuotationCustomerCard so the avatar / email / phone /
                 "Cambiar cliente" affordance lives in one place. The card
                 is editable only in DRAFT (read-only otherwise). The
                 change-customer event opens the same AssignCustomerSlideover
                 that handled the old "Asignar cliente" button. -->
            <section class="rounded-xl border border-default bg-default p-5">
              <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Cliente</p>
              <QuotationCustomerCard
                v-if="quotation.customer"
                :customer="quotation.customer"
                :editable="isDraft"
                @change-customer="isAssignCustomerOpen = true"
              />
              <p
                v-else-if="!isDraft"
                class="text-sm text-muted"
                data-testid="customer-empty-readonly"
              >Sin cliente</p>
              <QuotationCustomerCard
                v-else
                :customer="null"
                :editable="true"
                @change-customer="isAssignCustomerOpen = true"
              />
            </section>

            <section class="rounded-xl border border-default bg-default p-5" data-testid="price-list-section">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">Lista de precios</p>
              <PriceListSelector
                v-if="isDraft"
                class="mt-3"
                :active-draft="quotation"
                :is-mutating="false"
                @change-price-list="handlePriceListChange"
                @request-confirm="handlePriceListChange"
              />
              <p v-else class="mt-2 text-sm font-medium text-highlighted">
                {{ quotation.globalPriceListId ?? 'PUBLICO' }}
              </p>
            </section>
          </div>

          <!-- S6 — expiry picker. The picker itself owns the input + clear
               button; the view just plumbs the value through setExpiry /
               clearExpiry on the composable. -->
          <section
            class="rounded-xl border border-default bg-default p-5"
            data-testid="expiry-section"
          >
            <QuotationExpiryPicker
              :expires-at="quotation.expiresAt"
              :readonly="!isDraft"
              @update:expires-at="handleExpiryUpdate"
            />
          </section>

          <!-- Items section — always visible. The list + add-product affordance
               in DRAFT; read-only list for every other status. Product search
               opens in a dedicated slideover (not inline) so the items list is
               always visible and never hidden behind the search panel. -->
          <section
            class="flex flex-col gap-4 rounded-xl border border-default bg-default p-5"
            data-testid="items-section"
          >
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-highlighted">Productos</h2>
                <p class="mt-0.5 text-xs text-muted">
                  {{ items.length }} {{ items.length === 1 ? 'producto' : 'productos' }}
                </p>
              </div>
              <button
                v-if="isDraft"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="add-product-button"
                @click="isProductSearchOpen = true"
              >
                <UIcon name="i-lucide-plus" class="h-4 w-4" />
                Agregar producto
              </button>
            </div>

            <p
              v-if="items.length === 0"
              class="rounded-lg border border-dashed border-default px-4 py-10 text-center text-sm text-muted"
              data-testid="items-empty-state"
            >
              No hay productos en esta cotización.<br />
              <span v-if="isDraft" class="text-xs">Usá el botón "Agregar producto" para buscar y añadir productos.</span>
            </p>

            <ul
              v-else
              class="flex flex-col gap-2"
              data-testid="items-list"
            >
              <li v-for="item in items" :key="item.id">
                <QuotationItemRow
                  :item="item"
                  :readonly="!isDraft"
                  @update-quantity="handleUpdateQuantity"
                  @request-price-override="handleRequestPriceOverride"
                  @request-remove="handleRequestRemove"
                />
              </li>
            </ul>
          </section>

          <!-- S6 — promotions section. Only visible in DRAFT (mutations are
               blocked server-side for any other status). Three sub-blocks:
                 1. Applied promotions (manual + auto) with "Quitar"/"Vetar".
                 2. Vetoed auto promotions with "Re-activar".
                 3. One picker (USelectMenu) over the ACTIVE manual promotions —
                    the cashier picks a promotion instead of typing its ID, and it
                    applies immediately on selection. The backend validates the type. -->
          <section
            v-if="isDraft"
            class="flex flex-col gap-4 rounded-xl border border-default bg-default p-5"
          >
            <h2 class="text-base font-semibold text-highlighted">Promociones</h2>

            <div
              v-if="appliedPromotions.length > 0"
              class="flex flex-col gap-2"
              data-testid="applied-promotions-list"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                Aplicadas
              </p>
              <ul class="flex flex-col gap-2">
                <!-- T-UI-20 — REQ-UI-008 promotion cards. Extracted to
                     QuotationPromotionCard so the border-l-4 accent
                     treatment + outlined badge + blue discount live in
                     one place. The parent routes MANUAL removes via
                     removeManualPromotion and AUTOMATIC ones via
                     vetoPromotion — the card itself never calls the
                     API directly. -->
                <li
                  v-for="promo in resolvedAppliedPromotions"
                  :key="promo.promotionId"
                >
                  <QuotationPromotionCard
                    :promotion="promo"
                    :method="appliedMethod(promo.promotionId) === 'Manual' ? 'MANUAL' : 'AUTOMATIC'"
                    @remove="handleRemoveAppliedPromotion"
                    @veto="handleRemoveAppliedPromotion"
                  />
                </li>
              </ul>
            </div>

            <div
              v-if="vetoedPromotionIds.length > 0"
              class="flex flex-col gap-2"
              data-testid="vetoed-promotions-list"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                Vetadas
              </p>
              <ul class="flex flex-col gap-2">
                <li
                  v-for="promo in vetoedPromotions"
                  :key="promo.promotionId"
                  class="flex items-center justify-between gap-2 rounded-lg border border-default px-3 py-2"
                  :data-testid="`vetoed-promo-${promo.promotionId}`"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-highlighted truncate">{{ promo.title }}</p>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-500 mt-1"
                    >Automática</span>
                  </div>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-xs font-medium hover:bg-elevated"
                    :data-testid="`unveto-promo-${promo.promotionId}`"
                    @click="handleUnvetoPromotion(promo.promotionId)"
                  >
                    <UIcon name="i-lucide-rotate-ccw" class="h-3.5 w-3.5" />
                    Re-activar
                  </button>
                </li>
              </ul>
            </div>

            <div class="flex flex-col gap-2" data-testid="apply-manual-promo-select">
              <label class="text-xs font-semibold uppercase tracking-wide text-muted">
                Agregar promoción
              </label>
              <USelectMenu
                v-model="selectedPromotion"
                value-key="value"
                :items="allPromoItems"
                :loading="isLoadingAllPromos"
                placeholder="Seleccioná una promoción…"
                :search-input="{ icon: 'i-lucide-search' }"
                class="w-full"
                data-testid="manual-promo-select"
                @update:model-value="handleSelectPromotion"
              >
                <template #empty>
                  <span v-if="isLoadingAllPromos">Cargando promociones…</span>
                  <span v-else>No hay promociones activas</span>
                </template>
              </USelectMenu>
            </div>
          </section>

          <!-- S8 — CANCELLED detail banner (REQ-QTN-012). The backend stamps the
               cancel reason; we surface it as a permanent notice so any saved
               PDF copy / later access makes the cancellation traceable. -->
          <section
            v-if="quotation?.status === 'CANCELLED' && cancelReasonLabel"
            class="rounded-xl border border-error/40 bg-error/5 p-4 text-sm text-error"
            data-testid="cancel-reason-banner"
          >
            <p class="font-semibold">Cotización cancelada</p>
            <p class="mt-1 text-error/80">
              {{ cancelReasonLabel }}<span v-if="canceledAtFormatted"> · {{ canceledAtFormatted }}</span>
            </p>
          </section>

          <!-- S8 — lazy EXPIRED banner (REQ-QTN-008 / backend §7.4). Shown when
               the cached status is still SENT but `expiresAt < now`. We never
               persist this — the next GET will return status=EXPIRED for real. -->
          <section
            v-if="isLazyExpired"
            class="rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm text-warning"
            data-testid="lazy-expired-notice"
          >
            <p class="font-semibold">Cotización expirada (vista)</p>
            <p class="mt-1 text-warning/80">
              El servidor aún la reporta como Enviada. Esta cotización pasó a Expirada al cruzar la fecha límite y se mostrará así la próxima vez que el sistema la recargue.
            </p>
          </section>

          <!-- S8 — generic read-only banner. Placed BELOW the more specific
               EXPIRED / CANCELLED banners so the cashier sees the *reason* the
               view is read-only first, and the generic notice second. -->
          <section
            v-if="!isDraft"
            class="rounded-xl border border-default bg-elevated p-5 text-sm text-muted"
            data-testid="read-only-notice"
          >
            Solo lectura. Esta cotización ya no admite cambios.
          </section>
        </div>

        <!-- T-UI-03 — right sticky sidebar. REQ-UI-002 reads the summary
             MUST stay visible while the cashier scrolls the long product
             list. `lg:sticky` is no-op below lg so the sidebar flows on
             mobile. -->
        <div
          class="flex flex-col gap-4 lg:col-span-1 lg:sticky lg:top-4 lg:self-start"
          data-testid="quotation-detail-sidebar"
        >
          <!-- T-UI-22/23 — REQ-UI-009 RESUMEN sidebar. Pass
               `editable=isDraft` so the CTAs only render in DRAFT,
               `expiresAt` for the validity notice, and wire `send`
               / `save-draft` to the existing dialog + composable
               actions. `priceListName` is optional and not yet
               exposed by the backend, so we leave it null. -->
          <QuotationTotalsFooter
            :quotation="quotation"
            :editable="isDraft && canUpdateQuotation"
            :expires-at="quotation.expiresAt"
            @send="openSendDialog"
            @save-draft="handleSaveDraftFromSidebar"
          />

          <!-- T-UI-21/22 / REQ-UI-010 — customer notes (UI-only). The
               textarea is local-state only — cached to localStorage
               under `quotation-notes-${id}` (debounced 300ms) so the
               cashier doesn't lose in-flight notes. The "(no
               implementado aún)" hint stays until the backend endpoint
               lands. -->
          <section
            class="flex flex-col gap-2 rounded-xl border border-default bg-default p-5"
            data-testid="customer-notes-section"
          >
            <div class="flex items-center justify-between">
              <label
                for="customer-notes"
                class="text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Notas
              </label>
              <span
                class="text-xs text-muted tabular-nums"
                data-testid="notes-char-counter"
              >
                {{ customerNotes.length }} / 280
              </span>
            </div>
            <textarea
              id="customer-notes"
              :value="customerNotes"
              rows="4"
              maxlength="280"
              class="w-full resize-none rounded-lg border border-default bg-default p-2 text-sm text-highlighted focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Condiciones de entrega, referencias de pago..."
              data-testid="customer-notes-textarea"
              @input="handleNotesInput(($event.target as HTMLTextAreaElement).value)"
            />
            <p class="text-xs text-muted">
              (no implementado aún)
            </p>
          </section>
        </div>
      </div>

      <AssignCustomerSlideover
        v-model:open="isAssignCustomerOpen"
        @customer-selected="handleCustomerSelected"
      />

      <ConfirmModal
        :open="isRemoveConfirmOpen"
        title="Quitar producto"
        description="¿Quitar este producto de la cotización? Esta acción no se puede deshacer."
        confirm-label="Quitar"
        confirm-color="error"
        @update:open="(value) => { if (!value) handleRemoveCancel() }"
        @confirm="handleRemoveConfirm"
      />

      <!-- REQ-QTN-013 — Delete quotation confirmation. Separate from the
           remove-item modal so the two destructive flows don't share state.
           `loading` is bound to the mutation's pending flag so the confirm
           button stays disabled while DELETE /quotations/:id is in-flight. -->
      <ConfirmModal
        :open="isDeleteConfirmOpen"
        title="Eliminar cotización"
        :description="`¿Eliminar la cotización #${folio}? Esta acción no se puede deshacer.`"
        confirm-label="Eliminar"
        confirm-color="error"
        :loading="deleteMutation.isPending.value"
        @update:open="(val) => { if (!val) isDeleteConfirmOpen = false }"
        @confirm="deleteMutation.mutate()"
      />

      <QuotationPriceOverrideModal
        v-if="pendingOverrideItem"
        :open="isPriceOverrideOpen"
        :item="pendingOverrideItem"
        :on-submit="handlePriceOverrideSubmit"
        @update:open="(value: boolean) => { if (!value) handlePriceOverrideCancel() }"
      />

      <!-- S7 — send dialog. Only mount in DRAFT (the button that opens it is
           also gated, but mounting only-when-DRAFT keeps the modal far from
           SENT/EXPIRED/CANCELLED render paths.) -->
      <QuotationSendDialog
        v-if="quotation"
        :open="isSendDialogOpen"
        :quotation="quotation"
        :send="handleSend"
        @close="handleSendDialogClose"
        @sent="handleSendDialogClose"
      />

      <!-- S7 — cancel dialog. Same DRAFT-only mounting. -->
      <QuotationCancelDialog
        v-if="quotation"
        :open="isCancelDialogOpen"
        :quotation="quotation"
        :cancel="handleCancel"
        @close="handleCancelDialogClose"
        @cancelled="handleCancelDialogClose"
      />

      <!-- Product search slideover — opens from the right, contains the
           ProductSearchPanel so it never covers the items list. Gated with
           v-if (not just :open) to prevent the backdrop from leaking when
           the slideover is closed (known Nuxt UI 4 behavior). -->
      <USlideover
        v-if="isProductSearchOpen && isDraft"
        :open="isProductSearchOpen"
        side="right"
        inset
        :ui="{ content: '!max-w-xl' }"
        @update:open="(value: boolean) => { if (!value) isProductSearchOpen = false }"
      >
        <template #title>Buscar productos</template>
        <template #body>
          <ProductSearchPanel
            class="h-full product-search-panel--two-cols"
            data-testid="product-search-panel"
            @add-product="handleAddProduct"
          />
        </template>
      </USlideover>
    </template>
  </section>
</template>

<style scoped>
/* Force 2-column grid inside the product search slideover so cards
   don't crowd each other on the narrower panel (the base grid uses
   4 cols on md+ which is too cramped). */
.product-search-panel--two-cols :deep(.grid) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}
</style>
