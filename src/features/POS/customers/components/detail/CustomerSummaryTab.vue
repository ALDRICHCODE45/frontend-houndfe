<script setup lang="ts">
/**
 * «Resumen» of the customer page (customers-module T4, artboard 02): what is owed, the last 12
 * months, the latest sales, the pets, the main address and the notes — all from existing queries.
 * Mounted only while open. Sales parts need read:Sale and are left out without it.
 */
import { computed } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import type {
  ConfirmedSaleRow,
  SaleListSummary,
  SalesListCounts,
} from '@/features/POS/sales/interfaces/sale.types'
import { useCustomerSalesMonthly } from '@/features/POS/sales/composables/useCustomerSalesMonthly'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import type { CustomerDetail } from '../../interfaces/customer.types'
import type { CustomerTab } from '../../composables/useCustomerTab'
import { usePetsList } from '../../pets/usePets'
import { formatDueDay } from '../../utils/customerKpis'
import SalesHistoryList from '../SalesHistoryList.vue'
import SalesHistoryMonthlyChart from '../SalesHistoryMonthlyChart.vue'

const LATEST_SALES = 5

const props = defineProps<{
  customer: CustomerDetail
  canReadSales: boolean
  summary?: SaleListSummary
  counts?: SalesListCounts
  sales?: readonly ConfirmedSaleRow[]
  salesLoading?: boolean
}>()
const emit = defineEmits<{ go: [tab: CustomerTab] }>()

const isPhone = useBreakpoints(breakpointsTailwind).smaller('md')

const monthly = useCustomerSalesMonthly({
  customerId: () => props.customer.id,
  open: () => props.canReadSales,
  months: 12,
})
const pets = usePetsList(() => props.customer.id, 'ACTIVE')
const activePets = computed(() => pets.data.value ?? [])

const hasDebt = computed(() => (props.summary?.outstandingDebtCents ?? 0) > 0)
const debtLines = computed(() => {
  const summary = props.summary
  if (!summary || !hasDebt.value) return []
  const lines: string[] = []
  const pending = props.counts?.pendingPayments ?? 0
  if (pending > 0) lines.push(`${pending} ${pending === 1 ? 'venta' : 'ventas'} por cobrar`)
  const overdue = props.counts?.overdue ?? 0
  if (overdue > 0) {
    const parts = [`${overdue} ${overdue === 1 ? 'vencida' : 'vencidas'}`]
    if (typeof summary.overdueDebtCents === 'number') parts.push(formatCentsMXN(summary.overdueDebtCents))
    if (summary.oldestOverdueDueDate) parts.push(`la más antigua el ${formatDueDay(summary.oldestOverdueDueDate)}`)
    lines.push(parts.join(' · '))
  }
  return lines
})
const latestSales = computed(() => (props.sales ?? []).slice(0, LATEST_SALES))
const mainAddress = computed(() => {
  const first = props.customer.addresses[0]
  return first ? formatAddress(first) : null
})
</script>

<template>
  <div class="grid gap-4" data-testid="customer-tab-resumen">
    <div
      v-if="canReadSales && hasDebt"
      class="customer-debt-warning"
      data-testid="customer-summary-debt"
    >
      <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0 text-[var(--hf-warning)]" aria-hidden="true" />
      <div class="grid min-w-0 flex-1 gap-0.5">
        <b class="hf-figure font-semibold text-[var(--hf-warning)]">Debe {{ formatCentsMXN(summary?.outstandingDebtCents ?? 0) }}</b>
        <span v-for="line in debtLines" :key="line" class="hf-figure text-[var(--hf-ink)]">{{ line }}</span>
      </div>
      <UButton
        size="sm"
        color="neutral"
        variant="outline"
        class="min-h-11 shrink-0 justify-center"
        @click="emit('go', 'ventas')"
      >
        Ver ventas
      </UButton>
    </div>

    <template v-if="canReadSales">
      <SalesHistoryMonthlyChart v-if="monthly.months.value" :months="monthly.months.value" />
      <SalesHistoryMonthlyChart v-else-if="monthly.isError.value" failed @retry="monthly.refetch()" />

      <section class="grid gap-3" aria-labelledby="customer-latest-sales-title">
        <div class="customer-section-head">
          <h2 id="customer-latest-sales-title" class="customer-section-title">Últimas ventas</h2>
          <UButton
            v-if="latestSales.length"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-arrow-right"
            @click="emit('go', 'ventas')"
          >
            Ver todas
          </UButton>
        </div>
        <div v-if="salesLoading && !sales" class="grid gap-2" aria-busy="true">
          <USkeleton v-for="index in 3" :key="index" class="h-11 w-full !rounded" />
        </div>
        <EmptyState
          v-else-if="latestSales.length === 0"
          title="Aún no hay ventas"
          description="Este cliente aún no tiene ventas confirmadas."
        />
        <SalesHistoryList
          v-else
          :sales="latestSales"
          :layout="isPhone ? 'cards' : 'table'"
          :caption="`Últimas ventas de ${customer.fullName}`"
        />
      </section>
    </template>

    <div class="grid gap-4 md:grid-cols-2">
      <section class="customer-section" aria-labelledby="customer-summary-pets-title">
        <div class="customer-section-head">
          <h2 id="customer-summary-pets-title" class="customer-section-title">Mascotas</h2>
          <UButton color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" @click="emit('go', 'mascotas')">
            Ver mascotas
          </UButton>
        </div>
        <ul v-if="activePets.length" class="customer-list">
          <li v-for="pet in activePets" :key="pet.id" class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-semibold text-[var(--hf-heading)]">{{ pet.name }}</span>
            <span v-if="pet.breed || pet.ageLabel" class="text-[13px] text-[var(--hf-muted)]">
              {{ [pet.breed, pet.ageLabel].filter(Boolean).join(' · ') }}
            </span>
          </li>
        </ul>
        <p v-else-if="!pets.isLoading.value" class="text-[13px] text-[var(--hf-muted)]">Sin mascotas registradas.</p>
      </section>

      <section class="customer-section" aria-labelledby="customer-summary-contact-title">
        <h2 id="customer-summary-contact-title" class="customer-section-title">Dirección y notas</h2>
        <dl class="customer-dl !grid-cols-1">
          <div><dt>Dirección principal</dt><dd>{{ mainAddress ?? 'Sin direcciones guardadas' }}</dd></div>
          <div><dt>Notas</dt><dd>{{ customer.comments?.trim() || 'Sin notas' }}</dd></div>
        </dl>
      </section>
    </div>
  </div>
</template>
