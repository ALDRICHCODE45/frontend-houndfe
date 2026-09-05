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
        class="w-full px-4 py-3 text-left transition-colors duration-100 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:hover:bg-gray-800/50"
        @click="emit('select', sale)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ sale.folio ?? 'Sin folio' }}</span>
          <span class="flex shrink-0 items-center gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ dateLabel(sale.confirmedAt) }}</span>
            <UIcon name="i-lucide-chevron-right" class="size-4 text-gray-400" aria-hidden="true" />
          </span>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <span class="text-sm tabular-nums text-gray-700 dark:text-gray-300">{{ formatCentsMXN(sale.totalCents) }}</span>
          <span v-if="sale.debtCents > 0" class="text-sm tabular-nums text-error">{{ formatCentsMXN(sale.debtCents) }}</span>
          <StatusDotBadge :label="statusBadge(sale).label" :tone="statusBadge(sale).tone" compact />
        </div>
      </button>
    </li>
  </ul>
</template>
