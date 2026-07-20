<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSaleDetail } from '../composables/useSaleDetail'
import { useDebtPayment } from '../composables/useDebtPayment'
import { useSaleComments } from '../composables/useSaleComments'
import { saleApi, SalePdfError, type SalePdfFormat } from '../api/sale.api'
import { productApi } from '@/features/POS/products/api/product.api'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatSaleDate } from '../utils/saleDate.utils'
import { formatPaymentMethod } from '../utils/salePaymentMethod.utils'
import { SALE_PAYMENT_STATUS, SALE_STATUS } from '../constants/sale.constants'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import SaleDetailItemsList from '../components/SaleDetailItemsList.vue'
import SaleDetailTotalsCard from '../components/SaleDetailTotalsCard.vue'
import SaleDetailTimeline from '../components/SaleDetailTimeline.vue'
import SaleCommentInput from '../components/SaleCommentInput.vue'
import SaleDetailHeader from '../components/SaleDetailHeader.vue'
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

const canRegisterPayment = computed(
  () =>
    sale.value?.paymentStatus !== SALE_PAYMENT_STATUS.PAID
    && sale.value?.status === SALE_STATUS.CONFIRMED,
)

// pos-price-list-tiers: resolve the active price list name. Mirrors the
// pattern previously used by the deleted SaleDetailMetadataCard — fetch
// once on mount so the inline label is decoupled from the network round
// trip.
const priceLists = ref<GlobalPriceList[]>([])
onMounted(async () => {
  try {
    priceLists.value = await productApi.getGlobalPriceLists()
  } catch {
    // Silently degrade — the raw ID (or "PUBLICO") will be shown as fallback.
  }
})

const priceListName = computed<string>(() => {
  const id = sale.value?.globalPriceListId
  if (!id) return 'PUBLICO'
  return priceLists.value.find((l) => l.id === id)?.name ?? id
})

const uniquePaymentMethods = computed<string[]>(() => {
  const methods = sale.value?.payments ?? []
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const p of methods) {
    if (!seen.has(p.method)) {
      seen.add(p.method)
      ordered.push(formatPaymentMethod(p.method))
    }
  }
  return ordered
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

  const items: Array<{
    label: string
    icon: string
    disabled: boolean
    loading?: boolean
    onSelect?: (event: Event) => void
  }> = [{ label: 'Imprimir Ticket', icon: 'i-lucide-printer', disabled: true }]

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

  items.push(
    { label: 'Facturar Venta', icon: 'i-lucide-file-text', disabled: true },
    { label: 'Enviar Recordatorio', icon: 'i-lucide-message-circle', disabled: true },
  )

  return items
})

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
      return { description: 'Error al generar el PDF. Intentá nuevamente', color: 'error' }
  }
  const status = (err as AxiosError)?.response?.status
  if (status === 401) return { description: 'Sesión expirada. Iniciá sesión nuevamente', color: 'error' }
  if (status === 403) return { description: 'No tenés permiso para descargar este recibo', color: 'error' }
  if (status === 404) return { description: 'Venta no encontrada', color: 'error' }
  // Network failure (no HTTP response at all).
  if (!(err as AxiosError)?.response)
    return { description: 'Error de conexión. Verificá tu red', color: 'error' }
  return { description: 'No se pudo generar el PDF. Intentá nuevamente', color: 'error' }
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
  <div v-if="canReadSales" data-testid="sale-detail-layout" class="mx-auto w-full max-w-7xl px-10 space-y-6">
    <!-- Header -->
    <SaleDetailHeader
      v-if="sale && !isLoading"
      :sale="sale"
      :action-items="actionItems"
      @back="goBack"
    />

    <!-- Receipt content (single column) -->
    <div class="space-y-6">
      <section v-if="sale" class="space-y-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
          Productos<span v-if="sale.items.length" class="text-muted/70"> · {{ sale.items.length }}</span>
        </h3>
        <SaleDetailItemsList :items="sale.items" />
      </section>
      <SaleDetailTotalsCard
        v-if="sale"
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

      <!-- Sidebar data reflow (MVP) — simple bordered cards. The richer
           inline Info Row and timestamped Payments Block are pt2. -->
      <section v-if="sale" class="space-y-3" data-testid="sidebar-data-reflow">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">Datos de la venta</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-md border border-default p-3" data-testid="reflow-cajero">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cajero</p>
            <p class="font-medium">{{ sale.cashier.name }}</p>
          </div>
          <div
            class="rounded-md border border-default p-3 cursor-pointer hover:bg-elevated/50 transition-colors"
            data-testid="reflow-vendedor"
            @click="sellerSlideoverOpen = true"
          >
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">Vendedor</p>
            <p class="font-medium" :class="{ 'text-muted': !sale.seller }">
              {{ sale.seller?.name ?? 'Sin asignar — click para asignar' }}
            </p>
          </div>
          <div class="rounded-md border border-default p-3" data-testid="reflow-cliente">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cliente</p>
            <p class="font-medium">{{ sale.customer?.name ?? 'Público en General' }}</p>
          </div>
          <div class="rounded-md border border-default p-3" data-testid="reflow-price-list">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">Lista de precios</p>
            <p class="font-medium">{{ priceListName }}</p>
          </div>
          <div class="rounded-md border border-default p-3 sm:col-span-2" data-testid="reflow-payment-methods">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">Métodos de pago</p>
            <p v-if="uniquePaymentMethods.length === 0" class="font-medium text-muted">—</p>
            <p v-else class="font-medium">{{ uniquePaymentMethods.join(' · ') }}</p>
          </div>
        </div>
      </section>

      <SaleDetailTimeline
        v-if="sale"
        :timeline="sale.timeline"
        :current-user-id="authStore.user?.id ?? null"
        :is-pending="commentsPending"
        :on-update-comment="updateComment"
        :on-delete-comment="deleteComment"
      />
      <SaleCommentInput v-if="sale" :is-pending="commentsPending" :on-submit="addComment" />
    </div>

    <DebtPaymentModal
      v-if="sale"
      v-model:open="debtModalOpen"
      :sale-id="sale.id"
      :debt-cents="sale.debtCents"
      @success="debtModalOpen = false"
    />
    <AssignSellerSlideover
      v-if="sale"
      v-model:open="sellerSlideoverOpen"
      :sale-id="sale.id"
    />
  </div>
</template>