<script setup lang="ts">
import { formatCentsMXN } from '../utils/currency.utils'
import type { SaleDetailItem } from '../interfaces/sale.types'

defineProps<{
  items: SaleDetailItem[]
}>()
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(item, index) in items"
      :key="`${item.productName}-${index}`"
      :data-testid="`item-card-${index}`"
      class="flex items-center gap-4 rounded-xl border border-default bg-default px-4 py-3"
    >
      <UAvatar
        v-if="item.imageUrl"
        :data-testid="`item-image-${index}`"
        :src="item.imageUrl"
        :alt="`${item.productName}${item.variantName ? ' - ' + item.variantName : ''}`"
        size="lg"
        :ui="{ rounded: 'rounded-lg' }"
      />
      <UAvatar
        v-else
        :data-testid="`item-image-${index}`"
        icon="i-lucide-image-off"
        alt="Sin imagen"
        size="lg"
        :ui="{ rounded: 'rounded-lg' }"
      />

      <div class="flex-1 min-w-0">
        <p :data-testid="`item-name-${index}`" class="text-base font-semibold text-highlighted">{{ item.productName }}</p>
        <p v-if="item.variantName" :data-testid="`item-subtitle-${index}`" class="text-sm text-muted">
          {{ item.variantName }} • {{ formatCentsMXN(item.unitPriceCents) }}
        </p>
        <p v-else :data-testid="`item-subtitle-${index}`" class="text-sm text-muted">
          {{ formatCentsMXN(item.unitPriceCents) }}
        </p>
      </div>

      <span :data-testid="`item-quantity-${index}`" class="ml-auto text-sm text-muted tabular-nums">× {{ item.quantity }}</span>

      <p :data-testid="`item-subtotal-${index}`" class="min-w-[88px] text-right text-sm font-semibold tabular-nums text-default">
        {{ formatCentsMXN(item.subtotalCents) }}
      </p>
    </div>
  </div>
</template>
