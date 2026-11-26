<script setup lang="ts">
/**
 * The body of the customer's sales history (customers-module T4): loading, error, debt banner,
 * metrics, overdue warning, monthly chart, folio search, status and pet filters, the list with
 * its row detail and the «Cobrar» of one row. State comes from `useCustomerSalesHistoryView`;
 * the history slideover and the «Ventas» tab of the customer page render the same body.
 * «Cobrar todo» is the parent's (`collect`), which also owns the collection sheet.
 */
import DebtPaymentModal from '@/features/POS/sales/components/DebtPaymentModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import SalesHistoryList from './SalesHistoryList.vue'
import SalesHistoryMetrics from './SalesHistoryMetrics.vue'
import SalesHistoryMonthlyChart from './SalesHistoryMonthlyChart.vue'
import SalesHistoryPetFilter from './SalesHistoryPetFilter.vue'
import SalesHistoryStatusFilter from './SalesHistoryStatusFilter.vue'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import {
  STATUS_EMPTY_COPY,
  type CustomerSalesHistoryView,
} from '../composables/useCustomerSalesHistoryView'

const props = withDefaults(
  defineProps<{
    history: CustomerSalesHistoryView
    /** The metric strip; the customer page hides it because its KPI strip already says it. */
    showMetrics?: boolean
  }>(),
  { showMetrics: true },
)
const emit = defineEmits<{ collect: [] }>()

// The controller is created once by the parent and never replaced: its refs are read as bindings.
const {
  customer,
  searchQuery,
  petId,
  petNotice,
  status,
  pets,
  selectedPet,
  response,
  customerSummary,
  customerCounts,
  isPageTransition,
  refetch,
  monthlyMonths,
  monthlyFailed,
  refetchMonthly,
  listLayout,
  initialLoading,
  normalizedError,
  hasSearchQuery,
  customerHasNoSales,
  overdueLabel,
  collectActionLabel,
  showDebtBanner,
  showMonthlyChart,
  showCollectAction,
  pendingPaymentsLabel,
  chargeRequest,
  chargeOpen,
  onCharge,
  onChargeSuccess,
} = props.history
</script>

<template>
  <div
    data-testid="history-content"
    :aria-busy="initialLoading || undefined"
    class="grid min-w-0 max-w-full gap-3 overflow-x-hidden"
  >
    <div v-if="initialLoading" aria-hidden="true" class="grid gap-3">
      <span class="sr-only" role="status">Cargando el historial de ventas…</span>
      <div
        v-if="showMetrics"
        class="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--hf-border)] sm:grid-cols-3"
      >
        <div
          v-for="index in 3"
          :key="index"
          data-testid="metric-skeleton"
          class="grid gap-1.5 px-4 py-3"
          :class="{ 'col-span-2 sm:col-span-1': index === 3 }"
        >
          <USkeleton class="h-3 w-20 !rounded" />
          <USkeleton class="h-5 w-24 !rounded" />
        </div>
      </div>
      <UInput
        type="search"
        icon="i-lucide-search"
        size="lg"
        placeholder="Buscar por folio..."
        aria-label="Buscar ventas por folio"
        disabled
        class="w-full"
      />
      <!-- One list surface with hairline rows (like the table it stands for), not a card per row. -->
      <div class="grid divide-y divide-[var(--hf-border)] overflow-hidden rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)]">
        <div
          v-for="index in 5"
          :key="index"
          data-testid="row-skeleton"
          class="grid gap-1.5 px-4 py-3"
        >
          <div class="flex items-center justify-between gap-3">
            <USkeleton class="h-4 w-24 !rounded" />
            <USkeleton class="h-4 w-16 !rounded" />
          </div>
          <USkeleton class="h-3 w-40 !rounded" />
        </div>
      </div>
    </div>

    <EmptyState
      v-else-if="normalizedError"
      kind="error"
      :title="normalizedError.message"
      description="Puede ser un problema temporal de conexión. No se modificó ninguna venta."
      action-label="Reintentar"
      action-test-id="history-error-retry"
      @action="refetch()"
    />

    <template v-else-if="response">
      <div
        v-if="showDebtBanner"
        data-testid="history-debt-banner"
        class="flex min-w-0 items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--hf-warning)_35%,var(--hf-warning-soft))] bg-[var(--hf-warning-soft)] px-4 py-3 text-[13px]"
      >
        <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0 text-[var(--hf-warning)]" aria-hidden="true" />
        <div class="grid min-w-0 flex-1 gap-0.5">
          <b class="hf-figure font-semibold text-[var(--hf-warning)]">Debe {{ formatCentsMXN(customerSummary?.outstandingDebtCents ?? 0) }}</b>
          <span v-if="pendingPaymentsLabel" class="text-[var(--hf-ink)]">{{ pendingPaymentsLabel }}</span>
          <span
            v-if="overdueLabel"
            data-testid="history-debt-banner-overdue"
            class="hf-figure font-semibold text-[var(--hf-warning)]"
          >{{ overdueLabel }}</span>
        </div>
        <div class="flex shrink-0 flex-col items-stretch gap-2">
          <UButton
            v-if="showCollectAction"
            data-testid="history-collect-all-banner"
            size="sm"
            class="hf-primary-control min-h-11 justify-center"
            @click="emit('collect')"
          >
            {{ collectActionLabel }}
          </UButton>
          <UButton
            v-if="overdueLabel && status !== 'overdue'"
            size="sm"
            color="neutral"
            variant="outline"
            class="min-h-11 shrink-0 justify-center"
            aria-label="Ver las ventas vencidas"
            @click="status = 'overdue'"
          >
            Ver vencidas
          </UButton>
          <UButton
            v-else-if="!overdueLabel"
            size="sm"
            color="neutral"
            variant="outline"
            class="min-h-11 shrink-0 justify-center"
            :aria-label="'Ver las ventas con saldo'"
            @click="status = 'with-debt'"
          >
            Ver
          </UButton>
        </div>
      </div>

      <SalesHistoryMetrics
        v-if="showMetrics && customerSummary"
        :summary="customerSummary"
        :counts="customerCounts"
      />

      <div
        v-if="listLayout === 'table' && overdueLabel"
        data-testid="history-overdue-warning"
        class="flex min-w-0 items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--hf-warning)_35%,var(--hf-warning-soft))] bg-[var(--hf-warning-soft)] px-4 py-2 text-[13px]"
      >
        <UIcon name="i-lucide-calendar-clock" class="size-4 shrink-0 text-[var(--hf-warning)]" aria-hidden="true" />
        <span class="hf-figure min-w-0 flex-1 font-semibold text-[var(--hf-warning)]">{{ overdueLabel }}</span>
        <UButton
          v-if="status !== 'overdue'"
          size="sm"
          color="neutral"
          variant="outline"
          class="shrink-0"
          aria-label="Ver las ventas vencidas"
          @click="status = 'overdue'"
        >
          Ver vencidas
        </UButton>
      </div>

      <template v-if="showMonthlyChart">
        <SalesHistoryMonthlyChart v-if="monthlyMonths" :months="monthlyMonths" />
        <SalesHistoryMonthlyChart v-else-if="monthlyFailed" failed @retry="refetchMonthly()" />
      </template>

      <template v-if="!customerHasNoSales">
        <div class="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <UInput
            v-model="searchQuery"
            type="search"
            icon="i-lucide-search"
            size="lg"
            placeholder="Buscar por folio..."
            aria-label="Buscar ventas por folio"
            class="w-full md:w-auto md:min-w-48 md:flex-1"
          />
          <SalesHistoryStatusFilter v-model="status" :counts="customerCounts" />
        </div>
        <SalesHistoryPetFilter v-if="pets.length > 0" v-model="petId" :pets="pets" />
      </template>
      <UAlert
        v-if="petNotice"
        data-testid="history-pet-notice"
        color="warning"
        variant="subtle"
        icon="i-lucide-info"
        :description="petNotice"
        role="status"
      />

      <EmptyState
        v-if="response.data.length === 0 && hasSearchQuery"
        kind="no-match"
        :title="`Ningún resultado para «${searchQuery.trim()}»`"
        description="No se encontraron ventas que coincidan con la búsqueda."
        action-label="Limpiar filtros"
        @action="searchQuery = ''"
      />
      <EmptyState
        v-else-if="response.data.length === 0 && selectedPet"
        :title="`${selectedPet.name} aún no tiene ventas`"
        :description="status === 'all' ? 'No hay ventas confirmadas para esta mascota.' : 'No hay ventas de esta mascota con este filtro.'"
        action-label="Ver todas las ventas"
        @action="petId = null; status = 'all'"
      />
      <EmptyState
        v-else-if="response.data.length === 0 && status !== 'all'"
        kind="no-match"
        :title="STATUS_EMPTY_COPY[status]"
        description="Este cliente no tiene ventas con este filtro."
        action-label="Ver todas"
        @action="status = 'all'"
      />
      <EmptyState
        v-else-if="response.data.length === 0"
        title="Aún no hay ventas"
        description="Este cliente aún no tiene ventas confirmadas."
      />
      <template v-else>
        <p
          v-if="isPageTransition"
          data-testid="history-updating"
          role="status"
          aria-live="polite"
          class="flex items-center gap-2 rounded-lg bg-[var(--hf-active-soft)] px-3 py-2 text-[13px] text-[var(--hf-active)]"
        >
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Actualizando el historial…
        </p>
        <div
          :aria-busy="isPageTransition || undefined"
          :class="isPageTransition ? 'opacity-50' : undefined"
        >
          <SalesHistoryList
            :sales="response.data"
            :layout="listLayout"
            allow-charge
            :caption="customer ? `Ventas de ${customer.fullName}, más recientes primero` : undefined"
            @charge="onCharge"
          />
        </div>
      </template>
    </template>

    <DebtPaymentModal
      v-if="chargeRequest"
      :key="chargeRequest.saleId"
      v-model:open="chargeOpen"
      :sale-id="chargeRequest.saleId"
      :debt-cents="chargeRequest.debtCents"
      portal-class="hf-theme hf-ui hf-form-overlay"
      @success="onChargeSuccess"
    />
  </div>
</template>
