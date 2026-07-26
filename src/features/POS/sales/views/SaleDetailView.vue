<!--
THESIS: Own the persistent-header workbench; refuse the generic single-column receipt stack.
OWN-WORLD: amber/rose/zinc + Outfit + Nuxt UI 4; compact sticky header + tabbed workbench.
STORY: Cashier opens sale, reads identity in the header instantly, works one task per tab.
FIRST VIEWPORT: Sticky header (folio mono, status badge, total, actions) above tabbed body, Productos tab default.
FORM: Workbench-con-tabs structure, position 4 of 7 ordered by resonance, staging assigned, seed key 9feea6bc.
-->
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
import { getDeliveryStatusBadge, getPaymentStatusBadge } from '../utils/saleStatus.utils'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { SALE_PAYMENT_STATUS, SALE_STATUS } from '../constants/sale.constants'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import SaleDetailItemsList from '../components/SaleDetailItemsList.vue'
import SaleDetailTotalsCard from '../components/SaleDetailTotalsCard.vue'
import SaleDetailTimeline from '../components/SaleDetailTimeline.vue'
import SaleCommentInput from '../components/SaleCommentInput.vue'
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

// Header status badges — resolved from the same utils the previous
// SaleDetailHeader used, now inlined so the sticky bar owns all identity.
const deliveryBadge = computed(() => getDeliveryStatusBadge(sale.value?.deliveryStatus ?? ''))
const paymentBadge = computed(() =>
  sale.value?.paymentStatus ? getPaymentStatusBadge(sale.value.paymentStatus) : null,
)

// pos-price-list-tiers: resolve the active price list name. Mirrors the
// pattern previously used by the deleted SaleDetailMetadataCard — fetch
// once on mount so the inline label is decoupled from the network round
// trip.
const priceLists = ref<GlobalPriceList[]>([])
const priceListsLoading = ref(true)
onMounted(async () => {
  try {
    priceLists.value = await productApi.getGlobalPriceLists()
  } catch {
    // Silently degrade — the raw ID (or "PUBLICO") will be shown as fallback.
  } finally {
    priceListsLoading.value = false
  }
})

const priceListName = computed<string>(() => {
  const id = sale.value?.globalPriceListId
  if (!id) return 'PUBLICO'
  if (priceListsLoading.value) return '...'
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

// Tabbed workbench items — Productos is the default tab (index 0). The
// Pagos y deuda tab carries a debt badge when there is an outstanding
// balance so the cashier sees it without switching.
const tabItems = computed(() => {
  if (!sale.value) return []
  const itemCount = sale.value.items.length
  const debtBadge = sale.value.debtCents > 0
    ? { label: 'Deuda', color: 'error' as const, variant: 'soft' as const }
    : undefined
  return [
    { slot: 'productos', label: `Productos${itemCount ? ` · ${itemCount}` : ''}` },
    { slot: 'pagos', label: 'Pagos y deuda', badge: debtBadge },
    { slot: 'datos', label: 'Datos' },
    { slot: 'comentarios', label: 'Comentarios' },
  ]
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
  <div v-if="canReadSales" data-testid="sale-detail-layout" class="mx-auto w-full max-w-7xl">
    <!-- Loading skeleton -->
    <div
      v-if="isLoading || !sale"
      data-testid="sale-detail-skeleton"
      class="space-y-4 p-6"
    >
      <USkeleton class="h-14 w-full rounded-lg" />
      <USkeleton class="h-10 w-full max-w-sm" />
      <USkeleton class="h-64 w-full rounded-lg" />
    </div>

    <!-- Workbench -->
    <template v-else>
      <!-- Sticky compact header — identity + actions persist on scroll -->
      <header
        class="sticky top-0 z-30 border-b border-default bg-coco-neutral-50/90 backdrop-blur-sm dark:bg-coco-neutral-950/90"
        data-testid="sale-detail-header"
      >
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
              <p class="text-base font-bold tabular-nums text-highlighted sm:hidden">
                {{ formatCentsMXN(sale.totalCents) }}
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
                  aria-label="Más acciones"
                />
              </UTooltip>
              <UButton
                v-else
                icon="i-lucide-file-text"
                trailing-icon="i-lucide-chevron-down"
                variant="outline"
                size="sm"
                aria-label="Más acciones"
              />
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
      </header>

      <!-- Tabbed body — one task per tab, Productos default -->
      <div class="p-6">
        <UTabs
          :items="tabItems"
          :unmount-on-hide="false"
          default-value="0"
          class="w-full"
          data-testid="sale-detail-tabs"
        >
          <template #productos>
            <div class="pt-4">
              <SaleDetailItemsList :items="sale.items" />
            </div>
          </template>

          <template #pagos>
            <div class="pt-4">
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
            </div>
          </template>

          <template #datos>
            <section class="space-y-3 pt-4" data-testid="sidebar-data-reflow">
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3" data-testid="reflow-cajero">
                  <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cajero</p>
                  <p class="font-medium">{{ sale.cashier.name }}</p>
                </div>
                 <div
                   role="button"
                   tabindex="0"
                   class="cursor-pointer rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3 transition-colors hover:bg-elevated/50"
                   data-testid="reflow-vendedor"
                   @click="sellerSlideoverOpen = true"
                   @keydown.enter.prevent="sellerSlideoverOpen = true"
                   @keydown.space.prevent="sellerSlideoverOpen = true"
                 >
                  <p class="text-xs font-semibold uppercase tracking-wider text-muted">Vendedor</p>
                  <p class="font-medium" :class="{ 'text-muted': !sale.seller }">
                    {{ sale.seller?.name ?? 'Sin asignar — click para asignar' }}
                  </p>
                </div>
                <div class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3" data-testid="reflow-cliente">
                  <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cliente</p>
                  <p class="font-medium">{{ sale.customer?.name ?? 'Público en General' }}</p>
                </div>
                <div class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3" data-testid="reflow-price-list">
                  <p class="text-xs font-semibold uppercase tracking-wider text-muted">Lista de precios</p>
                  <p class="font-medium">{{ priceListName }}</p>
                </div>
                <div class="rounded-lg shadow-sm bg-coco-neutral-50 dark:bg-coco-neutral-950 border border-default p-3 sm:col-span-2" data-testid="reflow-payment-methods">
                  <p class="text-xs font-semibold uppercase tracking-wider text-muted">Métodos de pago</p>
                  <p v-if="uniquePaymentMethods.length === 0" class="font-medium text-muted">—</p>
                  <p v-else class="font-medium">{{ uniquePaymentMethods.join(' · ') }}</p>
                </div>
              </div>
            </section>
          </template>

          <template #comentarios>
            <div class="space-y-4 pt-4">
              <SaleDetailTimeline
                :timeline="sale.timeline"
                :current-user-id="authStore.user?.id ?? null"
                :is-pending="commentsPending"
                :on-update-comment="updateComment"
                :on-delete-comment="deleteComment"
              />
              <SaleCommentInput :is-pending="commentsPending" :on-submit="addComment" />
            </div>
          </template>
        </UTabs>
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
    </template>
  </div>
</template>
