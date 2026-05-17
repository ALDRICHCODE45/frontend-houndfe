<script setup lang="ts">
import { formatCentsMXN } from '../utils/currency.utils'
import type { SaleDetailItem } from '../interfaces/sale.types'

defineProps<{
  items: SaleDetailItem[]
}>()

const PLACEHOLDER_IMAGE = 'https://placehold.co/64x64?text=placeholder'
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
        <img
          :data-testid="`item-image-${index}`"
          :src="item.imageUrl ?? PLACEHOLDER_IMAGE"
          :alt="item.productName"
          class="h-12 w-12 rounded-lg border border-default object-cover"
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
