<script setup lang="ts">
/**
 * CustomerCollectionSaleList — the sales of one «Cobrar todo» in allocation order (handoff 30 §4).
 *
 * One bordered surface holding a `.hf-plain-table` (Venta, Vence, Debe, Abono, Queda) with
 * hairline rows — no card per sale (S6). The due day is the first 10 characters of `dueDate`, or
 * «Sin vencimiento»; overdue sales keep the «Vencida» status before the collection. On a narrow
 * sheet (390px) the same rows stack inside the surface, divided by hairlines, without sideways
 * scroll (`customer-collection.css`). The API sends the balance AFTER the collection, so «Debe»
 * is `debtCents + appliedCents`.
 */
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatCollectionDueDay } from '../collection/collectionFormat'
import type { CollectionSaleAllocation } from '../collection/collection.types'
import '../styles/customer-collection.css'

defineProps<{ sales: readonly CollectionSaleAllocation[]; caption: string }>()

function dueLabel(sale: CollectionSaleAllocation): string {
  return formatCollectionDueDay(sale.dueDate) ?? 'Sin vencimiento'
}
</script>

<template>
  <div class="customer-collection-sales">
    <table class="hf-plain-table customer-collection-table">
      <caption class="sr-only">{{ caption }}</caption>
      <colgroup>
        <col>
        <col class="customer-collection-col-due">
        <col class="customer-collection-col-amount">
        <col class="customer-collection-col-amount">
        <col class="customer-collection-col-amount">
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Venta</th>
          <th scope="col">Vence</th>
          <th scope="col" class="customer-collection-figure">Debe</th>
          <th scope="col" class="customer-collection-figure">Abono</th>
          <th scope="col" class="customer-collection-figure">Queda</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="sale in sales"
          :key="sale.saleId"
          data-testid="collection-sale-row"
          :data-folio="sale.folio"
        >
          <td>
            <div class="customer-collection-sale">
              <span class="hf-figure customer-collection-sale-folio">{{ sale.folio }}</span>
              <StatusBadge v-if="sale.overdue" label="Vencida" tone="warning" />
            </div>
          </td>
          <td data-testid="collection-sale-due" class="customer-collection-due">
            <span class="customer-collection-cell-label" aria-hidden="true">Vence</span>
            {{ dueLabel(sale) }}
          </td>
          <td
            data-testid="collection-sale-debt"
            class="hf-figure customer-collection-figure text-[var(--hf-ink)]"
          >
            <span class="customer-collection-cell-label" aria-hidden="true">Debe</span>
            {{ formatCentsMXN(sale.debtCents + sale.appliedCents) }}
          </td>
          <td
            data-testid="collection-sale-applied"
            class="hf-figure customer-collection-figure font-semibold"
            :class="sale.appliedCents > 0 ? 'text-[var(--hf-success)]' : 'text-[var(--hf-muted)]'"
          >
            <span class="customer-collection-cell-label" aria-hidden="true">Abono</span>
            {{ formatCentsMXN(sale.appliedCents) }}
          </td>
          <td
            data-testid="collection-sale-remaining"
            class="hf-figure customer-collection-figure text-[var(--hf-ink)]"
          >
            <span class="customer-collection-cell-label" aria-hidden="true">Queda</span>
            {{ formatCentsMXN(sale.debtCents) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
