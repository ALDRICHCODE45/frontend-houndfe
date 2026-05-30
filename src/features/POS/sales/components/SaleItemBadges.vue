<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { formatCentsMXN } from '../utils/currency.utils'
import type { PriceSource } from '../interfaces/sale.types'

// Shared between draft items (SaleItem) and confirmed-sale items
// (SaleDetailItem). Both expose the same traceability fields, so a
// single presentational component covers both surfaces and guarantees
// visual consistency between the POS draft and the sale detail view.
const props = defineProps<{
  priceSource?: PriceSource | null
  originalPriceCents?: number | null
  unitPriceCents: number
  discountType?: 'amount' | 'percentage' | null
  discountValue?: number | null
  discountAmountCents?: number | null
  discountTitle?: string | null
}>()

const priceChanged = computed(
  () =>
    props.originalPriceCents != null &&
    props.originalPriceCents !== props.unitPriceCents,
)

const priceSourceBadge = computed(() => {
  if (props.priceSource === 'price_list' && priceChanged.value) {
    return {
      label: 'PRECIO LISTA',
      icon: 'i-lucide-tags',
      tone: 'info' as const,
    }
  }
  if (props.priceSource === 'custom' && priceChanged.value) {
    return {
      label: 'PRECIO MANUAL',
      icon: 'i-lucide-pencil-ruler',
      tone: 'warning' as const,
    }
  }
  return null
})

const discountBadgeLabel = computed(() => {
  if (props.discountType === 'percentage') {
    return `DESCUENTO -${props.discountValue ?? 0}%`
  }
  if (props.discountAmountCents) {
    return `DESCUENTO -${formatCentsMXN(props.discountAmountCents)}`
  }
  return 'DESCUENTO'
})

const hasAnyBadge = computed(
  () => priceSourceBadge.value !== null || props.discountType != null,
)
</script>

<template>
  <div
    v-if="hasAnyBadge"
    data-testid="sale-item-badge-group"
    class="flex flex-wrap items-center gap-1"
  >
    <AppBadge
      v-if="priceSourceBadge"
      :tone="priceSourceBadge.tone"
      :icon="priceSourceBadge.icon"
      :label="priceSourceBadge.label"
    />

    <UTooltip v-if="discountType && discountTitle" :text="discountTitle">
      <AppBadge
        tone="success"
        icon="i-lucide-badge-percent"
        :label="discountBadgeLabel"
      />
    </UTooltip>
    <AppBadge
      v-else-if="discountType"
      tone="success"
      icon="i-lucide-badge-percent"
      :label="discountBadgeLabel"
    />
  </div>
</template>
