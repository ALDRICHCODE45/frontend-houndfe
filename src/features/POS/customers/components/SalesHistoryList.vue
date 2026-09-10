<script setup lang="ts">
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatSaleDate } from '@/features/POS/sales/utils/saleDate.utils'
import { getPaymentStatusBadge } from '@/features/POS/sales/utils/saleStatus.utils'

defineProps<{ sales: readonly ConfirmedSaleRow[] }>()

const emit = defineEmits<{ select: [sale: ConfirmedSaleRow] }>()

function dateLabel(iso: string | null): string {
  return iso ? formatSaleDate(iso) : 'Fecha no disponible'
}

function statusBadge(sale: ConfirmedSaleRow): { label: string; tone: 'neutral' | 'success' | 'warning' | 'error' } {
  if (sale.paymentStatus == null) {
    return { label: 'Sin estado', tone: 'neutral' }
  }
  const badge = getPaymentStatusBadge(sale.paymentStatus)
  return { label: badge.label, tone: badge.color }
}

function accessibleName(sale: ConfirmedSaleRow): string {
  const folio = sale.folio ?? 'sin folio'
  const date = dateLabel(sale.confirmedAt).toLowerCase()
  const total = formatCentsMXN(sale.totalCents)
  const debt = formatCentsMXN(sale.debtCents)
  return `Venta folio ${folio} del ${date} por ${total} con saldo de ${debt}`
}
</script>

<template>
  <ul class="divide-y divide-gray-100 dark:divide-gray-800">
    <li v-for="sale in sales" :key="sale.id">
      <button
        type="button"
        :aria-label="accessibleName(sale)"
        class="grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors duration-100 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:hover:bg-gray-800/50"
        @click="emit('select', sale)"
      >
        <div
          class="col-start-1 row-span-2 row-start-1 flex size-10 items-center justify-center rounded-xl border border-default bg-elevated/70"
          data-testid="sale-history-row-icon"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-receipt-text" class="size-5 text-muted" />
        </div>

        <span class="col-start-2 row-start-1 min-w-0 truncate text-sm font-semibold text-highlighted">
          {{ sale.folio ?? 'Sin folio' }}
        </span>

        <span
          data-testid="sale-history-row-total"
          class="col-start-3 row-start-1 shrink-0 justify-self-end text-sm font-semibold tabular-nums text-highlighted"
        >
          {{ formatCentsMXN(sale.totalCents) }}
        </span>

        <span class="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span class="flex min-w-0 items-center gap-1">
            <UIcon name="i-lucide-clock-3" class="size-3 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ dateLabel(sale.confirmedAt) }}</span>
          </span>
          <StatusDotBadge
            :label="statusBadge(sale).label"
            :tone="statusBadge(sale).tone"
            compact
          />
          <span v-if="sale.debtCents > 0" class="font-medium tabular-nums text-error">
            {{ formatCentsMXN(sale.debtCents) }} pendiente
          </span>
        </span>

        <UIcon
          name="i-lucide-chevron-right"
          class="col-start-3 row-start-2 size-4 justify-self-end text-dimmed"
          aria-hidden="true"
        />
      </button>
    </li>
  </ul>
</template>
