<script setup lang="ts">
import { computed } from 'vue'
import type { Sale } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    sale: Sale
    isChargePending?: boolean
    /**
     * Presentation-only opt-in used by the Sales entry boundary. When false
     * (the default) the charge action keeps the exact prior legacy classes.
     */
    themed?: boolean
    /** Optional native tooltip boundary; independent of the charge styling. */
    portalClass?: string
    /**
     * Presentation-only opt-in for the exact v0 cart composition (T11). False
     * by default, so the totals keep the previous labels and paint.
     */
    composition?: boolean
  }>(),
  { themed: false, composition: false },
)

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'charge-click': []
  'clear-click': []
  'remove-order-promo': [promotionId: string]
}>()

// ── Computed ──────────────────────────────────────────────────────────────────

const items = computed(() => props.sale.items)

const lineCount = computed(() => items.value.length)

const totalQuantity = computed(() =>
  items.value.reduce((sum, item) => sum + item.quantity, 0),
)

const subtotalCents = computed(() => props.sale.subtotalCents ?? 0)
const discountCents = computed(() => props.sale.discountCents ?? 0)
const totalCents = computed(() => props.sale.totalCents ?? 0)

const hasItems = computed(() => items.value.length > 0)
const isChargeDisabled = computed(() => !hasItems.value || Boolean(props.isChargePending))
const chargeTooltip = computed(() => {
  if (!hasItems.value) return 'La venta no tiene productos'
  if (props.isChargePending) return 'Cobro en proceso'
  return ''
})

// T3: the caller opts into the shared action foreground pairing, so the forced
// legacy gold utility is replaced only when requested. Omission keeps the
// previous class string byte-identical.
const chargeButtonClass = computed(() =>
  props.themed
    ? 'relative sales-entry-primary-action sales-pos-charge-button rounded-xl font-semibold shadow-sm w-full'
    : 'relative !bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm w-full',
)

const subtotalFormatted = computed(() => formatCentsMXN(subtotalCents.value))
const discountFormatted = computed(() => formatCentsMXN(discountCents.value))
const totalFormatted = computed(() => formatCentsMXN(totalCents.value))

const hasDiscounts = computed(() => discountCents.value > 0)

const orderPromotion = computed(() => props.sale.appliedOrderPromotion ?? null)
const hasOrderPromotion = computed(() => orderPromotion.value !== null)

function handleRemoveOrderPromo() {
  if (orderPromotion.value) {
    emit('remove-order-promo', orderPromotion.value.promotionId)
  }
}
</script>

<template>
  <div
    class="mt-auto px-5 py-4 sales-pos-totals"
    :class="{ 'sales-pos-totals-composition': composition }"
  >
    <!-- Phase 14b: items/units count line. The exact cart composition reads the
         accepted v0 wording; the omitted opt-in keeps the prior string. -->
    <div v-if="composition" data-testid="totals-summary" class="sales-pos-totals-summary">
      <p data-testid="totals-count" class="text-xs text-muted sales-pos-totals-count">
        {{ lineCount }} {{ lineCount === 1 ? 'artículo' : 'artículos' }} · {{ totalQuantity }} {{ totalQuantity === 1 ? 'unidad' : 'unidades' }}
      </p>
      <UButton
        data-testid="totals-clear"
        class="sales-pos-summary-clear"
        color="neutral"
        variant="ghost"
        icon="i-lucide-trash-2"
        :disabled="isChargeDisabled"
        @click="emit('clear-click')"
      >Vaciar</UButton>
    </div>
    <p v-else data-testid="totals-count" class="text-xs text-muted mb-3 sales-pos-totals-count">
      {{ lineCount }} Artic · {{ totalQuantity }} Unidad
    </p>

    <!-- Subtotal row -->
    <div class="flex items-center justify-between mb-1.5">
      <span class="text-sm text-muted">Subtotal</span>
      <span class="text-sm text-muted tabular-nums">{{ subtotalFormatted }}</span>
    </div>

    <!-- Discounts row (only when there are discounts) -->
    <div v-if="hasDiscounts" class="flex items-center justify-between mb-1.5">
      <span class="text-sm text-primary flex items-center gap-1">
        <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5" />
        Descuentos
      </span>
      <span class="text-sm font-medium text-primary tabular-nums">-{{ discountFormatted }}</span>
    </div>

    <USeparator class="my-3 opacity-70" />

    <!-- Total row — Phase 14b: large, bold, adaptive to surface -->
    <div class="flex items-baseline justify-between mb-1">
      <div class="flex flex-col">
        <p class="text-xs font-semibold text-muted uppercase tracking-wider sales-pos-totals-label">
          TOTAL A COBRAR
        </p>
        <span
          v-if="composition"
          data-testid="totals-currency"
          class="sales-pos-totals-currency text-muted"
        >Moneda MXN</span>
      </div>
      <span
        data-testid="total-amount"
        class="text-2xl font-extrabold text-highlighted tabular-nums sales-pos-total-amount"
      >{{ totalFormatted }}</span>
    </div>

    <!-- Order promotion (BACKEND-PROVIDED) -->
    <div
      v-if="hasOrderPromotion && orderPromotion"
      data-testid="order-promotion-row"
      class="flex items-center justify-between mb-1.5 mt-2 rounded-md bg-success/10 dark:bg-success/15 px-2 py-1.5"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5 text-success shrink-0" />
        <span class="text-xs font-medium text-success truncate">{{ orderPromotion.discountTitle }}</span>
        <span class="text-xs text-success/80 tabular-nums shrink-0">−{{ formatCentsMXN(orderPromotion.discountAmountCents) }}</span>
      </div>
      <UButton
        data-testid="order-promo-remove"
        icon="i-lucide-x"
        size="xs"
        color="success"
        variant="ghost"
        aria-label="Quitar promoción"
        @click="handleRemoveOrderPromo"
      />
    </div>

    <!-- Cobrar button — Phase 14b: w-full -->
    <div class="mt-4 sales-pos-charge">
      <UTooltip
        :text="chargeTooltip"
        :ui="portalClass ? { content: portalClass } : undefined"
        class="w-full"
      >
        <UButton
          color="primary"
          block
          size="xl"
          :loading="isChargePending"
          :disabled="isChargeDisabled"
          :class="chargeButtonClass"
          @click="emit('charge-click')"
        >
          <template #leading>
            <UIcon name="i-lucide-credit-card" class="h-5 w-5" />
          </template>
          Cobrar
          <template #trailing>
            <UKbd class="ml-auto">F8</UKbd>
          </template>
        </UButton>
      </UTooltip>
    </div>
  </div>
</template>
