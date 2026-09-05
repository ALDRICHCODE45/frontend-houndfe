<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import type { SaleListSummary } from '@/features/POS/sales/interfaces/sale.types'

const props = defineProps<{ summary: SaleListSummary }>()

const hasDebt = computed(() => props.summary.outstandingDebtCents > 0)
const showAlCorriente = computed(() => !hasDebt.value && props.summary.salesCount > 0)
const formattedTotal = computed(() => formatCentsMXN(props.summary.totalSoldCents))
const formattedDebt = computed(() => formatCentsMXN(props.summary.outstandingDebtCents))
</script>

<template>
  <dl class="grid grid-cols-1 gap-y-3 sm:grid-cols-3 sm:divide-x divide-gray-200 dark:divide-gray-700">
    <div class="px-4 py-3">
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Ventas confirmadas
      </dt>
      <dd class="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
        {{ summary.salesCount }}
      </dd>
    </div>
    <div class="px-4 py-3">
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Total vendido
      </dt>
      <dd class="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
        {{ formattedTotal }}
      </dd>
    </div>
    <div class="px-4 py-3">
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Saldo pendiente
      </dt>
      <dd v-if="hasDebt" aria-live="polite" class="mt-1 flex items-center gap-2">
        <span class="text-2xl font-semibold tabular-nums text-error">{{ formattedDebt }}</span>
        <AppBadge tone="error" label="Con saldo pendiente" />
        <UIcon name="i-lucide-alert-triangle" class="size-4 text-error" aria-hidden="true" />
      </dd>
      <dd v-else class="mt-1 flex items-center gap-2">
        <span class="text-2xl font-semibold tabular-nums text-gray-400 dark:text-gray-500">{{ formattedDebt }}</span>
        <AppBadge v-if="showAlCorriente" tone="success" label="Al corriente" />
      </dd>
    </div>
  </dl>
</template>
