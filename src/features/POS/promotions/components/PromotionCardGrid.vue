<script setup lang="ts">
/**
 * PromotionCardGrid — responsive grid of PromotionCard components.
 *
 * Mirrors EmployeeCardGrid: ladder layout (1/2/3/5/7), 8 skeleton
 * placeholders while loading, an empty-state block when there are no
 * promotions. Pure presentational: receives `promotions` as a prop and
 * forwards card events back to the parent.
 */

import PromotionCard from './PromotionCard.vue'
import type { PromotionResponse } from '../interfaces/promotion.types'

defineProps<{
  promotions: PromotionResponse[]
  loading?: boolean
  empty?: string
}>()

const emit = defineEmits<{
  'card-click': [promotion: PromotionResponse]
}>()
</script>

<template>
  <!-- Loading skeleton -->
  <div
    v-if="loading"
    data-testid="card-grid-skeleton"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <div
      v-for="i in 8"
      :key="i"
      data-testid="card-skeleton"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="!promotions.length"
    data-testid="card-grid-empty"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-percent" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ empty ?? 'No se encontraron promociones' }}</p>
  </div>

  <!-- Card grid -->
  <div
    v-else
    data-testid="card-grid"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <PromotionCard
      v-for="promotion in promotions"
      :key="promotion.id"
      :promotion="promotion"
      @click="emit('card-click', $event)"
    />
  </div>
</template>