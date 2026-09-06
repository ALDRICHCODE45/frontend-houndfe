<script setup lang="ts">
/**
 * CustomerCardGrid — available-width grid of CustomerCard components.
 *
 * Uses the S3 pilot available-width convention (auto-fit/minmax tracks):
 * 8 skeleton placeholders while loading, an empty-state block when there
 * are no customers. Pure presentational: receives `customers` as a prop
 * and forwards card events back to the parent.
 */

import CustomerCard from './CustomerCard.vue'
import type { Customer } from '../interfaces/customer.types'

defineProps<{
  customers: Customer[]
  loading?: boolean
  empty?: string
  canUpdate?: boolean
  canDelete?: boolean
  canReadSales?: boolean
}>()

const emit = defineEmits<{
  'card-click': [customer: Customer]
  edit: [customer: Customer]
  delete: [customer: Customer]
    'view-history': [customer: Customer]
}>()

// S3 pilot available-width grid convention (design §4): the nested list
// width, not the viewport, decides the column count. Duplicated by design
// across the three pilot grids — no shared wrapper.
const gridClasses =
  'grid w-full min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3'
</script>

<template>
  <!-- Loading skeleton -->
  <div
    v-if="loading"
    data-testid="card-grid-skeleton"
    :class="gridClasses"
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
    v-else-if="!customers.length"
    data-testid="card-grid-empty"
    class="flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-users" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ empty ?? 'No se encontraron clientes' }}</p>
  </div>

  <!-- Card grid -->
  <div
    v-else
    data-testid="card-grid"
    :class="gridClasses"
  >
    <CustomerCard
      v-for="customer in customers"
      :key="customer.id"
      :customer="customer"
      :can-update="canUpdate"
      :can-delete="canDelete"
      :can-read-sales="canReadSales"
      @click="emit('card-click', $event)"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
      @view-history="emit('view-history', $event)"
    />
  </div>
</template>
