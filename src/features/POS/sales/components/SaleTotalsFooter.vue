<script setup lang="ts">
import { computed } from 'vue'
import type { Sale } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

// promotions-in-sale B.1: read totals from the backend-owned Sale fields.
// Pre-deploy drafts (missing totals) fall back to 0 via `?? 0` — no crash.
const props = defineProps<{
  sale: Sale
  isChargePending?: boolean
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

// `remove-order-promo` (work-unit B) wires the order-promo remove control.
// The orchestrator (SalesView) routes it through the veto confirmation flow
// in work-unit C.5 — here we only forward the promotionId.
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

// Backend-owned totals — no client-side reduce on money. The pre-deploy
// draft (totals fields undefined) renders `?? 0` and never crashes.
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
  <div class="mt-auto bg-default/95 backdrop-blur supports-[backdrop-filter]:bg-default/90 border-t border-default px-5 py-4">
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

    <!-- Total row -->
    <div class="flex items-baseline justify-between mb-1">
      <div>
        <p class="text-xs font-semibold text-muted uppercase tracking-wider">Total a cobrar</p>
        <p class="text-[11px] text-dimmed mt-0.5">
          {{ totalQuantity }} {{ totalQuantity === 1 ? 'producto' : 'productos' }} · {{ lineCount }} {{ lineCount === 1 ? 'línea' : 'líneas' }}
        </p>
      </div>
      <span class="text-[34px] leading-none font-extrabold text-highlighted tabular-nums">{{ totalFormatted }}</span>
    </div>

    <!-- Order promotion (BACKEND-PROVIDED). Render ONLY when appliedOrderPromotion != null.
         Remove control emits `remove-order-promo` for SalesView to route through veto (work-unit C.5). -->
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

    <!-- Cobrar button -->
    <div class="mt-4">
      <UTooltip :text="chargeTooltip" class="w-full">
        <UButton color="primary" block size="xl" :loading="isChargePending" :disabled="isChargeDisabled" class="relative rounded-xl font-semibold shadow-sm" @click="emit('charge-click')">
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
