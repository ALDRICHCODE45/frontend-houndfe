<script setup lang="ts">
import { computed } from 'vue'
import type { SaleItem } from '../interfaces/sale.types'
import { formatCentsMXN, sumLineCents } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  items: SaleItem[]
}>()

// ── Computed ──────────────────────────────────────────────────────────────────

const lineCount = computed(() => props.items.length)

const totalQuantity = computed(() =>
  props.items.reduce((sum, item) => sum + item.quantity, 0),
)

const subtotalCents = computed(() => {
  // Sum using pre-discount prices when available, otherwise unit prices
  return props.items.reduce((sum, item) => {
    const priceCents = item.prePriceCentsBeforeDiscount ?? item.unitPriceCents
    return sum + priceCents * item.quantity
  }, 0)
})

const totalCents = computed(() => sumLineCents(props.items))

const discountCents = computed(() => subtotalCents.value - totalCents.value)

const hasDiscounts = computed(() => discountCents.value > 0)

const totalFormatted = computed(() => formatCentsMXN(totalCents.value))

const subtotalFormatted = computed(() => formatCentsMXN(subtotalCents.value))

const discountFormatted = computed(() => formatCentsMXN(discountCents.value))
</script>

<template>
  <div class="sticky bottom-0 bg-default border-t border-default px-5 py-4">
    <!-- Subtotal row -->
    <div class="flex items-center justify-between mb-1.5">
      <span class="text-sm text-muted">Subtotal</span>
      <span class="text-sm text-muted tabular-nums">{{ subtotalFormatted }}</span>
    </div>

    <!-- Discounts row (only when there are item-level discounts) -->
    <div v-if="hasDiscounts" class="flex items-center justify-between mb-1.5">
      <span class="text-sm text-primary flex items-center gap-1">
        <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5" />
        Descuentos
      </span>
      <span class="text-sm font-medium text-primary tabular-nums">-{{ discountFormatted }}</span>
    </div>

    <USeparator class="my-3" />

    <!-- Total row -->
    <div class="flex items-baseline justify-between mb-1">
      <div>
        <p class="text-xs font-semibold text-muted uppercase tracking-wider">Total a cobrar</p>
        <p class="text-[11px] text-dimmed mt-0.5">
          {{ totalQuantity }} {{ totalQuantity === 1 ? 'producto' : 'productos' }} · {{ lineCount }} {{ lineCount === 1 ? 'línea' : 'líneas' }}
        </p>
      </div>
      <span class="text-2xl font-bold text-highlighted tabular-nums">{{ totalFormatted }}</span>
    </div>

    <!-- Cobrar button -->
    <div class="mt-4">
      <UTooltip text="Disponible próximamente" class="w-full">
        <UButton color="primary" block size="xl" disabled class="relative">
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
