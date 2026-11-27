<script setup lang="ts">
/**
 * «Cotizaciones» of the customer page (customers-module T4): `GET /quotations?customerId=` as a
 * plain table (folio, fecha, total, estado, vigencia); the folio opens the quotation. Mounted only
 * while the tab is open, so it loads only then.
 */
import { RouterLink } from 'vue-router'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import {
  CUSTOMER_QUOTATIONS_PAGE_SIZE,
  useCustomerQuotations,
} from '@/features/POS/quotations/composables/useCustomerQuotations'
import type { QuotationResponseDto } from '@/features/POS/quotations/interfaces/quotation.types'
import { formatCentsMXN } from '@/features/POS/quotations/utils/currency.utils'
import { isExpired, statusToLabel, statusToTone } from '@/features/POS/quotations/utils/quotation.utils'

const props = defineProps<{ customerId: string }>()

const { page, response, isLoading, isFetching, isError, refetch } = useCustomerQuotations({
  customerId: () => props.customerId,
  enabled: () => true,
})
const isPhone = useBreakpoints(breakpointsTailwind).smaller('md')

/** The short folio users see on the PDF: `COT-<first 8 hex of the id>`. */
function folio(quotation: QuotationResponseDto) {
  return `COT-${quotation.id.replace(/-/g, '').slice(0, 8)}`
}

/** Same rule as the quotations list: a SENT quotation past its expiry reads «Expirada». */
function status(quotation: QuotationResponseDto) {
  const value = quotation.status === 'SENT' && isExpired(quotation) ? 'EXPIRED' : quotation.status
  return { label: statusToLabel(value), tone: statusToTone(value) }
}

const detailPath = (quotation: QuotationResponseDto) => `/pos/cotizaciones/${quotation.id}`
</script>

<template>
  <div class="grid gap-3" data-testid="customer-tab-cotizaciones">
    <div v-if="isLoading && !response" class="grid gap-2" aria-busy="true">
      <span class="sr-only" role="status">Cargando las cotizaciones…</span>
      <USkeleton v-for="index in 4" :key="index" class="h-11 w-full !rounded" />
    </div>

    <EmptyState
      v-else-if="isError && !response"
      kind="error"
      title="No se pudieron cargar las cotizaciones"
      description="Puede ser un problema temporal de conexión."
      action-label="Reintentar"
      @action="refetch()"
    />

    <EmptyState
      v-else-if="response && response.data.length === 0"
      data-testid="customer-quotations-empty"
      title="Aún no hay cotizaciones"
      description="Las cotizaciones de este cliente aparecerán aquí."
    />

    <template v-else-if="response">
      <ul v-if="isPhone" class="customer-list rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)] px-4" aria-label="Cotizaciones del cliente">
        <li v-for="quotation in response.data" :key="quotation.id" class="grid gap-1">
          <div class="flex items-center justify-between gap-3">
            <RouterLink :to="detailPath(quotation)" class="hf-row-primary hf-figure">{{ folio(quotation) }}</RouterLink>
            <span class="hf-figure font-semibold">{{ formatCentsMXN(quotation.totalCents) }}</span>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--hf-muted)]">
            <span>{{ formatShortDateTime(quotation.createdAt) }}</span>
            <StatusBadge v-bind="status(quotation)" />
          </div>
        </li>
      </ul>
      <div v-else class="overflow-x-auto rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]">
        <table class="hf-plain-table w-full text-sm" :class="{ 'opacity-50': isFetching }">
          <caption class="sr-only">Cotizaciones del cliente, más recientes primero</caption>
          <thead>
            <tr>
              <th scope="col" class="px-3 py-2 text-left">Folio</th>
              <th scope="col" class="px-3 py-2 text-left">Fecha</th>
              <th scope="col" class="px-3 py-2 text-right">Total</th>
              <th scope="col" class="px-3 py-2 text-left">Estado</th>
              <th scope="col" class="px-3 py-2 text-left">Vigencia</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="quotation in response.data" :key="quotation.id">
              <td class="px-3 py-2">
                <RouterLink
                  :to="detailPath(quotation)"
                  class="hf-row-primary hf-figure"
                  :data-testid="`customer-quotation-${quotation.id}`"
                >{{ folio(quotation) }}</RouterLink>
              </td>
              <td class="px-3 py-2">{{ formatShortDateTime(quotation.createdAt) }}</td>
              <td class="hf-figure px-3 py-2 text-right">{{ formatCentsMXN(quotation.totalCents) }}</td>
              <td class="px-3 py-2"><StatusBadge v-bind="status(quotation)" /></td>
              <td class="px-3 py-2">{{ formatShortDateTime(quotation.expiresAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="response.pagination.totalPages > 1"
        class="flex flex-wrap items-center justify-between gap-3"
      >
        <span class="hf-figure text-sm text-[var(--hf-muted)]">{{ response.pagination.total }} cotizaciones</span>
        <UPagination
          v-model:page="page"
          :items-per-page="CUSTOMER_QUOTATIONS_PAGE_SIZE"
          :total="response.pagination.total"
          :disabled="isFetching"
          show-edges
          :sibling-count="0"
          size="sm"
        />
      </div>
    </template>
  </div>
</template>
