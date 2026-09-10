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
  <dl class="grid grid-cols-2 gap-2 p-4">
    <div class="flex items-center gap-3 rounded-xl border border-default bg-elevated/50 p-3">
      <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">
        <UIcon name="i-lucide-shopping-cart" class="size-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <dt class="text-xs font-medium uppercase tracking-wide text-muted">Ventas confirmadas</dt>
        <dd class="text-xl font-semibold tabular-nums text-highlighted">{{ summary.salesCount }}</dd>
      </div>
    </div>
    <div class="flex items-center gap-3 rounded-xl border border-default bg-elevated/50 p-3">
      <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-50 dark:bg-success-900/30">
        <UIcon name="i-lucide-wallet-cards" class="size-5 text-success-600 dark:text-success-400" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <dt class="text-xs font-medium uppercase tracking-wide text-muted">Total vendido</dt>
        <dd class="text-xl font-semibold tabular-nums text-highlighted">{{ formattedTotal }}</dd>
      </div>
    </div>
    <div class="col-span-2 flex flex-wrap items-center gap-3 rounded-xl border border-default bg-elevated/50 p-3"
      :class="hasDebt ? 'border-error/30 bg-error-50/30 dark:bg-error-900/10' : ''">
      <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-50 dark:bg-warning-900/30">
        <UIcon
          :name="hasDebt ? 'i-lucide-alert-circle' : 'i-lucide-circle-check'"
          class="size-5"
          :class="hasDebt ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-400'"
          aria-hidden="true"
        />
      </div>
      <div class="min-w-0 flex-1">
        <dt class="text-xs font-medium uppercase tracking-wide text-muted">Saldo pendiente</dt>
        <dd v-if="hasDebt" aria-live="polite" class="flex flex-wrap items-center gap-2">
          <span class="text-xl font-semibold tabular-nums text-error">{{ formattedDebt }}</span>
          <AppBadge tone="error" label="Con saldo pendiente" />
        </dd>
        <dd v-else class="flex flex-wrap items-center gap-2">
          <span class="text-xl font-semibold tabular-nums text-muted">{{ formattedDebt }}</span>
          <AppBadge v-if="showAlCorriente" tone="success" label="Al corriente" />
        </dd>
      </div>
    </div>
  </dl>
</template>
