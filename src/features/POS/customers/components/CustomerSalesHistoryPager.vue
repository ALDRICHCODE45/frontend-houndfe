<script setup lang="ts">
/**
 * Range, filter totals and pages of the customer's sales history (customers-module T4). The
 * slideover pins it in its footer (`drawer`); the «Ventas» tab of the customer page puts it under
 * the list (`page`).
 */
import { computed } from 'vue'
import {
  CUSTOMER_HISTORY_PAGE_SIZE,
  type CustomerSalesHistoryView,
} from '../composables/useCustomerSalesHistoryView'

const props = withDefaults(
  defineProps<{ history: CustomerSalesHistoryView; variant?: 'drawer' | 'page' }>(),
  { variant: 'drawer' },
)

// The controller is created once by the parent and never replaced: its refs are read as bindings.
const { page, response, isFetching, rangeLabel, filterSummaryLabel } = props.history

const layoutClass = computed(() =>
  props.variant === 'drawer'
    ? 'min-h-14 px-4 py-3 lg:min-h-0 lg:flex-nowrap lg:gap-4 lg:p-0'
    : 'pt-1',
)
</script>

<template>
  <div
    v-if="response && response.pagination.total > 0"
    class="flex min-w-0 flex-wrap items-center justify-between gap-3"
    :class="layoutClass"
    data-testid="history-pagination"
    :data-disabled="String(isFetching)"
  >
    <div class="grid min-w-0 gap-0.5">
      <span class="text-sm text-[var(--hf-muted)]">
        <b class="hf-figure font-semibold text-[var(--hf-ink)]">{{ rangeLabel }}</b>
        <span class="hidden sm:inline"> · más recientes primero</span>
      </span>
      <span
        v-if="filterSummaryLabel"
        data-testid="history-filter-summary"
        class="hf-figure text-xs text-[var(--hf-muted)]"
      >{{ filterSummaryLabel }}</span>
    </div>
    <div v-if="response.pagination.totalPages > 1" data-testid="history-pagination-controls">
      <UPagination
        v-model:page="page"
        :items-per-page="CUSTOMER_HISTORY_PAGE_SIZE"
        :total="response.pagination.total"
        :disabled="isFetching"
        show-edges
        :sibling-count="0"
        size="sm"
      />
    </div>
  </div>
</template>
