<script setup lang="ts">
import { computed } from 'vue'
import type { SaleItem } from '../interfaces/sale.types'
import { formatCentsMXN, sumLineCents } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  items: SaleItem[]
}>()

// ── Computed ──────────────────────────────────────────────────────────────────

const subtotalCount = computed(() => props.items.length)

const totalCents = computed(() => sumLineCents(props.items))

const totalFormatted = computed(() => formatCentsMXN(totalCents.value))
</script>

<template>
  <div class="sticky bottom-0 bg-default border-t-2 border-default px-4 py-4 shadow-lg">
    <USeparator class="mb-4" />
    
    <!-- Subtotal row -->
    <div class="flex items-center justify-between mb-4 px-1">
      <span class="text-sm font-medium text-toned">Subtotal</span>
      <span class="text-sm text-muted">({{ subtotalCount }} {{ subtotalCount === 1 ? 'producto' : 'productos' }})</span>
    </div>

    <!-- Total row -->
    <div class="flex items-center justify-between mb-5 px-1">
      <span class="text-base font-semibold text-highlighted">Total</span>
      <span class="text-2xl font-bold text-highlighted">{{ totalFormatted }}</span>
    </div>

    <!-- Cobrar button -->
    <div title="Disponible próximamente">
      <UButton color="primary" block size="xl" disabled>
        Cobrar
      </UButton>
    </div>
  </div>
</template>
