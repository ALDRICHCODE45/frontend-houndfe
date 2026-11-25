<script setup lang="ts">
/**
 * Sales history redesign T2 (S2, S3): the seller report's confirmed sales as the same aligned table
 * as the customer history (Venta, Estado, Total, Pagado, Saldo) or, at phone width, as cards. A row
 * opens in place into the shared `SaleHistoryRowDetail` (one GET /sales/:id per opened row), which
 * names the customer here. No «Cobrar»: design 01 shows none for the seller report.
 *
 * Every figure and label is the backend row as returned (S4): no sums, no re-sorting; the payment
 * labels are this screen's current ones (S5).
 *
 * Sales history backend data T2 (S5, handoff 28 §5.1): the customer sits under the folio, so a
 * row names its buyer without opening it; «Público en general» for `null`, no line when an older
 * backend sends no `customer`.
 */
import { shallowRef, useId } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import SaleHistoryRowDetail from '@/features/POS/sales/components/history/SaleHistoryRowDetail.vue'
import {
  SELLER_REPORT_PAYMENT_STATUS_LABELS,
  SELLER_REPORT_PAYMENT_STATUS_TONES,
  formatSellerReportCents,
  formatSellerReportInstant,
  sellerReportCustomerLabel,
} from '../utils/sellerReportPresentation'
import type { SellerSalesReport } from '../interfaces/seller-report.types'

type ConfirmedRow = SellerSalesReport['confirmed']['rows'][number]

withDefaults(
  defineProps<{
    sales: readonly ConfirmedRow[]
    layout?: 'table' | 'cards'
    caption: string
  }>(),
  { layout: 'table' },
)

const idPrefix = useId()
const openIds = shallowRef<ReadonlySet<string>>(new Set())

function isOpen(sale: ConfirmedRow): boolean {
  return openIds.value.has(sale.id)
}

function toggle(sale: ConfirmedRow) {
  const next = new Set(openIds.value)
  if (!next.delete(sale.id)) next.add(sale.id)
  openIds.value = next
}

function detailId(sale: ConfirmedRow): string {
  return `${idPrefix}-detail-${sale.id}`
}

function folio(sale: ConfirmedRow): string {
  return sale.folio ?? 'Sin folio'
}

function customer(sale: ConfirmedRow): string | null {
  return sellerReportCustomerLabel(sale.customer)
}

function badge(sale: ConfirmedRow) {
  return {
    label: SELLER_REPORT_PAYMENT_STATUS_LABELS[sale.paymentStatus],
    tone: SELLER_REPORT_PAYMENT_STATUS_TONES[sale.paymentStatus],
  }
}
</script>

<template>
  <ul v-if="layout === 'cards'" class="grid min-w-0 gap-2" :aria-label="caption">
    <li
      v-for="sale in sales"
      :key="sale.id"
      data-testid="seller-report-confirmed-card"
      :data-row-id="sale.id"
      class="min-w-0 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]"
      :class="{ 'bg-[var(--hf-warning-soft)]': sale.debtCents > 0 }"
    >
      <div class="grid min-w-0 gap-1 px-4 py-3">
        <div class="flex min-w-0 items-center justify-between gap-3">
          <span class="min-w-0 break-all font-semibold text-[var(--hf-heading)]">{{
            folio(sale)
          }}</span>
          <StatusBadge v-bind="badge(sale)" />
        </div>
        <span
          v-if="customer(sale) !== null"
          data-testid="seller-report-row-customer"
          class="min-w-0 truncate text-sm text-[var(--hf-ink)]"
          :title="customer(sale) ?? undefined"
          >{{ customer(sale) }}</span
        >
        <span class="text-[13px] text-[var(--hf-muted)]">{{
          formatSellerReportInstant(sale.confirmedAt)
        }}</span>
        <dl
          class="mt-1 grid min-w-0 grid-cols-3 gap-2 border-t border-[var(--hf-border)] pt-2 text-[13px]"
        >
          <div class="min-w-0">
            <dt class="text-xs text-[var(--hf-muted)]">Total</dt>
            <dd class="hf-figure truncate font-semibold text-[var(--hf-heading)]">
              {{ formatSellerReportCents(sale.totalCents) }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-[var(--hf-muted)]">Pagado</dt>
            <dd
              class="hf-figure truncate font-semibold"
              :class="sale.paidCents > 0 ? 'text-[var(--hf-ink)]' : 'text-[var(--hf-muted)]'"
            >
              {{ formatSellerReportCents(sale.paidCents) }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-[var(--hf-muted)]">Saldo</dt>
            <dd
              class="hf-figure truncate font-semibold"
              :class="sale.debtCents > 0 ? 'text-[var(--hf-warning)]' : 'text-[var(--hf-muted)]'"
            >
              {{ formatSellerReportCents(sale.debtCents) }}
            </dd>
          </div>
        </dl>
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
        <SaleHistoryRowDetail :sale-id="sale.id" party="customer" />
      </div>
    </li>
  </ul>

  <div
    v-else
    class="min-w-0 overflow-hidden rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]"
  >
    <table class="hf-plain-table w-full table-fixed border-collapse text-sm">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <colgroup>
        <col class="w-11" />
        <col />
        <col class="w-[7rem]" />
        <col class="w-[6.5rem]" />
        <col class="w-[6.5rem]" />
        <col class="w-[6.5rem]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" class="h-10 px-0"><span class="sr-only">Abrir</span></th>
          <th scope="col" class="h-10 px-3 text-left">Venta</th>
          <th scope="col" class="h-10 px-3 text-left">Estado</th>
          <th scope="col" class="h-10 px-3 text-right">Total</th>
          <th scope="col" class="h-10 px-3 text-right">Pagado</th>
          <th scope="col" class="h-10 px-3 text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="sale in sales" :key="sale.id">
          <tr :data-row-id="sale.id" :class="{ 'bg-[var(--hf-active-soft)]': isOpen(sale) }">
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
              <span class="block truncate font-semibold text-[var(--hf-heading)]">{{
                folio(sale)
              }}</span>
              <span
                v-if="customer(sale) !== null"
                data-testid="seller-report-row-customer"
                class="block truncate text-[13px] text-[var(--hf-ink)]"
                :title="customer(sale) ?? undefined"
                >{{ customer(sale) }}</span
              >
              <span
                class="block truncate text-[13px] text-[var(--hf-muted)]"
                title="Fecha de confirmación"
                >{{ formatSellerReportInstant(sale.confirmedAt) }}</span
              >
            </td>
            <td class="min-w-0 px-3 py-2.5">
              <StatusBadge v-bind="badge(sale)" />
            </td>
            <td class="hf-figure px-3 py-2.5 text-right font-semibold text-[var(--hf-heading)]">
              {{ formatSellerReportCents(sale.totalCents) }}
            </td>
            <td
              class="hf-figure px-3 py-2.5 text-right"
              :class="sale.paidCents > 0 ? 'text-[var(--hf-ink)]' : 'text-[var(--hf-muted)]'"
            >
              {{ formatSellerReportCents(sale.paidCents) }}
            </td>
            <td
              class="hf-figure px-3 py-2.5 text-right"
              :class="
                sale.debtCents > 0
                  ? 'font-semibold text-[var(--hf-warning)]'
                  : 'text-[var(--hf-muted)]'
              "
            >
              {{ formatSellerReportCents(sale.debtCents) }}
            </td>
          </tr>
          <tr v-if="isOpen(sale)" :id="detailId(sale)">
            <td colspan="6" class="bg-[var(--hf-surface-muted)] p-2">
              <SaleHistoryRowDetail :sale-id="sale.id" party="customer" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
