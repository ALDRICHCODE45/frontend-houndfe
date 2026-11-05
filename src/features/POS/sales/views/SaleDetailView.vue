<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
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
import SaleDetailCancellationCard from '../components/SaleDetailCancellationCard.vue'
import SaleDetailRefundsCard from '../components/SaleDetailRefundsCard.vue'
import SettleRefundSlideover from '@/features/POS/refunds/components/SettleRefundSlideover.vue'
import type { PendingRefundListRow } from '@/features/POS/refunds/composables/usePendingRefundsList'
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
const { sale, isLoading, isError, isNotFound, refetch } = useSaleDetail(saleId)
// Below md the one primary action moves to the sticky bottom bar.
const mobile = useBreakpoints(breakpointsTailwind).smaller('md')
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

// T20: a cancelled sale opens read-only, with its cancellation and refunds.
const isCanceled = computed(() => sale.value?.status === SALE_STATUS.CANCELED)
const canSettleRefunds = computed(() => authStore.userCan('update', 'SaleRefund'))

// «Liquidar» reuses the refunds settle slideover. The row is rebuilt from the detail on every
// refetch (useSettleRefund invalidates it), so a partial return shows the new balance.
const settleOpen = ref(false)
const settleRefundId = ref<string | null>(null)
const settleRow = computed<PendingRefundListRow | null>(() => {
  const current = sale.value
  const refund = current?.refunds?.find((item) => item.id === settleRefundId.value)
  if (!current || !refund) return null
  return {
    ...refund,
    saleId: current.id,
    folioLabel: current.folio,
    customerLabel: current.customer?.name ?? 'Público general',
    saleFound: true,
  }
})

function openSettle(refundId: string) {
  if (!canSettleRefunds.value) return
  settleRefundId.value = refundId
  settleOpen.value = true
}

// Below lg the columns dissolve and each section takes its order; a cancelled sale leads
// with the cancellation and its refunds.
const sectionOrder = computed(() =>
  isCanceled.value
    ? { cancellation: 'order-1', refunds: 'order-2', items: 'order-3', totals: 'order-4', payments: 'order-5', data: 'order-6', history: 'order-7' }
    : { cancellation: '', refunds: '', items: 'order-1', totals: 'order-2', payments: 'order-3', data: 'order-4', history: 'order-5' },
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
        label: generating === 'receipt-ticket' ? 'Generando recibo ticket…' : 'Recibo ticket',
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

// The loading skeleton follows the real layout and its mobile order.
const SKELETON_MAIN = [
  { section: 'items', rows: 4, order: 'order-1' },
  { section: 'data', rows: 3, order: 'order-4' },
  { section: 'history', rows: 3, order: 'order-5' },
]
const SKELETON_SIDE = [
  { section: 'totals', rows: 4, order: 'order-2' },
  { section: 'payments', rows: 2, order: 'order-3' },
]

// Loading shows the shaped skeleton; a not-found or failed request shows its own state.
const showSkeleton = computed(() => !sale.value && !isError.value && !isNotFound.value)
const showMobileBar = computed(() => mobile.value && Boolean(sale.value) && canRegisterPayment.value)

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
          <div class="flex min-w-0 items-start gap-3 sm:items-center">
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
                <!-- A cancellation is neutral (design-system.md, Status badge). -->
                <StatusBadge
                  v-if="isCanceled"
                  label="Cancelada"
                  tone="neutral"
                  aria-prefix="Venta:"
                  data-testid="badge"
                />
                <StatusBadge
                  v-if="!isCanceled"
                  v-bind="deliveryBadge"
                  aria-prefix="Productos:"
                  data-testid="badge"
                />
                <StatusBadge
                  v-if="paymentBadge && !isCanceled"
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
              v-if="canRegisterPayment && !mobile"
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

    <!-- Loading: a header bar shaped like the real one, so the page does not
         jump when the sale arrives (also on mobile, where the header is the
         only identity the page has). -->
    <div
      v-else-if="showSkeleton"
      class="sales-detail-sticky-header w-full shrink-0 border-b"
      data-testid="sale-detail-header-skeleton"
      aria-hidden="true"
    >
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <USkeleton class="size-8 shrink-0 rounded-md" />
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <USkeleton class="h-5 w-28" />
              <USkeleton class="h-6 w-24 rounded-md" />
              <USkeleton class="hidden h-6 w-16 rounded-md sm:block" />
            </div>
            <USkeleton class="h-3.5 w-32" />
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <USkeleton class="hidden h-9 w-20 sm:block" />
          <USkeleton class="hidden h-9 w-28 rounded-md sm:block" />
          <USkeleton class="size-9 rounded-md" />
        </div>
      </div>
    </div>

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
          description="Inténtalo de nuevo en un momento."
          action-label="Reintentar"
          action-test-id="sale-detail-retry"
          @action="refetch()"
        />
      </div>

      <!-- Not found: the record does not exist. An empty state with one way
           back, never an error and never a redirect. -->
      <div
        v-else-if="isNotFound && !sale"
        class="mx-auto w-full max-w-3xl px-6 pb-6 pt-16"
        data-testid="sale-detail-not-found"
      >
        <EmptyState
          kind="empty"
          title="No encontramos la venta"
          description="Puede que se haya eliminado o que el enlace no sea correcto."
          action-label="Volver a ventas"
          action-icon="i-lucide-arrow-left"
          action-test-id="sale-detail-back"
          @action="goBack"
        />
      </div>

      <!-- Loading skeleton: the two columns as titled cards with rows -->
      <div
        v-else-if="!sale"
        data-testid="sale-detail-skeleton"
        aria-busy="true"
        class="mx-auto w-full max-w-7xl px-4 pb-6 pt-6 sm:px-6 sm:pt-16"
      >
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div class="contents lg:block lg:space-y-6">
            <div
              v-for="card in SKELETON_MAIN"
              :key="card.section"
              data-testid="sale-detail-skeleton-card"
              :data-section="card.section"
              :class="card.order"
              class="sale-detail-skeleton-card space-y-4 rounded-lg border p-4 lg:order-none"
            >
              <USkeleton class="h-5 w-36" />
              <USkeleton v-for="row in card.rows" :key="row" class="h-4 w-full" />
            </div>
          </div>
          <div class="contents lg:block lg:space-y-6">
            <div
              v-for="card in SKELETON_SIDE"
              :key="card.section"
              data-testid="sale-detail-skeleton-card"
              :data-section="card.section"
              :class="card.order"
              class="sale-detail-skeleton-card space-y-4 rounded-lg border p-4 lg:order-none"
            >
              <USkeleton class="h-5 w-28" />
              <USkeleton v-for="row in card.rows" :key="row" class="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>

      <!-- Flat two-column body — replaces the previous UTabs workbench. -->
      <div v-else class="mx-auto w-full max-w-7xl px-4 pb-6 pt-6 sm:px-6 sm:pt-16">
        <div
          class="grid gap-6 lg:grid-cols-[1fr_360px]"
          data-testid="sale-detail-layout-body"
        >
          <!-- Below lg the two columns dissolve (`contents`) and each section
               takes its `order-N`: Productos, Totales, Pagos, Datos, Historial.
               From lg the columns are back and the order is neutral. -->
          <div class="contents lg:block lg:space-y-6" data-testid="sale-detail-column-main">
            <div
              v-if="isCanceled"
              :class="sectionOrder.cancellation"
              class="lg:order-none"
              data-testid="sale-detail-section-cancellation"
            >
              <SaleDetailCancellationCard :sale="sale" />
            </div>
            <div :class="sectionOrder.items" class="lg:order-none" data-testid="sale-detail-section-items">
              <SaleDetailItemsList
                :items="sale.items"
                portal-class="hf-theme hf-ui sales-detail-portal"
              />
            </div>
            <div :class="sectionOrder.data" class="lg:order-none" data-testid="sale-detail-section-data">
              <SaleDetailSalesDataCard
                :sale="sale"
                :locked="isCanceled"
                @assign-seller="sellerSlideoverOpen = true"
              />
            </div>
            <div :class="sectionOrder.history" class="lg:order-none" data-testid="sale-detail-section-history">
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
          </div>
          <div class="contents lg:block lg:space-y-6" data-testid="sale-detail-column-side">
            <div
              v-if="isCanceled"
              :class="sectionOrder.refunds"
              class="lg:order-none"
              data-testid="sale-detail-section-refunds"
            >
              <SaleDetailRefundsCard
                :refunds="sale.refunds ?? []"
                :can-settle="canSettleRefunds"
                @settle="openSettle"
              />
            </div>
            <div :class="sectionOrder.totals" class="lg:order-none" data-testid="sale-detail-section-totals">
              <SaleDetailTotalsCard
                :subtotal-cents="sale.subtotalCents"
                :discount-cents="sale.discountCents"
                :total-cents="sale.totalCents"
                :paid-cents="sale.paidCents"
                :debt-cents="sale.debtCents"
                :change-due-cents="sale.changeDueCents"
              />
            </div>
            <div :class="sectionOrder.payments" class="lg:order-none" data-testid="sale-detail-section-payments">
              <PaymentsListSection
                :payments="sale.payments"
                :loading="referencePending"
                :readonly="isCanceled"
                data-testid="sale-detail-payments-list"
                portal-class="hf-theme hf-ui hf-form-overlay sales-detail-portal"
                @submit="handleReferenceSubmit"
              />
            </div>
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
        <!-- Mounted on the first «Liquidar», so reading a sale never loads cash sessions. -->
        <SettleRefundSlideover
          v-if="isCanceled && canSettleRefunds && settleRefundId"
          v-model:open="settleOpen"
          :refund="settleRow"
        />
      </div>
    </div>

    <!-- Mobile: the one primary lives in the sticky bottom bar. -->
    <div
      v-if="showMobileBar"
      class="sale-detail-mobile-bar"
      data-testid="sale-detail-mobile-bar"
    >
      <UButton
        block
        icon="i-lucide-credit-card"
        data-testid="register-payment-mobile"
        class="hf-primary-control sales-detail-primary-action"
        :disabled="isSubmitting"
        @click="debtModalOpen = true"
      >
        Registrar pago
      </UButton>
    </div>
  </div>

  <EmptyState
    v-else
    kind="forbidden"
    title="Tu rol no puede ver las ventas"
    description="Pide acceso a quien administra tu cuenta."
  />
</template>
