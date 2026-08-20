<!--
THESIS: Own the persistent-header detail; refuse the generic single-column receipt stack AND the tabbed workbench.
OWN-WORLD: amber/rose/zinc + Outfit + Nuxt UI 4; compact sticky header + flat two-column body.
STORY: Cashier opens sale, reads identity in the header instantly, scans PRODUCTOS / DATOS / HISTORIAL on the left and TOTALES / PAGOS on the right without tab friction.
FIRST VIEWPORT: Sticky header above a flat 1fr/360px grid; right column renders first on mobile.
FORM: Flat two-column structure, position 4 of 7 ordered by resonance, staging assigned, seed key 9feea6bc.
-->
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
import { getDeliveryStatusBadge, getPaymentStatusBadge } from '../utils/saleStatus.utils'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { SALE_PAYMENT_STATUS, SALE_STATUS } from '../constants/sale.constants'
import SaleDetailItemsList from '../components/SaleDetailItemsList.vue'
import SaleDetailTotalsCard from '../components/SaleDetailTotalsCard.vue'
import SaleDetailSalesDataCard from '../components/SaleDetailSalesDataCard.vue'
import SaleDetailHistoryCard from '../components/SaleDetailHistoryCard.vue'
import PaymentsListSection from '../components/PaymentsListSection.vue'
import DebtPaymentModal from '../components/DebtPaymentModal.vue'
import AssignSellerSlideover from '../components/AssignSellerSlideover.vue'

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
const { sale, isLoading } = useSaleDetail(saleId)
const { addComment, updateComment, deleteComment, isPending: commentsPending, lastError } = useSaleComments(saleId)
const debtModalOpen = ref(false)
const sellerSlideoverOpen = ref(false)
const { isSubmitting } = useDebtPayment(saleId.value)
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

// Header status badges — resolved from the same utils the previous
// SaleDetailHeader used, now inlined so the sticky bar owns all identity.
const deliveryBadge = computed(() => getDeliveryStatusBadge(sale.value?.deliveryStatus ?? ''))
const paymentBadge = computed(() =>
  sale.value?.paymentStatus ? getPaymentStatusBadge(sale.value.paymentStatus) : null,
)

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

  const items: Array<{
    label: string
    icon: string
    disabled: boolean
    loading?: boolean
    onSelect?: (event: Event) => void
  }> = []

  if (showPdfEntries) {
    items.push(
      {
        label: 'Recibo A4',
        icon: 'i-lucide-download',
        disabled: !isConfirmed,
        loading: generatingPdfFormat.value === 'receipt-a4',
        onSelect: () => void handlePreviewPdf('receipt-a4'),
      },
      {
        label: 'Recibo Ticket',
        icon: 'i-lucide-download',
        disabled: !isConfirmed,
        loading: generatingPdfFormat.value === 'receipt-ticket',
        onSelect: () => void handlePreviewPdf('receipt-ticket'),
      },
    )
  }

  return items
})

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
  if (status === 401) return { description: 'Sesión expirada. Iniciá sesión nuevamente', color: 'error' }
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
        description: 'Se descargó el recibo. Permití ventanas emergentes para previsualizar.',
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
  <div v-if="canReadSales" class="-m-4 flex h-[calc(100%+2rem)] flex-col sm:-m-6 sm:h-[calc(100%+3rem)]">
    <!-- Fixed compact header — identity + actions persist on scroll.
         The root consumes the dashboard panel body's padding (-m-4 sm:-m-6)
         so this header spans the full panel width at the very top. The body
         content scrolls BELOW it in its own flex-1 overflow-y-auto
         container, so nothing ever passes behind the header (no
         backdrop-blur bleed-through possible). shrink-0 keeps it pinned;
         sticky top-0 z-50 retained for HST-REQ-002 semantics. -->
    <header
      v-if="!isLoading && sale"
      class="sticky top-0 z-50 w-full shrink-0 border-b border-default bg-coco-neutral-50/90 backdrop-blur-sm dark:bg-coco-neutral-950/90"
      data-testid="sale-detail-header"
    >
      <div class="mx-auto w-full max-w-7xl">
        <div class="flex items-center justify-between gap-4 px-6 py-3">
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
                <span
                  class="font-mono text-lg font-bold tabular-nums text-highlighted"
                  data-testid="header-folio"
                >
                  Venta {{ extractFolioNumber(sale.folio) }}
                </span>
                <UBadge
                  :color="deliveryBadge.color"
                  size="sm"
                  variant="soft"
                  data-testid="badge"
                >
                  {{ deliveryBadge.label }}
                </UBadge>
                <UBadge
                  v-if="paymentBadge"
                  :color="paymentBadge.color"
                  size="sm"
                  variant="soft"
                  data-testid="badge"
                >
                  {{ paymentBadge.label }}
                </UBadge>
              </div>
              <p
                class="text-xs tabular-nums text-muted"
                data-testid="header-date"
              >
                {{ formatSaleDate(sale.confirmedAt) }}
              </p>
            </div>
          </div>

          <!-- Actions: total + PDF dropdown + register payment + assign seller -->
          <div class="flex shrink-0 items-center gap-3">
            <div class="hidden text-right sm:block">
              <p class="text-xs text-muted">Total</p>
              <p class="text-xl font-bold tabular-nums">{{ formatCentsMXN(sale.totalCents) }}</p>
            </div>

            <UDropdownMenu v-if="hasAnyAction" :items="actionItems">
              <UTooltip v-if="triggerTooltipText" :text="triggerTooltipText">
                <UButton
                  icon="i-lucide-file-text"
                  trailing-icon="i-lucide-chevron-down"
                  variant="outline"
                  size="sm"
                  aria-label="Comprobante"
                />
              </UTooltip>
              <UButton
                v-else
                icon="i-lucide-file-text"
                trailing-icon="i-lucide-chevron-down"
                variant="outline"
                size="sm"
                aria-label="Comprobante"
              >
                Comprobante
              </UButton>
            </UDropdownMenu>

            <UButton
              v-if="canRegisterPayment"
              color="primary"
              icon="i-lucide-credit-card"
              size="sm"
              data-testid="register-payment-header"
              class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
              :disabled="isSubmitting"
              @click="debtModalOpen = true"
            >
              Registrar pago
            </UButton>

            <UButton
              variant="outline"
              size="sm"
              icon="i-lucide-user-plus"
              class="hidden lg:inline-flex"
              @click="sellerSlideoverOpen = true"
            >
              Asignar vendedor
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <!-- Full-width scroll container — the scrollbar sits at the edge of the
         panel body (full width, unlike the old promotions workaround that
         constrained scroll to max-w-6xl); the content is centered below. -->
    <div class="flex-1 overflow-y-auto" data-testid="sale-detail-layout">
      <!-- Loading skeleton -->
      <div
        v-if="isLoading || !sale"
        data-testid="sale-detail-skeleton"
        class="mx-auto w-full max-w-7xl space-y-4 p-6"
      >
        <USkeleton class="h-14 w-full rounded-lg" />
        <USkeleton class="h-10 w-full max-w-sm" />
        <USkeleton class="h-64 w-full rounded-lg" />
      </div>

      <!-- Flat two-column body — replaces the previous UTabs workbench. -->
      <div v-else class="mx-auto w-full max-w-7xl p-6">
        <div
          class="grid gap-6 lg:grid-cols-[1fr_360px]"
          data-testid="sale-detail-layout-body"
        >
          <div class="space-y-6 order-2 lg:order-1">
            <SaleDetailItemsList :items="sale.items" />
            <SaleDetailSalesDataCard :sale="sale" @assign-seller="sellerSlideoverOpen = true" />
            <SaleDetailHistoryCard
              :timeline="sale.timeline"
              :current-user-id="authStore.user?.id ?? null"
              :comments-pending="commentsPending"
              :on-update-comment="updateComment"
              :on-delete-comment="deleteComment"
              :on-submit-comment="addComment"
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
              @submit="handleReferenceSubmit"
            />
          </div>
        </div>

        <DebtPaymentModal
          v-model:open="debtModalOpen"
          :sale-id="sale.id"
          :debt-cents="sale.debtCents"
          @success="debtModalOpen = false"
        />
        <AssignSellerSlideover
          v-model:open="sellerSlideoverOpen"
          :sale-id="sale.id"
        />
      </div>
    </div>
  </div>
</template>
