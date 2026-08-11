<script setup lang="ts">
/**
 * SaleCardGrid — REQ-12 / REQ-14 (multi-column card mode for sales).
 *
 * EmployeeCardGrid-style ladder for `ConfirmedSaleRow`s.
 * - Loading skeleton (8 cards with `border-default` + `bg-elevated`)
 * - Empty state with `i-lucide-receipt`
 * - Forwards each SaleCard's `click` as `card-click`
 */

import SaleCard from './SaleCard.vue'
import type { ConfirmedSaleRow } from '../interfaces/sale.types'

defineProps<{
  sales: ConfirmedSaleRow[]
  loading?: boolean
  empty?: string
}>()

const emit = defineEmits<{
  'card-click': [sale: ConfirmedSaleRow]
}>()
</script>

<template>
  <div
    v-if="loading && !sales.length"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
    data-testid="sale-cards-skeleton"
  >
    <div
      v-for="i in 8"
      :key="i"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <div
    v-else-if="!sales.length"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
    data-testid="sale-cards-empty"
  >
    <UIcon name="i-lucide-receipt" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ empty ?? 'No hay ventas todavía' }}</p>
  </div>

  <div
    v-else
    data-testid="sale-cards-grid"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <SaleCard
      v-for="sale in sales"
      :key="sale.id"
      :sale="sale"
      @click="emit('card-click', $event)"
    />
  </div>
</template>
