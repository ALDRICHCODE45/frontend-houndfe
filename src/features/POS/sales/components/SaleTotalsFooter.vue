<script setup lang="ts">
import { computed } from 'vue'
import type { Sale } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  sale: Sale
  isChargePending?: boolean
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'charge-click': []
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

const subtotalFormatted = computed(() => formatCentsMXN(subtotalCents.value))
const discountFormatted = computed(() => formatCentsMXN(discountCents.value))
const totalFormatted = computed(() => formatCentsMXN(totalCents.value))

const hasDiscounts = computed(() => discountCents.value > 0)

const orderPromotion = computed(() => props.sale.appliedOrderPromotion ?? null)
const hasOrderPromotion = computed(() => orderPromotion.value !== null)
const orderPromotionTitleFormatted = computed(() => {
  const promo = orderPromotion.value
  if (!promo) return ''
  return `${promo.discountTitle} (−${formatCentsMXN(promo.discountAmountCents)})`
})

function handleRemoveOrderPromo() {
  if (orderPromotion.value) {
    emit('remove-order-promo', orderPromotion.value.promotionId)
  }
}
</script>

<template>
  <div class="mt-auto px-5 py-4">
    <!-- Phase 14b: items/units count line -->
    <p class="text-xs text-muted mb-3">
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

    <!-- Total row — Phase 14b: white, large, bold -->
    <div class="flex items-baseline justify-between mb-1">
      <p class="text-xs font-semibold text-muted uppercase tracking-wider">
        TOTAL A COBRAR
      </p>
      <span
        data-testid="total-amount"
        class="text-2xl font-extrabold text-white tabular-nums"
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
    <div class="mt-4">
      <UTooltip :text="chargeTooltip" class="w-full">
        <UButton
          color="primary"
          block
          size="xl"
          :loading="isChargePending"
          :disabled="isChargeDisabled"
          class="relative !bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm w-full"
          @click="emit('charge-click')"
        >
          <template #leading>
            <UIcon name="i-lucide-hand-coins" class="h-5 w-5" />
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
