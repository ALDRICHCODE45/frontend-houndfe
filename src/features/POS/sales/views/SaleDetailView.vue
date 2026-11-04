<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSaleDetail } from '../composables/useSaleDetail'
import { useDebtPayment } from '../composables/useDebtPayment'
import { useSaleComments } from '../composables/useSaleComments'
import { useUpdatePaymentReference } from '../composables/useUpdatePaymentReference'
import { saleApi, SalePdfError, type SalePdfFormat } from '../api/sale.api'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatSaleDate } from '../utils/saleDate.utils'
import { getDeliveryStatusBadge, getPaymentStatusBadge, saleBadgeTone } from '../utils/saleStatus.utils'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { SALE_PAYMENT_STATUS, SALE_STATUS } from '../constants/sale.constants'
import SaleDetailItemsList from '../components/SaleDetailItemsList.vue'
import SaleDetailTotalsCard from '../components/SaleDetailTotalsCard.vue'
import SaleDetailSalesDataCard from '../components/SaleDetailSalesDataCard.vue'
import SaleDetailHistoryCard from '../components/SaleDetailHistoryCard.vue'
import PaymentsListSection from '../components/PaymentsListSection.vue'
import DebtPaymentModal from '../components/DebtPaymentModal.vue'
import AssignSellerSlideover from '../components/AssignSellerSlideover.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useSaleCancellation } from '../composables/useSaleCancellation'
import '../styles/sales-detail-visual.css'

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

const saleId = computed(() => String(route.params.id ?? ''))
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const { sale, isLoading, isError, refetch } = useSaleDetail(saleId)
const { addComment, updateComment, deleteComment, isPending: commentsPending, lastError } = useSaleComments(saleId)
const debtModalOpen = ref(false)
const sellerSlideoverOpen = ref(false)
const { isSubmitting } = useDebtPayment(saleId.value)
// PCA-3: full confirmed-sale cancellation. The composable hard-codes the
// backend reason (`CUSTOMER_REQUEST`) — the view never chooses one.
const { cancelSale, isPending: cancellationPending } = useSaleCancellation(saleId)
const cancelModalOpen = ref(false)
const canCancelSale = computed(
  () => sale.value?.status === SALE_STATUS.CONFIRMED && authStore.userCan('delete', 'Sale'),
)
const cancellationDescription =
  'Esta acción cancela la venta completa: se restauran el stock de los productos y el cupo consumido de las promociones. No es un reembolso parcial y no se puede deshacer.'
// sales-pos-charge WU-B.7: PaymentsListSection emits `submit`; the view owns
// the mutation per design D6 so the section stays presentational and the
// slideover can be tested in isolation. The composable handles its own
// toast + cache invalidation, so this handler only needs to forward.
const { updateReference: updatePaymentReference, isPending: referencePending } = useUpdatePaymentReference(() => saleId.value)

async function handleReferenceSubmit(payload: { paymentId: string; reference: string | null }) {
  try {
    await updatePaymentReference({
      paymentId: payload.paymentId,
      payload: { reference: payload.reference },
    })
  } catch {
    // Toast already dispatched by the composable; swallow rejection so the
    // call site stays clean.
  }
}

const canRegisterPayment = computed(
  () =>
    sale.value?.paymentStatus !== SALE_PAYMENT_STATUS.PAID
    && sale.value?.status === SALE_STATUS.CONFIRMED,
)

// Header status badges: domain badge mapped to a StatusBadge tone.
const deliveryBadge = computed(() => {
  const badge = getDeliveryStatusBadge(sale.value?.deliveryStatus ?? '')
  return { label: badge.label, tone: saleBadgeTone(badge.color) }
})
const paymentBadge = computed(() => {
  if (!sale.value?.paymentStatus) return null
  const badge = getPaymentStatusBadge(sale.value.paymentStatus)
  return { label: badge.label, tone: saleBadgeTone(badge.color) }
})

// sales-pdf-download: tracks which PDF format is currently being fetched so
// only that dropdown row shows the loading spinner (R5). null when idle.
// Guard: if non-null, a fetch is already in-flight — reject concurrent clicks.
const generatingPdfFormat = ref<SalePdfFormat | null>(null)
const pdfAbortController = ref<AbortController | null>(null)

const actionItems = computed(() => {
  const status = sale.value?.status
  const isConfirmed = status === SALE_STATUS.CONFIRMED
  // R7: CANCELED sales MUST NOT display PDF format options at all.
  // DRAFT keeps them visible-but-disabled so the header can render the
  // "Solo disponible para ventas confirmadas" tooltip (R1).
  const showPdfEntries = status === SALE_STATUS.CONFIRMED || status === SALE_STATUS.DRAFT
  const generating = generatingPdfFormat.value

  const items: Array<RowAction & {
    loading?: boolean
    onSelect?: (event: Event) => void
  }> = []

  // The "…" marks the items that open something before acting. While one
  // receipt is being generated its row says so and the other is held (the
  // click handler already rejects a concurrent fetch).
  if (showPdfEntries) {
    items.push(
      {
        key: 'receipt-a4',
        label: generating === 'receipt-a4' ? 'Generando recibo A4…' : 'Recibo A4',
        icon: 'i-lucide-download',
        disabled: !isConfirmed || generating !== null,
        loading: generating === 'receipt-a4',
        onSelect: () => void handlePreviewPdf('receipt-a4'),
      },
      {
        key: 'receipt-ticket',
        label: generating === 'receipt-ticket' ? 'Generando recibo ticket…' : 'Recibo Ticket',
        icon: 'i-lucide-download',
        disabled: !isConfirmed || generating !== null,
        loading: generating === 'receipt-ticket',
        onSelect: () => void handlePreviewPdf('receipt-ticket'),
      },
    )
  }

  // The seller assignment has no loose header button anymore: it lives here
  // (and in the DATOS card, which stays available for every status).
  if (isConfirmed) {
    items.push({
      key: 'assign-seller',
      label: 'Asignar vendedor',
      icon: 'i-lucide-user-plus',
      disabled: false,
      onSelect: () => {
        sellerSlideoverOpen.value = true
      },
    })
  }

  // PCA-3: full-sale cancellation lives INSIDE this menu (not a wide header
  // button) so the mobile header never overflows. Rendered only for a
  // CONFIRMED sale AND the exact `delete:Sale` permission (backend guide §2.1).
  // Destructive, so last and with a confirmation.
  if (canCancelSale.value) {
    items.push({
      key: 'cancel-sale',
      label: 'Cancelar venta…',
      icon: 'i-lucide-x-circle',
      disabled: false,
      destructive: true,
      onSelect: () => {
        cancelModalOpen.value = true
      },
    })
  }

  return items
})

function onSaleAction(key: string) {
  actionItems.value.find((item) => item.key === key)?.onSelect?.(new Event('select'))
}

// PCA-3: success closes the modal; failure keeps it open so the user can
// recover (retry) or dismiss without losing context. The composable owns the
// success/error toasts and the cache invalidation.
async function handleConfirmCancellation() {
  const result = await cancelSale()
  if (result) cancelModalOpen.value = false
}

// sales-pdf-download: show the dropdown whenever there are items, regardless
// of enabled state — the user must see disabled PDF entries on DRAFT sales
// so the trigger tooltip can explain why they're unavailable (R1).
const hasAnyAction = computed(() => actionItems.value.length > 0)
// sales-pdf-download: only DRAFT has visible-but-disabled PDF entries, so
// that's the only status that needs the "Solo disponible para ventas
// confirmadas" tooltip on the trigger button. CONFIRMED → no tooltip.
const triggerTooltipText = computed(() =>
  sale.value?.status === SALE_STATUS.DRAFT ? 'Solo disponible para ventas confirmadas' : null,
)

function goBack() {
  void router.push('/pos/ventas')
}

function mapCommentErrorMessage(code?: string | null): string {
  if (code === 'COMMENT_AUTHOR_FORBIDDEN') return 'Solo el autor puede editar o eliminar este comentario'
  if (code === 'COMMENT_NOT_FOUND') return 'Comentario no encontrado'
  if (code === 'SALE_NOT_FOUND') return 'Venta no encontrada'
  return 'No se pudo guardar el comentario'
}

// sales-pdf-download: error → toast mapping (R3). Centralised so the view
// handler stays focused on flow control.
function mapPdfError(err: unknown): { description: string; color: 'error' } {
  if (err instanceof SalePdfError) {
    if (err.code === 'INVALID_FORMAT') return { description: 'Formato de recibo no válido', color: 'error' }
    if (err.code === 'SALE_NOT_CONFIRMED')
      return { description: 'Solo ventas confirmadas pueden descargar recibo', color: 'error' }
    if (err.code === 'PDF_GENERATION_FAILED')
      return { description: 'Error al generar el PDF. Intenta nuevamente', color: 'error' }
  }
  const status = (err as AxiosError)?.response?.status
  if (status === 401) return { description: 'Sesión expirada. Inicia sesión nuevamente', color: 'error' }
  if (status === 403) return { description: 'No tienes permiso para descargar este recibo', color: 'error' }
  if (status === 404) return { description: 'Venta no encontrada', color: 'error' }
  // Network failure (no HTTP response at all).
  if (!(err as AxiosError)?.response)
    return { description: 'Error de conexión. Verifica tu red', color: 'error' }
  return { description: 'No se pudo generar el PDF. Intenta nuevamente', color: 'error' }
}

// sales-pdf-download: fetch PDF blob → create object URL → window.open in a
// new tab. The object URL is revoked after a 1s grace period so the new
// tab has time to load before the source URL disappears (R6).
// Concurrency guard: rejects re-entry while a fetch is already in-flight.
// AbortController cancels in-flight requests on component unmount.
async function handlePreviewPdf(format: SalePdfFormat) {
  if (!sale.value || generatingPdfFormat.value !== null) return
  generatingPdfFormat.value = format
  let objectUrl: string | null = null
  const controller = new AbortController()
  pdfAbortController.value = controller
  try {
    const blob = await saleApi.getPdfBlob(sale.value.id, format, { signal: controller.signal })
    objectUrl = URL.createObjectURL(blob)
    const opened = window.open(objectUrl, '_blank')
    if (!opened) {
      // Popup blocked — fall back to a direct download via anchor click.
      const disposition = `attachment; filename="recibo-${sale.value.folio ?? sale.value.id}.pdf"`
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = disposition
      link.click()
      useToast().add({
        title: 'Recibo descargado',
        description: 'Se descargó el recibo. Permite ventanas emergentes para previsualizar.',
        color: 'primary',
      })
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_CANCELED') return
    const mapped = mapPdfError(error)
    useToast().add({ title: 'Error al generar el PDF', ...mapped })
  } finally {
    const urlToRevoke = objectUrl
    if (urlToRevoke) {
      setTimeout(() => URL.revokeObjectURL(urlToRevoke), 1_000)
    }
    generatingPdfFormat.value = null
    if (pdfAbortController.value === controller) {
      pdfAbortController.value = null
    }
  }
}

onUnmounted(() => {
  pdfAbortController.value?.abort()
})

watch(
  () => lastError.value,
  (error) => {
    if (!error) return
    useToast().add({ title: 'Error', description: mapCommentErrorMessage(error.code), color: 'error' })
  },
)
</script>

<template>
  <div
    v-if="canReadSales"
    class="sales-detail-visual hf-theme hf-ui -m-4 flex h-[calc(100%+2rem)] flex-col sm:-m-6 sm:h-[calc(100%+3rem)]"
  >
    <!-- Fixed compact header — identity + actions persist on scroll.
         The root consumes the dashboard panel body's padding (-m-4 sm:-m-6)
         so this header spans the full panel width at the very top. The body
         content scrolls BELOW it in its own flex-1 overflow-y-auto
         container, so nothing ever passes behind the header (no
         backdrop-blur bleed-through possible). shrink-0 keeps it pinned;
         sticky top-0 z-50 retained for HST-REQ-002 semantics. -->
    <header
      v-if="!isLoading && sale"
      class="sales-detail-sticky-header sticky top-0 z-50 w-full shrink-0 border-b backdrop-blur-sm"
      data-testid="sale-detail-header"
    >
      <div class="mx-auto w-full max-w-7xl">
        <div class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <!-- Identity: back + folio + status badges + date -->
          <div class="flex min-w-0 items-center gap-3">
            <UButton
              icon="i-lucide-arrow-left"
              variant="ghost"
              color="neutral"
              size="sm"
              aria-label="Volver"
              @click="goBack"
            />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="sale-detail-title" data-testid="header-folio">
                  Venta {{ extractFolioNumber(sale.folio) }}
                </span>
                <StatusBadge
                  v-bind="deliveryBadge"
                  aria-prefix="Productos:"
                  data-testid="badge"
                />
                <StatusBadge
                  v-if="paymentBadge"
                  v-bind="paymentBadge"
                  aria-prefix="Pago:"
                  data-testid="badge"
                />
              </div>
              <p class="sale-detail-meta" data-testid="header-date">
                {{ formatSaleDate(sale.confirmedAt) }}
              </p>
            </div>
          </div>

          <!-- Actions: total, the one primary, and the ⋮ menu for the rest -->
          <div class="flex shrink-0 items-center gap-3">
            <div class="hidden text-right sm:block">
              <p class="text-xs text-(--hf-muted)">Total</p>
              <p class="hf-figure text-xl font-semibold text-(--hf-heading)">{{ formatCentsMXN(sale.totalCents) }}</p>
            </div>

            <UButton
              v-if="canRegisterPayment"
              icon="i-lucide-credit-card"
              size="sm"
              data-testid="register-payment-header"
              class="hf-primary-control sales-detail-primary-action"
              :disabled="isSubmitting"
              @click="debtModalOpen = true"
            >
              Registrar pago
            </UButton>

            <UTooltip
              v-if="hasAnyAction && triggerTooltipText"
              :text="triggerTooltipText"
              :ui="{ content: 'hf-theme hf-ui sales-detail-portal' }"
            >
              <RowActionsMenu
                :actions="actionItems"
                aria-label="Más acciones de la venta"
                row-label="la venta"
                portal-class="sales-detail-portal"
                @select="onSaleAction"
              />
            </UTooltip>
            <RowActionsMenu
              v-else-if="hasAnyAction"
              :actions="actionItems"
              aria-label="Más acciones de la venta"
              row-label="la venta"
              portal-class="sales-detail-portal"
              @select="onSaleAction"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- Full-width scroll container — the scrollbar sits at the edge of the
         panel body (full width, unlike the old promotions workaround that
         constrained scroll to max-w-6xl); the content is centered below.
         overflow-x-hidden: the negative-margin root (-m-4 sm:-m-6) extends
         into the panel body's padding for the full-bleed header; without
         clipping here the body's computed overflow-x:auto would expose a
         horizontal scrollbar that slides the whole detail screen left. -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden" data-testid="sale-detail-layout">
      <!-- Error state: the request failed and there is nothing to show. -->
      <div
        v-if="isError && !sale"
        class="mx-auto w-full max-w-3xl px-6 pb-6 pt-16"
        data-testid="sale-detail-error"
      >
        <EmptyState
          kind="error"
          title="No se pudo cargar la venta"
          description="Revisa tu conexión e inténtalo de nuevo."
          action-label="Reintentar"
          action-test-id="sale-detail-retry"
          @action="refetch()"
        />
      </div>

      <!-- Loading skeleton, shaped like the header and the two columns -->
      <div
        v-else-if="isLoading || !sale"
        data-testid="sale-detail-skeleton"
        aria-busy="true"
        class="mx-auto w-full max-w-7xl space-y-4 px-6 pb-6 pt-16"
      >
        <USkeleton class="h-14 w-full rounded-lg" />
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <USkeleton class="h-64 w-full rounded-lg" />
          <USkeleton class="h-64 w-full rounded-lg" />
        </div>
      </div>

      <!-- Flat two-column body — replaces the previous UTabs workbench. -->
      <div v-else class="mx-auto w-full max-w-7xl px-6 pb-6 pt-16">
        <div
          class="grid gap-6 lg:grid-cols-[1fr_360px]"
          data-testid="sale-detail-layout-body"
        >
          <div class="space-y-6 order-2 lg:order-1">
            <SaleDetailItemsList
              :items="sale.items"
              portal-class="hf-theme hf-ui sales-detail-portal"
            />
            <SaleDetailSalesDataCard :sale="sale" @assign-seller="sellerSlideoverOpen = true" />
            <SaleDetailHistoryCard
              :timeline="sale.timeline"
              :current-user-id="authStore.user?.id ?? null"
              :comments-pending="commentsPending"
              :on-update-comment="updateComment"
              :on-delete-comment="deleteComment"
              :on-submit-comment="addComment"
              portal-class="hf-theme hf-ui hf-form-overlay sales-detail-portal"
            />
          </div>
          <div class="space-y-6 order-1 lg:order-2">
            <SaleDetailTotalsCard
              :subtotal-cents="sale.subtotalCents"
              :discount-cents="sale.discountCents"
              :total-cents="sale.totalCents"
              :paid-cents="sale.paidCents"
              :debt-cents="sale.debtCents"
              :change-due-cents="sale.changeDueCents"
              :can-register-payment="canRegisterPayment"
              :is-payment-submitting="isSubmitting"
              @register-payment="debtModalOpen = true"
            />
            <PaymentsListSection
              :payments="sale.payments"
              :loading="referencePending"
              data-testid="sale-detail-payments-list"
              portal-class="hf-theme hf-ui hf-form-overlay sales-detail-portal"
              @submit="handleReferenceSubmit"
            />
          </div>
        </div>

        <DebtPaymentModal
          v-model:open="debtModalOpen"
          :sale-id="sale.id"
          :debt-cents="sale.debtCents"
          portal-class="hf-theme hf-ui hf-form-overlay sales-detail-portal"
          @success="debtModalOpen = false"
        />
        <AssignSellerSlideover
          v-model:open="sellerSlideoverOpen"
          :sale-id="sale.id"
          portal-class="hf-theme hf-ui hf-form-overlay sales-detail-portal"
        />
        <ConfirmModal
          :open="cancelModalOpen"
          title="Cancelar venta"
          :description="cancellationDescription"
          confirm-label="Cancelar venta"
          confirm-color="error"
          :loading="cancellationPending"
          :ui="{ content: 'hf-theme hf-ui hf-form-overlay sales-detail-portal' }"
          @update:open="cancelModalOpen = $event"
          @confirm="handleConfirmCancellation"
        />
      </div>
    </div>
  </div>

  <EmptyState
    v-else
    kind="forbidden"
    title="Tu rol no puede ver las ventas"
    description="Pide acceso a quien administra tu cuenta."
  />
</template>
