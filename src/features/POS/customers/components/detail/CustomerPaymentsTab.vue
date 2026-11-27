<script setup lang="ts">
/**
 * «Cobros y recibos» of the customer page (customers-module T5, S4 artboard 02 + 05):
 * `GET /customers/:customerId/payments` (handoff 32 §6), newest first, 50 per page unless the person picked another size (owner-ideas-batch S5). A plain table on
 * desktop, one row per event on a phone: Fecha, Tipo («Cobrar todo» with its tenders and the sales it
 * covered, or «Pago» with its method and sale), Monto (net of change), Cajero and Comprobante.
 *
 * Refunds are not in the feed (v1): a muted note says so and no running balance is ever shown.
 * Mounted only while the tab is open, so it loads only then.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatPaymentMethod } from '@/features/POS/sales/utils/salePaymentMethod.utils'
import type { CustomerReceiptChoice } from '../../api/customer-detail.api'
import { useCustomerPayments, useCustomerReceiptDownload } from '../../composables/useCustomerPayments'
import type {
  CustomerPaymentCatalog,
  CustomerPaymentEvent,
  CustomerPaymentMethod,
  CustomerPaymentSaleStatus,
} from '../../interfaces/customer.types'

const props = defineProps<{ customerId: string; phone?: boolean }>()

const { page, pageSize, pageSizeOptions, response, isLoading, isFetching, isError, refetch } = useCustomerPayments({
  customerId: () => props.customerId,
  enabled: () => true,
})

// owner-ideas-batch S5: the shared «N por página» choice, same menu as DataTablePagination. Only
// offered when the events do not all fit in the smallest page.
const showPageSize = computed(() => (response.value?.pagination.total ?? 0) > Math.min(...pageSizeOptions))
const pageSizeItems = computed(() =>
  pageSizeOptions.map((size) => [
    {
      label: `${size} por página`,
      type: 'checkbox' as const,
      checked: pageSize.value === size,
      onSelect: () => {
        pageSize.value = size
      },
    },
  ]),
)
const receipt = useCustomerReceiptDownload()

const RECEIPT_CHOICES: ReadonlyArray<{ choice: CustomerReceiptChoice; label: string }> = [
  { choice: 'ticket', label: 'Ticket' },
  { choice: 'a4', label: 'A4' },
]

/** Lowercase on the wire → the shared Spanish label; a catalog method keeps its own name. */
function methodLabel(method: CustomerPaymentMethod, catalog: CustomerPaymentCatalog | null): string {
  const name = catalog?.name?.trim()
  if (name) return name
  const label = formatPaymentMethod(method.toUpperCase())
  return label === method.toUpperCase() ? method : label
}

interface SaleRef {
  id: string
  folio: string
  canceled: boolean
}

interface PaymentRow {
  event: CustomerPaymentEvent
  type: string
  detail: string
  sales: SaleRef[]
}

const isCanceled = (status: CustomerPaymentSaleStatus) => status === 'CANCELED'

function toRow(event: CustomerPaymentEvent): PaymentRow {
  if (event.kind === 'collection') {
    return {
      event,
      type: 'Cobrar todo',
      detail: event.payments
        .map((tender) => `${methodLabel(tender.method, tender.catalog)} ${formatCentsMXN(tender.amountCents)}`)
        .join(' · '),
      sales: event.sales.map((sale) => ({ id: sale.saleId, folio: sale.folio, canceled: isCanceled(sale.status) })),
    }
  }
  return {
    event,
    type: 'Pago',
    detail: methodLabel(event.method, event.catalog),
    sales: [{ id: event.sale.id, folio: event.sale.folio, canceled: isCanceled(event.sale.status) }],
  }
}

const rows = (events: readonly CustomerPaymentEvent[]) => events.map(toRow)
const salePath = (sale: SaleRef) => `/pos/ventas/${sale.id}`
const isDownloading = (event: CustomerPaymentEvent, choice: CustomerReceiptChoice) =>
  receipt.downloading.value === `${event.eventId}:${choice}`
</script>

<template>
  <div class="grid gap-3" data-testid="customer-tab-cobros">
    <div v-if="isLoading && !response" class="grid gap-2" aria-busy="true">
      <span class="sr-only" role="status">Cargando los cobros…</span>
      <USkeleton v-for="index in 4" :key="index" class="h-11 w-full !rounded" />
    </div>

    <EmptyState
      v-else-if="isError && !response"
      kind="error"
      title="No se pudieron cargar los cobros"
      description="Puede ser un problema temporal de conexión."
      action-label="Reintentar"
      @action="refetch()"
    />

    <EmptyState
      v-else-if="response && response.data.length === 0"
      data-testid="customer-payments-empty"
      title="Sin cobros todavía"
      description="Los pagos y los cobros de este cliente aparecerán aquí."
    />

    <template v-else-if="response">
      <p class="text-[13px] text-[var(--hf-muted)]" data-testid="customer-payments-note">No incluye reembolsos.</p>
      <p
        v-if="receipt.error.value"
        role="alert"
        class="text-sm text-(--hf-danger)"
        data-testid="customer-payments-receipt-error"
      >
        {{ receipt.error.value }}
      </p>

      <ul
        v-if="phone"
        class="customer-list customer-payments-rows rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)] px-4"
        :class="{ 'opacity-50': isFetching }"
        aria-label="Cobros del cliente"
      >
        <li
          v-for="row in rows(response.data)"
          :key="row.event.eventId"
          class="grid gap-1"
          :data-testid="`customer-payment-row-${row.event.eventId}`"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="min-w-0 font-semibold text-[var(--hf-heading)]">{{ row.type }}</span>
            <span class="hf-figure shrink-0 font-semibold">{{ formatCentsMXN(row.event.amountCents) }}</span>
          </div>
          <p class="customer-payment-detail text-[13px] text-[var(--hf-muted)]">{{ row.detail }}</p>
          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <span v-for="sale in row.sales" :key="sale.id" class="inline-flex items-center gap-1">
              <RouterLink :to="salePath(sale)" class="hf-row-primary hf-figure">{{ sale.folio }}</RouterLink>
              <StatusBadge v-if="sale.canceled" label="Cancelada" tone="neutral" />
            </span>
          </p>
          <div class="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--hf-muted)]">
            <span class="hf-figure">{{ formatShortDateTime(row.event.occurredAt) }} · {{ row.event.cashier?.name ?? '—' }}</span>
            <span v-if="row.event.receiptPath" class="flex gap-2">
              <UButton
                v-for="option in RECEIPT_CHOICES"
                :key="option.choice"
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-download"
                class="min-h-11"
                :aria-label="`Descargar comprobante ${option.label}`"
                :data-testid="`customer-payment-${row.event.eventId}-receipt-${option.choice}`"
                :loading="isDownloading(row.event, option.choice)"
                :disabled="receipt.downloading.value !== null"
                @click="receipt.download(row.event, option.choice)"
              >
                {{ option.label }}
              </UButton>
            </span>
            <span v-else data-testid="customer-payment-no-receipt">Venta cancelada</span>
          </div>
        </li>
      </ul>

      <div v-else class="overflow-x-auto rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]">
        <table class="hf-plain-table w-full text-sm" :class="{ 'opacity-50': isFetching }">
          <caption class="sr-only">Cobros y pagos del cliente, más recientes primero. No incluye reembolsos.</caption>
          <thead>
            <tr>
              <th scope="col" class="px-3 py-2 text-left">Fecha</th>
              <th scope="col" class="px-3 py-2 text-left">Tipo</th>
              <th scope="col" class="px-3 py-2 text-right">Monto</th>
              <th scope="col" class="px-3 py-2 text-left">Cajero</th>
              <th scope="col" class="px-3 py-2 text-left">Comprobante</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows(response.data)"
              :key="row.event.eventId"
              class="align-top"
              :data-testid="`customer-payment-${row.event.eventId}`"
            >
              <td class="hf-figure whitespace-nowrap px-3 py-2">{{ formatShortDateTime(row.event.occurredAt) }}</td>
              <td class="min-w-0 px-3 py-2">
                <div class="grid gap-0.5">
                  <span class="font-semibold text-[var(--hf-heading)]">{{ row.type }}</span>
                  <span class="customer-payment-detail text-[13px] text-[var(--hf-muted)]">{{ row.detail }}</span>
                  <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <span class="text-[var(--hf-muted)]">{{ row.sales.length === 1 ? 'Venta' : 'Ventas' }}</span>
                    <span v-for="sale in row.sales" :key="sale.id" class="inline-flex items-center gap-1">
                      <RouterLink :to="salePath(sale)" class="hf-row-primary hf-figure">{{ sale.folio }}</RouterLink>
                      <StatusBadge v-if="sale.canceled" label="Cancelada" tone="neutral" />
                    </span>
                  </span>
                </div>
              </td>
              <td class="hf-figure whitespace-nowrap px-3 py-2 text-right font-semibold">
                {{ formatCentsMXN(row.event.amountCents) }}
              </td>
              <td class="px-3 py-2">{{ row.event.cashier?.name ?? '—' }}</td>
              <td class="px-3 py-2">
                <span v-if="row.event.receiptPath" class="flex flex-wrap gap-2">
                  <UButton
                    v-for="option in RECEIPT_CHOICES"
                    :key="option.choice"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-download"
                    :aria-label="`Descargar comprobante ${option.label}`"
                    :data-testid="`customer-payment-${row.event.eventId}-receipt-${option.choice}`"
                    :loading="isDownloading(row.event, option.choice)"
                    :disabled="receipt.downloading.value !== null"
                    @click="receipt.download(row.event, option.choice)"
                  >
                    {{ option.label }}
                  </UButton>
                </span>
                <span v-else class="text-[13px] text-[var(--hf-muted)]" data-testid="customer-payment-no-receipt">Venta cancelada</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="showPageSize || response.pagination.totalPages > 1"
        class="flex flex-wrap items-center justify-between gap-3"
        data-testid="customer-payments-pager"
      >
        <span class="hf-figure text-sm text-[var(--hf-muted)]">{{ response.pagination.total }} cobros</span>
        <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <UDropdownMenu v-if="showPageSize" :items="pageSizeItems" :content="{ align: 'end' as const }">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              trailing-icon="i-lucide-chevron-down"
              :aria-label="`${pageSize} por página`"
              data-testid="customer-payments-page-size"
            >
              <span class="hf-figure">{{ pageSize }}</span><span class="hidden sm:inline">&nbsp;por página</span>
            </UButton>
          </UDropdownMenu>
          <UPagination
            v-if="response.pagination.totalPages > 1"
            v-model:page="page"
            :items-per-page="pageSize"
            :total="response.pagination.total"
            :disabled="isFetching"
            show-edges
            :sibling-count="0"
            size="sm"
          />
        </div>
      </div>
    </template>
  </div>
</template>
