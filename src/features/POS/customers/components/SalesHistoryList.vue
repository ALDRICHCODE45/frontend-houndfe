<script setup lang="ts">
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { StatusBadgeTone } from '@/core/shared/utils/badge.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { getPaymentStatusBadge, saleBadgeTone } from '@/features/POS/sales/utils/saleStatus.utils'

defineProps<{ sales: readonly ConfirmedSaleRow[] }>()

const emit = defineEmits<{ select: [sale: ConfirmedSaleRow] }>()

function dateLabel(iso: string | null): string {
  return iso ? formatShortDateTime(iso) : 'Fecha no disponible'
}

function statusBadge(sale: ConfirmedSaleRow): { label: string; tone: StatusBadgeTone } {
  if (sale.paymentStatus == null) {
    return { label: 'Sin estado', tone: 'neutral' }
  }
  const badge = getPaymentStatusBadge(sale.paymentStatus)
  return { label: badge.label, tone: saleBadgeTone(badge.color) }
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
  <ul class="divide-y divide-[var(--hf-border)]">
    <li v-for="sale in sales" :key="sale.id">
      <button
        type="button"
        :aria-label="accessibleName(sale)"
        class="grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors duration-100 hover:bg-[var(--hf-surface-muted)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--hf-focus)]"
        @click="emit('select', sale)"
      >
        <div
          class="col-start-1 row-span-2 row-start-1 flex size-10 items-center justify-center rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface-muted)]"
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
          class="col-start-3 row-start-1 shrink-0 justify-self-end hf-figure text-sm font-semibold text-highlighted"
        >
          {{ formatCentsMXN(sale.totalCents) }}
        </span>

        <span class="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span class="flex min-w-0 items-center gap-1">
            <UIcon name="i-lucide-clock-3" class="size-3 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ dateLabel(sale.confirmedAt) }}</span>
          </span>
          <StatusBadge :label="statusBadge(sale).label" :tone="statusBadge(sale).tone" />
          <span v-if="sale.debtCents > 0" class="hf-figure font-medium text-[var(--hf-warning)]">
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
