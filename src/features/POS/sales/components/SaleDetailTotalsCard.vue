<script setup lang="ts">
import { computed } from 'vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
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
  <!-- T6c: a key/value list (muted label left, tabular figure right) inside the
       shared section card; hairlines separate the subtotal, total and payment groups. -->
  <HfSectionCard title="Totales">
    <dl class="grid gap-2 text-sm">
      <div class="flex items-center justify-between gap-4">
        <dt class="text-(--hf-muted)">Subtotal</dt>
        <dd class="hf-figure text-(--hf-ink)" data-testid="totals-subtotal-value">
          {{ formatCentsMXN(subtotalCents) }}
        </dd>
      </div>
      <div
        v-if="discountCents > 0"
        data-testid="totals-discount-row"
        class="flex items-center justify-between gap-4"
      >
        <dt class="text-(--hf-muted)">Descuentos</dt>
        <dd class="hf-figure text-(--hf-ink)" data-testid="totals-discount-value">{{ discountLabel }}</dd>
      </div>

      <div class="flex items-center justify-between gap-4 border-y border-(--hf-border) py-3">
        <dt class="font-semibold text-(--hf-heading)">Total</dt>
        <dd class="hf-figure text-2xl font-semibold text-(--hf-heading)" data-testid="totals-total-value">
          {{ formatCentsMXN(totalCents) }}
        </dd>
      </div>

      <div class="flex items-center justify-between gap-4" data-testid="totals-paid-row">
        <dt class="text-(--hf-muted)">Pagado</dt>
        <dd class="hf-figure text-(--hf-ink)">{{ formatCentsMXN(paidCents) }}</dd>
      </div>
      <div class="flex items-center justify-between gap-4" data-testid="totals-debt-row">
        <dt class="text-(--hf-muted)">Deuda</dt>
        <dd class="hf-figure">
          <span :class="debtClass" class="font-semibold">
            {{ formatCentsMXN(debtCents) }}
          </span>
        </dd>
      </div>
      <div
        v-if="showChangeRow"
        class="flex items-center justify-between gap-4"
        data-testid="totals-change-row"
      >
        <dt class="text-(--hf-muted)">Cambio</dt>
        <dd class="hf-figure text-(--hf-ink)">{{ formatCentsMXN(changeDueCents) }}</dd>
      </div>
    </dl>
  </HfSectionCard>
</template>
