<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { AppDataTable } from '@/core/shared/components/DataTable'
import { DataTableFilters, useDataTableFilters, useFiltersUrlAdapter } from '@/core/shared/data-table-filters'
import SortableHeader from '@/core/shared/components/DataTable/SortableHeader.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useConfirmedSales } from '../composables/useConfirmedSales'
import { useSalesColumns } from '../composables/useSalesColumns'
import SalesListTabs, { type SalesListTab, type SalesListTabChange } from '../components/SalesListTabs.vue'
import PaymentMethodPills from '../components/PaymentMethodPills.vue'
import { createSalesFiltersSchema } from '../config/salesFiltersSchema'
import { formatSaleDueDate } from '../utils/saleDate.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { getDeliveryStatusBadge, getPaymentStatusBadge, saleBadgeTone } from '../utils/saleStatus.utils'
import type { ConfirmedSaleRow } from '../interfaces/sale.types'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import { usersApi } from '@/features/POS/users/api/user.api'
import { customerQueryKeys, usersQueryKeys } from '@/core/shared/constants/query-keys'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import '../styles/sales-list-visual.css'

const router = useRouter()
const authStore = useAuthStore()
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const canCreateSale = computed(() => authStore.userCan('create', 'Sale'))
const tenantId = computed(() => authStore.currentTenantId || 'default')

// Mobile detection — below md, DataTableFilters runs embedded inside the
// wrapper's bottom-sheet (single "Filtros" tap → one sheet). At md+ it runs
// standalone so its own "Filtros" trigger + lateral slideover return to the
// desktop toolbar (the embedded card sections must NEVER leak into desktop).
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

const customersQuery = useQuery({
  queryKey: computed(() => customerQueryKeys.paginated(tenantId.value)),
  queryFn: () => customerApi.getPaginated({ pageIndex: 0, pageSize: 100, sorting: [], globalFilter: '' }),
  staleTime: 30_000,
})

const cashiersQuery = useQuery({
  queryKey: usersQueryKeys.assignable(),
  queryFn: () => usersApi.listAssignable(),
  staleTime: 30_000,
})

const customerOptions = computed(() =>
  (customersQuery.data.value?.data ?? []).map((customer) => ({
    value: customer.id,
    label: `${customer.firstName} ${customer.lastName ?? ''}`.trim(),
  })),
)

const cashierOptions = computed(() =>
  (cashiersQuery.data.value ?? []).map((user) => ({
    value: user.id,
    label: user.name,
  })),
)

const salesFiltersSchema = computed(() => createSalesFiltersSchema({
  customerOptions: customerOptions.value,
  cashierOptions: cashierOptions.value,
  customerLoading: customersQuery.isLoading.value,
  cashierLoading: cashiersQuery.isLoading.value,
}))

const filtersAdapter = useFiltersUrlAdapter(salesFiltersSchema)
const filtersCtl = useDataTableFilters(salesFiltersSchema, filtersAdapter)
const filtersState = computed({
  get: () => filtersCtl.state.value,
  set: (next) => { filtersCtl.state.value = next },
})

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
  counts,
  setTabFilter,
  filterErrors,
} = useConfirmedSales(filtersCtl.backendParams)

const { columns } = useSalesColumns()

// Error title of the sales table: a human sentence, never the server message.
const salesErrorMessage = 'No se pudieron cargar las ventas'

// sdd customer-sales-history S1: folio/confirmedAt/paymentStatus may be null
// per handoff §2.5. Helpers keep the template expressions clean.
function folioDisplay(folio: string | null) {
  return folio != null ? extractFolioNumber(folio) : 'Sin folio'
}
function customerDisplay(sale: ConfirmedSaleRow) {
  return sale.customer?.name ?? 'Público en general'
}
function paymentBadge(sale: ConfirmedSaleRow) {
  if (sale.paymentStatus == null) return { label: 'Sin estado', tone: 'neutral' as const }
  const badge = getPaymentStatusBadge(sale.paymentStatus)
  return { label: badge.label, tone: saleBadgeTone(badge.color) }
}
function deliveryBadge(sale: ConfirmedSaleRow) {
  const badge = getDeliveryStatusBadge(sale.deliveryStatus)
  return { label: badge.label, tone: saleBadgeTone(badge.color) }
}
const saleWhen = (sale: ConfirmedSaleRow) =>
  sale.confirmedAt == null ? 'Fecha no disponible' : formatShortDateTime(sale.confirmedAt)

const sortValue = ref<'confirmedAt:desc' | 'totalCents:asc' | 'createdAt:desc'>('confirmedAt:desc')

watch(sortValue, (value) => {
  const [id, order] = value.split(':')
  sorting.value = [{ id: id ?? 'confirmedAt', desc: order === 'desc' }]
})

function goToNewSale() {
  void router.push('/pos/ventas/nueva')
}

function goToSaleDetail(id: string) {
  void router.push(`/pos/ventas/${id}`)
}

// The whole row opens the sale: AppDataTable's `row-open` for table rows,
// `rowProps` for cards. The folio button is the tab stop, so neither is focusable itself.
function openSale(sale: ConfirmedSaleRow) {
  goToSaleDetail(sale.id)
}
const { rowProps } = useClickableRow<ConfirmedSaleRow>(openSale, { focusable: false })

// No ⋮ menu: its only item would be "Ver venta", which the row click already does.

// Quick-tab selection lives here so the list can tell "no sales yet" from
// "no sales for this tab" and offer one way back (Limpiar filtros).
const activeTab = ref<SalesListTab>('all')
function onTabChange(payload: SalesListTabChange) {
  activeTab.value =
    payload.deliveryStatus !== undefined ? 'pending-delivery'
      : payload.paymentStatus !== undefined ? 'pending-payments'
        : 'all'
  setTabFilter(payload)
}

const hasSearch = computed(() => globalFilter.value.trim() !== '')
const hasActiveFilters = computed(
  () => hasSearch.value || filtersCtl.activeCount.value > 0 || activeTab.value !== 'all',
)
// Counts describe the tenant's sales: with none yet there is nothing to count.
const showTabCounts = computed(() => isLoading.value || isError.value || totalCount.value > 0 || hasActiveFilters.value)
const activeFilterCount = computed(
  () => filtersCtl.activeCount.value + (activeTab.value !== 'all' ? 1 : 0),
)
// With a search term the table names it (`Ningún resultado para «…»`); this covers filters only.
const noMatchTitle = 'Ninguna venta con estos filtros'
const emptyState = computed(() => ({
  title: 'Aún no hay ventas',
  description: 'Las ventas confirmadas aparecen aquí.',
  actionLabel: canCreateSale.value ? 'Nueva venta' : undefined,
  actionIcon: canCreateSale.value ? 'i-lucide-plus' : undefined,
}))

function clearFilters() {
  filtersCtl.clearAll()
  globalFilter.value = ''
  onTabChange({})
}

watch(() => filtersCtl.serializedState.value, () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})
</script>

<template>
  <div class="hf-theme hf-ui sales-list-visual flex w-full min-w-0 flex-col gap-6 md:px-10">
    <template v-if="canReadSales">
      <div class="hf-page-header">
        <h1 class="hf-page-title">Ventas</h1>
      </div>
    </template>

    <UCard
      v-if="canReadSales"
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="salesErrorMessage"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :enable-row-selection="false"
          :show-add-button="canCreateSale"
          :row-open="openSale"
          :filtered="hasActiveFilters"
          :no-match-title="noMatchTitle"
          :empty-state="emptyState"
          :active-filter-count="activeFilterCount"
          add-button-text="Nueva venta"
          add-button-test-id="toolbar-add-button"
          enable-column-visibility
          search-placeholder="Buscar ventas..."
          empty="No hay ventas todavía"
          display-mode="auto"
          mobile-render="cards"
          class="hf-data-table"
          portal-class="hf-theme hf-ui sales-list-portal"
          pagination-portal-class="hf-theme hf-ui sales-list-portal"
          @add="goToNewSale"
          @empty-action="goToNewSale"
          @refresh="refresh"
          @clear-filters="clearFilters"
        >
          <template #filters>
            <!-- Three regions (filter · segment · sort) separated by vertical
                 dividers so the toolbar reads as one composed row instead of
                 a flat pile. Dividers only render at md+ — mobile wraps and
                 keeps its own bottom-sheet layout, where the dividers would
                 be noise. -->
            <div class="flex w-full flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap">
              <!-- Region 1 — filter (DataTableFilters renders its own chips +
                "Limpiar todo" when not embedded, which covers the previous
                duplicate "extended-filters-indicator" entirely). -->
              <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <DataTableFilters
                  v-model:state="filtersState"
                  :schema="salesFiltersSchema"
                  :errors="filterErrors"
                  :embedded="isMobile"
                  portal-class="hf-theme hf-ui sales-list-portal"
                />
              </div>

              <div class="hidden h-5 w-px shrink-0 bg-default md:block" aria-hidden="true" />

              <!-- Region 2 — segment (delivery-status quick tabs). -->
              <div class="overflow-x-auto">
                <SalesListTabs :counts="counts" :active="activeTab" :show-counts="showTabCounts" @change="onTabChange" />
              </div>

              <div class="hidden h-5 w-px shrink-0 bg-default md:block" aria-hidden="true" />

              <!-- Region 3 — sort (predefined orderings, backend-safe). -->
              <USelect
                v-model="sortValue"
                :items="[
                  { label: 'Más recientes', value: 'confirmedAt:desc' },
                  { label: 'Total menor a mayor', value: 'totalCents:asc' },
                  { label: 'Creación reciente', value: 'createdAt:desc' },
                ]"
                class="w-56 shrink-0"
                :ui="{ content: 'hf-theme hf-ui sales-list-portal' }"
              />
            </div>
          </template>

          <!-- Sortable headers — only the columns the backend accepts as
               sortBy (confirmedAt / totalCents / createdAt) get a live sort
               control; the USelect shortcut above writes into the same
               `sorting` ref. Columns the backend cannot order by render the
               plain default header so no click can fire an invalid sortBy. -->
          <template #confirmedAt-header="{ column }">
            <SortableHeader :column="column" label="Fecha" />
          </template>
          <template #totalCents-header="{ column }">
            <SortableHeader :column="column" label="Total" />
          </template>

          <template #venta-cell="{ row }">
            <button
              type="button"
              class="hf-row-primary sale-row-link"
              :data-testid="`sale-link-${row.original.id}`"
              @click="openSale(row.original)"
            >
              {{ folioDisplay(row.original.folio) }}
            </button>
          </template>

          <template #customer-cell="{ row }">
            <span class="sale-customer" data-testid="sale-customer">{{ customerDisplay(row.original) }}</span>
          </template>

          <template #confirmedAt-cell="{ row }">
            <span class="sale-when">{{ saleWhen(row.original) }}</span>
          </template>

          <template #paymentStatus-cell="{ row }">
            <StatusBadge
              data-testid="sale-payment-status"
              v-bind="paymentBadge(row.original)"
              aria-prefix="Pago:"
            />
          </template>

          <template #paymentMethods-cell="{ row }">
            <PaymentMethodPills
              :methods="row.original.paymentMethods"
              portal-class="hf-theme hf-ui sales-list-portal"
            />
          </template>

          <template #totalCents-cell="{ row }">
            <span class="hf-figure sale-total block text-right">{{ formatCentsMXN(row.original.totalCents) }}</span>
          </template>

          <template #debtCents-cell="{ row }">
            <span
              v-if="row.original.debtCents > 0"
              class="hf-figure sale-debt block text-right"
              data-testid="sale-debt"
            >{{ formatCentsMXN(row.original.debtCents) }}</span>
            <span v-else class="hf-figure block text-right">—</span>
          </template>

          <template #dueDate-cell="{ row }">
            <span class="sale-when">{{ row.original.dueDate ? formatSaleDueDate(row.original.dueDate) : '—' }}</span>
          </template>

          <template #deliveryStatus-cell="{ row }">
            <StatusBadge
              data-testid="sale-delivery-status"
              v-bind="deliveryBadge(row.original)"
              aria-prefix="Productos:"
            />
          </template>

          <template #cashier-cell="{ row }">
            {{ row.original.cashier.name }}
          </template>

          <template #seller-cell="{ row }">
            {{ row.original.seller?.name ?? '' }}
          </template>

          <template #channel-cell>Punto de venta</template>
          <template #invoice-cell></template>

          <template #mobile-card="{ row }">
            <article class="sale-card" data-testid="sale-card" v-bind="rowProps(row)">
              <div class="sale-card-head">
                <button
                  type="button"
                  class="hf-row-primary sale-row-link"
                  :data-testid="`sale-link-${row.id}`"
                  @click="openSale(row)"
                >
                  {{ folioDisplay(row.folio) }}
                </button>
              </div>
              <span class="hf-row-secondary" data-testid="sale-customer">{{ customerDisplay(row) }}</span>
              <div class="sale-card-meta">
                <StatusBadge v-bind="paymentBadge(row)" aria-prefix="Pago:" />
                <StatusBadge v-bind="deliveryBadge(row)" aria-prefix="Productos:" />
                <PaymentMethodPills
                  v-if="row.paymentMethods.length > 0"
                  :methods="row.paymentMethods"
                  compact
                  portal-class="hf-theme hf-ui sales-list-portal"
                />
              </div>
              <p v-if="row.debtCents > 0" class="sale-card-debt" data-testid="sale-card-debt">
                Deuda <span class="hf-figure">{{ formatCentsMXN(row.debtCents) }}</span>
                <template v-if="row.dueDate">
                  · <span data-testid="sale-card-due-date">Vence {{ formatSaleDueDate(row.dueDate) }}</span>
                </template>
              </p>
              <div class="sale-card-footer">
                <span class="hf-figure sale-total">{{ formatCentsMXN(row.totalCents) }}</span>
                <span>{{ saleWhen(row) }}</span>
              </div>
            </article>
          </template>
        </AppDataTable>
      </div>
    </UCard>

    <EmptyState
      v-else
      kind="forbidden"
      title="Tu rol no puede ver las ventas"
      description="Pide acceso a quien administra tu cuenta."
    />
  </div>
</template>

<style scoped>
.sale-customer { display: block; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sale-row-link { padding: 0; border: 0; background: none; text-align: left; font-size: 14px; cursor: pointer; }
.sale-row-link:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; border-radius: 4px; }
.sale-when { color: var(--hf-muted); white-space: nowrap; }
.sale-total { font-weight: 600; color: var(--hf-heading); }
.sale-debt { color: var(--hf-warning); font-weight: 600; }
.sale-card { position: relative; min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.sale-card-head { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.sale-card-head .sale-row-link { flex: 1; min-width: 0; padding-top: 2px; font-size: 15px; line-height: 1.4; }
.sale-card .hf-row-secondary { padding-right: 8px; }
.sale-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.sale-card-debt { margin-top: 10px; color: var(--hf-warning); font-size: 13px; font-weight: 600; }
.sale-card-footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--hf-border); color: var(--hf-muted); font-size: 13px; }
.sale-card-footer .sale-total { color: var(--hf-heading); font-size: 14px; }
:deep(td[data-slot='td']) { height: 64px; padding-block: 10px; vertical-align: middle; }
</style>
