<script setup lang="ts">
/**
 * QuotationCardGrid — REQ-17 / REQ-19 (multi-column card mode for quotations).
 *
 * EmployeeCardGrid-style ladder for `QuotationResponseDto`s.
 * - Loading skeleton (8 cards with `border-default` + `bg-elevated`)
 * - Empty state with `i-lucide-file-text`
 * - Forwards each QuotationCard's `click` as `card-click`, plus its
 *   `delete` and `navigate` events untouched.
 */

import QuotationCard from './QuotationCard.vue'
import type { QuotationResponseDto } from '../interfaces/quotation.types'

defineProps<{
  quotations: QuotationResponseDto[]
  loading?: boolean
  empty?: string
  canDelete?: boolean
}>()

const emit = defineEmits<{
  'card-click': [quotation: QuotationResponseDto]
  delete: [quotation: QuotationResponseDto]
  navigate: []
}>()
</script>

<template>
  <div
    v-if="loading && !quotations.length"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
    data-testid="quotation-cards-skeleton"
  >
    <div
      v-for="i in 8"
      :key="i"
      class="h-56 animate-pulse rounded-xl border border-default bg-elevated"
    />
  </div>

  <div
    v-else-if="!quotations.length"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
    data-testid="quotation-cards-empty"
  >
    <UIcon name="i-lucide-file-text" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ empty ?? 'No hay cotizaciones' }}</p>
  </div>

  <div
    v-else
    data-testid="quotation-cards-grid"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <QuotationCard
      v-for="quotation in quotations"
      :key="quotation.id"
      :quotation="quotation"
      :can-delete="canDelete"
      @click="emit('card-click', $event)"
      @delete="emit('delete', $event)"
      @navigate="emit('navigate')"
    />
  </div>
</template>
