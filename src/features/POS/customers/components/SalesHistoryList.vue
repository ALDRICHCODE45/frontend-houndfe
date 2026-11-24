<script setup lang="ts">
/**
 * Sales history redesign T1 (S2, S3): the customer's sales as an aligned table (Venta, Pago,
 * Total, Saldo) or, at phone width, as cards. A row opens in place into the shared
 * `SaleHistoryRowDetail` (one GET /sales/:id per opened row). Labels are this screen's current
 * payment-status labels (S5).
 */
import { shallowRef, useId } from 'vue'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatSaleDueDate } from '@/features/POS/sales/utils/saleDate.utils'
import { saleCancelReasonLabel } from '@/features/POS/sales/utils/saleCancellation.utils'
import {
  isCanceledSale,
  saleDeliveryBadge,
  saleOpenDebtCents,
  salePaymentBadge,
} from '@/features/POS/sales/utils/saleStatus.utils'
import SaleHistoryRowDetail, {
  type SaleHistoryChargeRequest,
} from '@/features/POS/sales/components/history/SaleHistoryRowDetail.vue'

withDefaults(
  defineProps<{
    sales: readonly ConfirmedSaleRow[]
    layout?: 'table' | 'cards'
    allowCharge?: boolean
    caption?: string
  }>(),
  { layout: 'table', allowCharge: false, caption: 'Ventas del cliente, más recientes primero' },
)
const emit = defineEmits<{ charge: [request: SaleHistoryChargeRequest] }>()

// Same channel words as the Ventas list.
const CHANNEL_LABELS = { POS: 'Punto de venta', ONLINE: 'En línea' } as const

const idPrefix = useId()
const openIds = shallowRef<ReadonlySet<string>>(new Set())

function isOpen(sale: ConfirmedSaleRow): boolean {
  return openIds.value.has(sale.id)
}

function toggle(sale: ConfirmedSaleRow) {
  const next = new Set(openIds.value)
  if (!next.delete(sale.id)) next.add(sale.id)
  openIds.value = next
}

function detailId(sale: ConfirmedSaleRow): string {
  return `${idPrefix}-detail-${sale.id}`
}

function folio(sale: ConfirmedSaleRow): string {
  return sale.folio ?? 'Sin folio'
}

function dateLabel(sale: ConfirmedSaleRow): string {
  return sale.confirmedAt ? formatShortDateTime(sale.confirmedAt) : 'Fecha no disponible'
}

function channelLabel(sale: ConfirmedSaleRow): string | null {
  if (sale.channel) return CHANNEL_LABELS[sale.channel]
  return sale.hold ? CHANNEL_LABELS.ONLINE : null
}

function whenLabel(sale: ConfirmedSaleRow): string {
  return [dateLabel(sale), channelLabel(sale)].filter(Boolean).join(' · ')
}

/** Second line of the Pago cell: the delivery state, or why a canceled sale was canceled. */
function paymentNote(sale: ConfirmedSaleRow): string | null {
  if (isCanceledSale(sale)) return sale.cancelReason ? saleCancelReasonLabel(sale.cancelReason) : null
  return saleDeliveryBadge(sale)?.label ?? null
}

function dueLabel(sale: ConfirmedSaleRow): string | null {
  return sale.dueDate && saleOpenDebtCents(sale) > 0 ? formatSaleDueDate(sale.dueDate) : null
}

function oweLabel(sale: ConfirmedSaleRow): string {
  const due = dueLabel(sale)
  const owe = `Debe ${formatCentsMXN(sale.debtCents)}`
  return due ? `${owe} · vence ${due}` : owe
}
</script>

<template>
  <ul v-if="layout === 'cards'" class="grid min-w-0 gap-2" aria-label="Ventas del cliente">
    <li
      v-for="sale in sales"
      :key="sale.id"
      data-testid="sale-history-card"
      class="min-w-0 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]"
      :class="{ 'bg-[var(--hf-warning-soft)]': saleOpenDebtCents(sale) > 0 }"
    >
      <div class="grid min-w-0 gap-1 px-4 py-3">
        <div class="flex min-w-0 items-baseline justify-between gap-3">
          <span
            data-testid="sale-history-card-folio"
            class="min-w-0 break-all font-semibold text-[var(--hf-heading)]"
            :class="{ 'text-[var(--hf-muted)] line-through': isCanceledSale(sale) }"
          >{{ folio(sale) }}</span>
          <span class="hf-figure shrink-0 whitespace-nowrap font-semibold text-[var(--hf-heading)]">
            {{ formatCentsMXN(sale.totalCents) }}
          </span>
        </div>
        <span class="text-[13px] text-[var(--hf-muted)]">{{ whenLabel(sale) }}</span>
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <StatusBadge v-bind="salePaymentBadge(sale)" />
          <StatusBadge v-if="saleDeliveryBadge(sale)" v-bind="saleDeliveryBadge(sale)!" />
          <span v-if="isCanceledSale(sale) && paymentNote(sale)" class="text-[13px] text-[var(--hf-muted)]">
            {{ paymentNote(sale) }}
          </span>
          <span
            v-if="saleOpenDebtCents(sale) > 0"
            class="hf-figure text-[13px] font-semibold text-[var(--hf-warning)]"
          >{{ oweLabel(sale) }}</span>
        </div>
      </div>
      <button
        type="button"
        class="flex min-h-11 w-full items-center gap-2 border-t border-[var(--hf-border)] px-4 text-left text-[13px] font-medium text-[var(--hf-action)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--hf-focus)]"
        :aria-expanded="isOpen(sale)"
        :aria-controls="detailId(sale)"
        @click="toggle(sale)"
      >
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 shrink-0 transition-transform motion-reduce:transition-none"
          :class="{ 'rotate-180': isOpen(sale) }"
          aria-hidden="true"
        />
        {{ isOpen(sale) ? 'Ocultar detalle' : 'Ver productos y detalle' }}
        <span class="sr-only">de la venta {{ folio(sale) }}</span>
      </button>
      <div v-if="isOpen(sale)" :id="detailId(sale)" class="px-2 pb-2">
        <SaleHistoryRowDetail :sale-id="sale.id" :allow-charge="allowCharge" @charge="emit('charge', $event)" />
      </div>
    </li>
  </ul>

  <div v-else class="min-w-0 overflow-hidden rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]">
    <table class="hf-plain-table w-full table-fixed border-collapse text-sm">
      <caption class="sr-only">{{ caption }}</caption>
      <colgroup>
        <col class="w-11">
        <col>
        <col class="w-[9.5rem]">
        <col class="w-[6.75rem]">
        <col class="w-[7.75rem]">
      </colgroup>
      <thead>
        <tr>
          <th scope="col" class="h-10 px-0"><span class="sr-only">Abrir</span></th>
          <th scope="col" class="h-10 px-3 text-left">Venta</th>
          <th scope="col" class="h-10 px-3 text-left">Pago</th>
          <th scope="col" class="h-10 px-3 text-right">Total</th>
          <th scope="col" class="h-10 px-3 text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="sale in sales" :key="sale.id">
          <tr :class="{ 'bg-[var(--hf-active-soft)]': isOpen(sale) }">
            <td class="px-0 py-1.5 text-center align-middle">
              <button
                type="button"
                class="inline-flex size-11 items-center justify-center rounded-md text-[var(--hf-muted)] hover:bg-[var(--hf-surface-muted)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--hf-focus)]"
                :aria-expanded="isOpen(sale)"
                :aria-controls="detailId(sale)"
                :aria-label="`Detalle de la venta ${folio(sale)}`"
                @click="toggle(sale)"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 transition-transform motion-reduce:transition-none"
                  :class="{ 'rotate-90': isOpen(sale) }"
                  aria-hidden="true"
                />
              </button>
            </td>
            <td class="min-w-0 px-3 py-2.5">
              <span
                class="block truncate font-semibold text-[var(--hf-heading)]"
                :class="{ 'text-[var(--hf-muted)] line-through': isCanceledSale(sale) }"
              >{{ folio(sale) }}</span>
              <span class="block truncate text-[13px] text-[var(--hf-muted)]">{{ whenLabel(sale) }}</span>
            </td>
            <td class="min-w-0 px-3 py-2.5">
              <StatusBadge v-bind="salePaymentBadge(sale)" />
              <span v-if="paymentNote(sale)" class="mt-0.5 block truncate text-[13px] text-[var(--hf-muted)]">
                {{ paymentNote(sale) }}
              </span>
            </td>
            <td class="hf-figure px-3 py-2.5 text-right font-semibold text-[var(--hf-heading)]">{{ formatCentsMXN(sale.totalCents) }}</td>
            <td class="hf-figure px-3 py-2.5 text-right">
              <template v-if="isCanceledSale(sale)"><span class="text-[var(--hf-muted)]">—</span></template>
              <template v-else-if="saleOpenDebtCents(sale) > 0">
                <span class="block font-semibold text-[var(--hf-warning)]">{{ formatCentsMXN(sale.debtCents) }}</span>
                <span v-if="dueLabel(sale)" class="block text-[13px] text-[var(--hf-muted)]">Vence {{ dueLabel(sale) }}</span>
              </template>
              <span v-else class="text-[var(--hf-muted)]">{{ formatCentsMXN(0) }}</span>
            </td>
          </tr>
          <tr v-if="isOpen(sale)" :id="detailId(sale)">
            <td colspan="5" class="bg-[var(--hf-surface-muted)] p-2">
              <SaleHistoryRowDetail :sale-id="sale.id" :allow-charge="allowCharge" @charge="emit('charge', $event)" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
