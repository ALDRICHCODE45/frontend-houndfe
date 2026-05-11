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
    <h3 class="mb-4 text-sm font-semibold">Productos</h3>

    <div class="space-y-3">
      <div
        v-for="(item, index) in items"
        :key="`${item.productName}-${index}`"
        class="grid grid-cols-[64px_1fr_100px_80px_120px] items-center gap-3"
      >
        <img
          :data-testid="`item-image-${index}`"
          :src="item.imageUrl ?? PLACEHOLDER_IMAGE"
          :alt="item.productName"
          class="h-16 w-16 rounded object-cover"
        />
        <p>{{ item.productName }}</p>
        <p class="text-right">{{ formatCentsMXN(item.unitPriceCents) }}</p>
        <p class="text-right">{{ item.quantity }}</p>
        <p class="text-right font-medium">{{ formatCentsMXN(item.subtotalCents) }}</p>
      </div>
    </div>
  </UCard>
</template>
