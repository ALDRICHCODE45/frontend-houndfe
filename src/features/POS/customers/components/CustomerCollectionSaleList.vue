<script setup lang="ts">
/**
 * CustomerCollectionSaleList — the sales of one «Cobrar todo» in allocation order (handoff 30 §4).
 *
 * Each sale reads as a stacked card (no sideways scroll at 390): folio, due day (first 10
 * characters of `dueDate`) or «Sin vencimiento», a «Vencida» status before the collection, and
 * what it owed, what it receives now and what stays owed. The API sends the balance AFTER the
 * collection, so «Debe» is `debtCents + appliedCents`.
 */
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatCollectionDueDay } from '../collection/collectionFormat'
import type { CollectionSaleAllocation } from '../collection/collection.types'

defineProps<{ sales: readonly CollectionSaleAllocation[]; caption: string }>()

function dueLabel(sale: CollectionSaleAllocation): string {
  const day = formatCollectionDueDay(sale.dueDate)
  return day ? `Vence ${day}` : 'Sin vencimiento'
}
</script>

<template>
  <ol class="grid min-w-0 gap-2" :aria-label="caption">
    <li
      v-for="sale in sales"
      :key="sale.saleId"
      data-testid="collection-sale-row"
      :data-folio="sale.folio"
      class="grid min-w-0 gap-2 rounded-xl border border-[var(--hf-border)] px-3 py-2.5"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span class="hf-figure font-semibold text-[var(--hf-heading)]">{{ sale.folio }}</span>
        <StatusBadge v-if="sale.overdue" label="Vencida" tone="warning" />
        <span
          data-testid="collection-sale-due"
          class="hf-figure ml-auto text-[13px] text-[var(--hf-muted)]"
        >
          {{ dueLabel(sale) }}
        </span>
      </div>
      <dl class="grid grid-cols-3 gap-2 text-[13px]">
        <div class="grid min-w-0 gap-0.5">
          <dt class="text-[var(--hf-muted)]">Debe</dt>
          <dd data-testid="collection-sale-debt" class="hf-figure text-[var(--hf-ink)]">
            {{ formatCentsMXN(sale.debtCents + sale.appliedCents) }}
          </dd>
        </div>
        <div class="grid min-w-0 gap-0.5">
          <dt class="text-[var(--hf-muted)]">Abono</dt>
          <dd
            data-testid="collection-sale-applied"
            class="hf-figure font-semibold"
            :class="sale.appliedCents > 0 ? 'text-[var(--hf-success)]' : 'text-[var(--hf-muted)]'"
          >
            {{ formatCentsMXN(sale.appliedCents) }}
          </dd>
        </div>
        <div class="grid min-w-0 gap-0.5">
          <dt class="text-[var(--hf-muted)]">Queda</dt>
          <dd data-testid="collection-sale-remaining" class="hf-figure text-[var(--hf-ink)]">
            {{ formatCentsMXN(sale.debtCents) }}
          </dd>
        </div>
      </dl>
    </li>
  </ol>
</template>
