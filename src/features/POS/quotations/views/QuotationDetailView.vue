<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import QuotationItemRow from '../components/QuotationItemRow.vue'
import QuotationExpiryPicker from '../components/QuotationExpiryPicker.vue'
import QuotationTotalsFooter from '../components/QuotationTotalsFooter.vue'
import QuotationSendDialog from '../components/QuotationSendDialog.vue'
import QuotationCancelDialog from '../components/QuotationCancelDialog.vue'
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
const isAssignCustomerOpen = ref(false)
const isCreating = ref(false)
const createError = ref<unknown>(null)

const canUpdateQuotation = computed(() => authStore.userCan('update', 'Quotation'))

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

// ── S6: promotions + expiry + totals footer ───────────────────────────────────

const appliedPromotions = computed(() => quotation.value?.appliedPromotions ?? [])
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

async function handleRemoveManualPromo(promotionId: string): Promise<void> {
  if (!isDraft.value) return
  await draft.removeManualPromotion(promotionId)
}

async function handleUnvetoPromotion(promotionId: string): Promise<void> {
  if (!isDraft.value) return
  await draft.unvetoPromotion(promotionId)
}

// Small inline forms for apply/veto. There is no "list of available MANUAL
// promotions" endpoint for quotations in this slice — the cashier enters
// the promotion ID by hand (typically copied from a separate promo admin
// screen). The backend validates the ID exists + is the right type.
const applyManualPromoInput = ref('')
const vetoAutoPromoInput = ref('')

async function handleApplyManualPromoSubmit(): Promise<void> {
  if (!isDraft.value) {
    applyManualPromoInput.value = ''
    return
  }
  const trimmed = applyManualPromoInput.value.trim()
  if (!trimmed) return
  await draft.applyManualPromotion(trimmed)
  applyManualPromoInput.value = ''
}

async function handleVetoAutoPromoSubmit(): Promise<void> {
  if (!isDraft.value) {
    vetoAutoPromoInput.value = ''
    return
  }
  const trimmed = vetoAutoPromoInput.value.trim()
  if (!trimmed) return
  await draft.vetoPromotion(trimmed)
  vetoAutoPromoInput.value = ''
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

async function handleCancel(reason: Parameters<typeof draft.cancelQuotation>[0]): Promise<void> {
  if (!isDraft.value) return
  await draft.cancelQuotation(reason)
}

onUnmounted(() => {
  pdfAbortController.value?.abort()
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

        <!-- S7 — actions bar: PDF preview (always), send + cancel (DRAFT only) -->
        <div class="flex flex-wrap items-center gap-2" data-testid="quotation-actions">
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
          <button
            v-if="isDraft && canUpdateQuotation"
            type="button"
            class="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="send-button"
            @click="openSendDialog"
          >
            <UIcon name="i-lucide-send" class="h-4 w-4" />
            <span>Enviar</span>
          </button>
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
        </div>
      </div>
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
      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-default bg-default p-5" data-testid="customer-section">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">Cliente</p>
              <template v-if="quotation.customer">
                <p class="mt-2 font-semibold text-highlighted">{{ customerName }}</p>
                <p class="mt-1 text-sm text-muted">{{ quotation.customer.email ?? 'Sin email' }}</p>
              </template>
              <p v-else-if="!isDraft" class="mt-2 text-sm text-muted">Sin cliente</p>
              <p v-else class="mt-2 text-sm text-muted">Todavía no hay un cliente asignado.</p>
            </div>
            <button
              v-if="isDraft && !quotation.customer"
              type="button"
              class="rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated"
              data-testid="assign-customer-button"
              @click="isAssignCustomerOpen = true"
            >
              Asignar cliente
            </button>
          </div>
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
              @override-price="handleOverridePrice"
              @request-remove="handleRequestRemove"
            />
          </li>
        </ul>
      </section>

      <!-- S6 — promotions section. Only visible in DRAFT (mutations are
           blocked server-side for any other status). Three sub-blocks:
             1. Applied promotions (manual + auto) with "Quitar".
             2. Vetoed auto promotions with "Re-activar".
             3. Two inline forms to apply a MANUAL promo by ID and to veto
                an AUTO promo by ID. The backend validates the type. -->
      <section
        v-if="isDraft"
        class="flex flex-col gap-4 rounded-xl border border-default bg-default p-5"
        data-testid="promotions-section"
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
            <li
              v-for="promo in appliedPromotions"
              :key="promo.id"
              class="flex items-center justify-between gap-2 rounded-lg border border-default px-3 py-2"
              :data-testid="`applied-promo-${promo.promotionId}`"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-highlighted truncate">{{ promo.title }}</p>
                <p class="text-xs text-muted tabular-nums">
                  −{{ formatDiscountCents(promo.discountCents) }}
                </p>
              </div>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-xs font-medium hover:bg-elevated"
                :data-testid="`remove-manual-promo-${promo.promotionId}`"
                @click="handleRemoveManualPromo(promo.promotionId)"
              >
                <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
                Quitar
              </button>
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
              v-for="promoId in vetoedPromotionIds"
              :key="promoId"
              class="flex items-center justify-between gap-2 rounded-lg border border-default px-3 py-2"
              :data-testid="`vetoed-promo-${promoId}`"
            >
              <span class="font-mono text-xs text-muted">{{ promoId }}</span>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-xs font-medium hover:bg-elevated"
                :data-testid="`unveto-promo-${promoId}`"
                @click="handleUnvetoPromotion(promoId)"
              >
                Re-activar
              </button>
            </li>
          </ul>
        </div>

        <form
          class="flex flex-col gap-2"
          data-testid="apply-manual-promo-form"
          @submit.prevent="handleApplyManualPromoSubmit"
        >
          <label class="text-xs font-semibold uppercase tracking-wide text-muted" for="apply-manual-promo-input">
            Aplicar promoción manual
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <input
              id="apply-manual-promo-input"
              v-model="applyManualPromoInput"
              type="text"
              placeholder="ID de la promoción"
              class="flex-1 min-w-48 rounded-lg border border-default bg-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="apply-manual-promo-input"
              @keyup.enter="handleApplyManualPromoSubmit"
            />
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="applyManualPromoInput.trim().length === 0"
              data-testid="apply-manual-promo-button"
              @click="handleApplyManualPromoSubmit"
            >
              Aplicar
            </button>
          </div>
        </form>

        <form
          class="flex flex-col gap-2"
          data-testid="veto-auto-promo-form"
          @submit.prevent="handleVetoAutoPromoSubmit"
        >
          <label class="text-xs font-semibold uppercase tracking-wide text-muted" for="veto-auto-promo-input">
            Vetar promoción automática
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <input
              id="veto-auto-promo-input"
              v-model="vetoAutoPromoInput"
              type="text"
              placeholder="ID de la promoción"
              class="flex-1 min-w-48 rounded-lg border border-default bg-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="veto-auto-promo-input"
              @keyup.enter="handleVetoAutoPromoSubmit"
            />
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="vetoAutoPromoInput.trim().length === 0"
              data-testid="veto-auto-promo-button"
              @click="handleVetoAutoPromoSubmit"
            >
              Vetar
            </button>
          </div>
        </form>
      </section>

      <!-- S6 — totals footer. Always visible (it just reads from the
           quotation response); the read-only branch already has the
           "Solo lectura" notice above this for clarity. -->
      <QuotationTotalsFooter :quotation="quotation" />

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
        @update:open="(value: boolean) => { if (!value) isProductSearchOpen = false }"
      >
        <template #title>Buscar productos</template>
        <template #body>
          <ProductSearchPanel
            class="h-full"
            data-testid="product-search-panel"
            @add-product="handleAddProduct"
          />
        </template>
      </USlideover>
    </template>
  </section>
</template>
