<script setup lang="ts">
/**
 * CustomerCardGrid — responsive grid of CustomerCard components.
 *
 * Mirrors EmployeeCardGrid: ladder layout (1/2/3/5/7), 8 skeleton
 * placeholders while loading, an empty-state block when there are no
 * customers. Pure presentational: receives `customers` as a prop and
 * forwards card events back to the parent.
 */

import CustomerCard from './CustomerCard.vue'
import type { Customer } from '../interfaces/customer.types'

defineProps<{
  customers: Customer[]
  loading?: boolean
  empty?: string
  canUpdate?: boolean
  canDelete?: boolean
}>()

const emit = defineEmits<{
  'card-click': [customer: Customer]
  edit: [customer: Customer]
  delete: [customer: Customer]
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
    v-else-if="!customers.length"
    data-testid="card-grid-empty"
    class="flex flex-col items-center justify-center gap-3 py-16 text-center"
  >
    <UIcon name="i-lucide-users" class="size-12 text-muted opacity-50" />
    <p class="text-sm text-muted">{{ empty ?? 'No se encontraron clientes' }}</p>
  </div>

  <!-- Card grid -->
  <div
    v-else
    data-testid="card-grid"
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7"
  >
    <CustomerCard
      v-for="customer in customers"
      :key="customer.id"
      :customer="customer"
      :can-update="canUpdate"
      :can-delete="canDelete"
      @click="emit('card-click', $event)"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
    />
  </div>
</template>
