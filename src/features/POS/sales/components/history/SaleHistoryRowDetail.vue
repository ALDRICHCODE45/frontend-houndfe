<script setup lang="ts">
/**
 * Sales history redesign T1 (S2): the detail an expanded history row shows, loaded with one
 * GET /sales/:id. Shared by the customer history and the seller report: «Abrir venta» routes to the
 * sale detail; «Cobrar» only when the consumer allows it, the user may register a payment
 * (`update:Sale`, as on the sale detail page) and the confirmed sale still owes.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { SALE_STATUS } from '../../constants/sale.constants'
import { formatCentsMXN } from '../../utils/currency.utils'
import { formatSaleDueDate } from '../../utils/saleDate.utils'
import { getMethodMeta } from '../../utils/paymentMethodMeta'
import { saleDeliveryBadge } from '../../utils/saleStatus.utils'
import SaleLinePetLabel from '../SaleLinePetLabel.vue'
import { useSaleHistoryDetail } from './useSaleHistoryDetail'

export interface SaleHistoryChargeRequest {
  saleId: string
  debtCents: number
}

const props = withDefaults(
  defineProps<{
    saleId: string
    allowCharge?: boolean
    party?: 'seller' | 'customer'
    /**
     * The host row already draws the surface (customer history table row / mobile card), so the
     * detail drops its own border, corner and fill instead of nesting a card (design/system.md:130,
     * style-cleanup U3). The seller report keeps the default bordered panel.
     */
    embedded?: boolean
  }>(),
  { allowCharge: false, party: 'seller', embedded: false },
)
const emit = defineEmits<{ charge: [request: SaleHistoryChargeRequest] }>()

const router = useRouter()
const authStore = useAuthStore()
const { sale, isLoading, isError, refetch } = useSaleHistoryDetail(() => props.saleId)

const paymentMethods = computed(() => {
  const labels = (sale.value?.payments ?? []).map(
    (payment) => payment.paymentMethodName ?? getMethodMeta(payment.method).label,
  )
  return labels.length ? [...new Set(labels)].join(' · ') : '—'
})
const partyLine = computed(() =>
  props.party === 'customer'
    ? { term: 'Cliente', name: sale.value?.customer?.name ?? 'Público general' }
    : { term: 'Vendedor', name: sale.value?.seller?.name ?? '—' },
)
const delivery = computed(() => (sale.value ? saleDeliveryBadge(sale.value)?.label : undefined))
const canCharge = computed(
  () =>
    props.allowCharge &&
    !!sale.value &&
    sale.value.status === SALE_STATUS.CONFIRMED &&
    sale.value.debtCents > 0 &&
    authStore.userCan('update', 'Sale'),
)

function quantityLabel(quantity: number): string {
  return `${quantity} ${quantity === 1 ? 'pza' : 'pzas'}`
}

function openSale() {
  void router.push({ name: 'pos-sale-detail', params: { id: props.saleId } })
}

function charge() {
  if (!sale.value) return
  emit('charge', { saleId: props.saleId, debtCents: sale.value.debtCents })
}
</script>

<template>
  <div
    data-testid="sale-history-detail"
    :data-embedded="embedded ? 'true' : undefined"
    class="min-w-0 px-4 py-3 text-[13px]"
    :class="{ 'rounded-lg border border-[var(--hf-border)] bg-[var(--hf-surface)]': !embedded }"
  >
    <div v-if="isLoading" aria-busy="true" class="grid gap-2">
      <span class="sr-only" role="status">Cargando el detalle de la venta…</span>
      <USkeleton v-for="index in 3" :key="index" class="h-4 w-full !rounded" />
    </div>

    <div v-else-if="isError || !sale" role="alert" class="flex flex-wrap items-center gap-3">
      <UIcon
        name="i-lucide-triangle-alert"
        class="size-4 shrink-0 text-[var(--hf-danger)]"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 font-medium text-[var(--hf-danger)]"
        >No se pudo cargar el detalle de la venta.</span
      >
      <UButton size="sm" color="neutral" variant="outline" class="min-h-11" @click="refetch()"
        >Reintentar</UButton
      >
    </div>

    <template v-else>
      <div class="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section class="min-w-0" aria-label="Datos de la venta">
          <h4 class="mb-1.5 text-[13px] font-semibold text-[var(--hf-heading)]">
            Datos de la venta
          </h4>
          <dl
            data-testid="sale-history-detail-data"
            class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1"
          >
            <dt class="text-[var(--hf-muted)]">{{ partyLine.term }}</dt>
            <dd class="break-words font-medium text-[var(--hf-ink)]">
              {{ partyLine.name }}
            </dd>
            <dt class="text-[var(--hf-muted)]">Cajero</dt>
            <dd class="break-words font-medium text-[var(--hf-ink)]">{{ sale.cashier.name }}</dd>
            <dt class="text-[var(--hf-muted)]">Pago</dt>
            <dd class="break-words font-medium text-[var(--hf-ink)]">{{ paymentMethods }}</dd>
            <dt class="text-[var(--hf-muted)]">Pagado</dt>
            <dd class="hf-figure font-medium text-[var(--hf-ink)]">
              {{ formatCentsMXN(sale.paidCents) }}
            </dd>
            <template v-if="sale.dueDate">
              <dt class="text-[var(--hf-muted)]">Vence</dt>
              <dd class="hf-figure font-medium text-[var(--hf-ink)]">
                {{ formatSaleDueDate(sale.dueDate) }}
              </dd>
            </template>
            <template v-if="delivery">
              <dt class="text-[var(--hf-muted)]">Entrega</dt>
              <dd class="font-medium text-[var(--hf-ink)]">{{ delivery }}</dd>
            </template>
          </dl>
        </section>

        <section class="min-w-0" aria-label="Productos de la venta">
          <h4 class="mb-1.5 text-[13px] font-semibold text-[var(--hf-heading)]">
            Productos · {{ sale.items.length }}
          </h4>
          <ul class="grid gap-1.5">
            <li
              v-for="(item, index) in sale.items"
              :key="index"
              data-testid="sale-history-detail-item"
              class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5"
            >
              <span class="break-words font-medium text-[var(--hf-ink)]">{{
                item.productName
              }}</span>
              <span class="hf-figure text-right font-medium text-[var(--hf-ink)]">{{
                formatCentsMXN(item.subtotalCents)
              }}</span>
              <span
                class="col-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--hf-muted)]"
              >
                <span>{{
                  [item.variantName, quantityLabel(item.quantity)].filter(Boolean).join(' · ')
                }}</span>
                <SaleLinePetLabel v-if="item.pet" :pet="item.pet" />
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div
        class="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--hf-border)] pt-3"
      >
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-external-link"
          class="min-h-11 flex-1 justify-center sm:flex-none"
          @click="openSale"
        >
          Abrir venta
        </UButton>
        <UButton
          v-if="canCharge"
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-wallet"
          class="min-h-11 flex-1 justify-center sm:flex-none"
          @click="charge"
        >
          Cobrar <span class="hf-figure">{{ formatCentsMXN(sale.debtCents) }}</span>
        </UButton>
      </div>
    </template>
  </div>
</template>
