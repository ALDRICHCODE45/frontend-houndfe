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
  <dl class="grid min-w-0 grid-cols-2 gap-2 p-3 lg:p-4">
    <div class="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 rounded-xl border border-default bg-elevated/50 p-3 lg:grid-cols-[2.25rem_minmax(0,1fr)] lg:gap-x-3">
      <div class="col-start-1 row-start-1 flex size-8 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30 lg:row-span-2 lg:size-9">
        <UIcon name="i-lucide-shopping-cart" class="size-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
      </div>
      <dt class="col-start-2 row-start-1 text-[11px] font-medium uppercase leading-tight tracking-wide text-muted lg:text-xs">Ventas confirmadas</dt>
      <dd class="col-span-2 mt-2 min-w-0 whitespace-nowrap text-lg font-semibold leading-tight tabular-nums text-highlighted lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:mt-0 lg:text-xl">
        {{ summary.salesCount }}
      </dd>
    </div>

    <div class="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 rounded-xl border border-default bg-elevated/50 p-3 lg:grid-cols-[2.25rem_minmax(0,1fr)] lg:gap-x-3">
      <div class="col-start-1 row-start-1 flex size-8 items-center justify-center rounded-lg bg-success-50 dark:bg-success-900/30 lg:row-span-2 lg:size-9">
        <UIcon name="i-lucide-wallet-cards" class="size-5 text-success-600 dark:text-success-400" aria-hidden="true" />
      </div>
      <dt class="col-start-2 row-start-1 text-[11px] font-medium uppercase leading-tight tracking-wide text-muted lg:text-xs">Total vendido</dt>
      <dd class="col-span-2 mt-2 min-w-0 whitespace-nowrap text-lg font-semibold leading-tight tabular-nums text-highlighted lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:mt-0 lg:text-xl">
        {{ formattedTotal }}
      </dd>
    </div>

    <div
      class="col-span-2 grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 rounded-xl border border-default bg-elevated/50 p-3 lg:grid-cols-[2.25rem_minmax(0,1fr)] lg:gap-x-3"
      :class="hasDebt ? 'border-error/30 bg-error-50/30 dark:bg-error-900/10' : ''"
    >
      <div class="col-start-1 row-start-1 flex size-8 items-center justify-center rounded-lg bg-warning-50 dark:bg-warning-900/30 lg:row-span-2 lg:size-9">
        <UIcon
          :name="hasDebt ? 'i-lucide-alert-circle' : 'i-lucide-circle-check'"
          class="size-5"
          :class="hasDebt ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-400'"
          aria-hidden="true"
        />
      </div>
      <dt class="col-start-2 row-start-1 text-[11px] font-medium uppercase leading-tight tracking-wide text-muted lg:text-xs">Saldo pendiente</dt>
      <dd
        v-if="hasDebt"
        aria-live="polite"
        class="col-span-2 mt-2 flex min-w-0 flex-wrap items-center gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:mt-0"
      >
        <span class="whitespace-nowrap text-lg font-semibold leading-tight tabular-nums text-error lg:text-xl">{{ formattedDebt }}</span>
        <AppBadge tone="error" label="Con saldo pendiente" />
      </dd>
      <dd
        v-else
        class="col-span-2 mt-2 flex min-w-0 flex-wrap items-center gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:mt-0"
      >
        <span class="whitespace-nowrap text-lg font-semibold leading-tight tabular-nums text-muted lg:text-xl">{{ formattedDebt }}</span>
        <AppBadge v-if="showAlCorriente" tone="success" label="Al corriente" />
      </dd>
    </div>
  </dl>
</template>
