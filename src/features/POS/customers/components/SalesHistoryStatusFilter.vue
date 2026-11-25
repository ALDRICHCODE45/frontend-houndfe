<script setup lang="ts">
/**
 * Sales history redesign T1 (L3): «Con saldo» (`paymentStatus=PARTIAL,CREDIT`) and «Sin entregar»
 * (`deliveryStatus=PENDING`) filter the list only; the counts are the customer-wide `counts`.
 * «Vencidas» (`overdue=true`, handoff 28 §2.3) appears only when `counts.overdue` arrives.
 */
import { computed } from 'vue'
import type { SalesListCounts } from '@/features/POS/sales/interfaces/sale.types'
import type { CustomerHistoryStatusFilter } from '@/features/POS/sales/composables/useCustomerSalesHistory'

const props = defineProps<{ counts?: SalesListCounts }>()
const selected = defineModel<CustomerHistoryStatusFilter>({ required: true })

type Option = { value: CustomerHistoryStatusFilter; label: string; count: number }

const options = computed<Option[]>(() => {
  const list: Option[] = [
    { value: 'all', label: 'Todas', count: 0 },
    { value: 'with-debt', label: 'Con saldo', count: props.counts?.pendingPayments ?? 0 },
    { value: 'not-delivered', label: 'Sin entregar', count: props.counts?.notDelivered ?? 0 },
  ]
  const overdue = props.counts?.overdue
  if (typeof overdue === 'number') list.push({ value: 'overdue', label: 'Vencidas', count: overdue })
  return list
})
</script>

<template>
  <div
    role="group"
    aria-label="Filtrar por estado"
    data-testid="history-status-filter"
    class="flex min-w-0 flex-wrap gap-2"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium md:min-h-9 border-[var(--hf-muted)] bg-[var(--hf-surface)] text-[var(--hf-ink)] hover:bg-[var(--hf-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)] aria-pressed:border-[var(--hf-active)] aria-pressed:bg-[var(--hf-active-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--hf-active)]"
      :aria-pressed="selected === option.value"
      @click="selected = option.value"
    >
      <UIcon
        v-if="selected === option.value"
        name="i-lucide-check"
        class="size-3.5 shrink-0"
        aria-hidden="true"
      />
      <span class="truncate">{{ option.label }}</span
      >{{ option.count > 0 ? ' ' : ''
      }}<small v-if="option.count > 0" class="hf-figure text-xs font-normal">{{
        option.count
      }}</small>
    </button>
  </div>
</template>
