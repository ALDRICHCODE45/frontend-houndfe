<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'

const props = defineProps<{
  subtotalCents: number
  discountCents: number
  totalCents: number
  paidCents: number
  debtCents: number
  changeDueCents: number
}>()

// Discount is a positive number coming from the backend (e.g. 14000 ==
// $140.00). We render it with a leading minus so it reads as a deduction,
// matching the POS draft footer convention ("Descuentos -$140.00").
const discountLabel = computed(() => `-${formatCentsMXN(props.discountCents)}`)

// An outstanding balance is pending, not wrong: warning ink. A settled one
// reads as success.
const debtClass = computed(() =>
  props.debtCents > 0 ? 'text-(--hf-warning)' : 'text-(--hf-success)',
)

const showChangeRow = computed(() => props.changeDueCents > 0)
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="sale-detail-section-title">
        <UIcon name="i-lucide-receipt" class="size-4" />
        Totales
      </h3>
    </template>

    <div class="space-y-2 text-right">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Subtotal</span>
        <span data-testid="totals-subtotal-value">{{ formatCentsMXN(subtotalCents) }}</span>
      </div>
      <div
        v-if="discountCents > 0"
        data-testid="totals-discount-row"
        class="flex items-center justify-between text-sm"
      >
        <span class="text-muted">Descuentos</span>
        <span data-testid="totals-discount-value">{{ discountLabel }}</span>
      </div>

      <USeparator />

      <div class="flex items-center justify-between">
        <span class="text-muted">Total</span>
        <span class="hf-figure text-2xl font-semibold text-(--hf-heading)" data-testid="totals-total-value">
          {{ formatCentsMXN(totalCents) }}
        </span>
      </div>

      <USeparator />

      <div class="flex items-center justify-between text-sm" data-testid="totals-paid-row">
        <span class="text-muted">Pagado</span>
        <span>{{ formatCentsMXN(paidCents) }}</span>
      </div>
      <div class="flex items-center justify-between text-sm" data-testid="totals-debt-row">
        <span class="text-muted">Deuda</span>
        <span :class="debtClass" class="font-semibold">
          {{ formatCentsMXN(debtCents) }}
        </span>
      </div>
      <div
        v-if="showChangeRow"
        class="flex items-center justify-between text-sm"
        data-testid="totals-change-row"
      >
        <span class="text-muted">Cambio</span>
        <span>{{ formatCentsMXN(changeDueCents) }}</span>
      </div>
    </div>
  </UCard>
</template>