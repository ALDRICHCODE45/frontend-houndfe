<script setup lang="ts">
import { formatCentsMXN } from '../utils/currency.utils'
import type { SaleDetailItem } from '../interfaces/sale.types'

defineProps<{
  items: SaleDetailItem[]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">Productos</h3>
    </template>

    <div class="divide-y divide-default">
      <div
        v-for="(item, index) in items"
        :key="`${item.productName}-${index}`"
        class="flex items-center gap-4 py-3 hover:bg-elevated first:pt-0 last:pb-0"
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
          <p class="font-medium text-base">{{ item.productName }}</p>
          <p v-if="item.variantName" class="text-sm text-muted">
            {{ item.variantName }} • {{ formatCentsMXN(item.unitPriceCents) }}
          </p>
          <p v-else class="text-sm text-muted">
            {{ formatCentsMXN(item.unitPriceCents) }}
          </p>
        </div>
        
        <span class="text-sm font-medium text-muted ml-auto">× {{ item.quantity }}</span>
        
        <p class="font-semibold text-base text-right min-w-[80px]">
          {{ formatCentsMXN(item.subtotalCents) }}
        </p>
      </div>
    </div>
  </UCard>
</template>
