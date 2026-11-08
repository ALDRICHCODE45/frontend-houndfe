<script setup lang="ts">
/**
 * QuotationsListView — the quotations list on the shared table pattern.
 *
 * Desktop: AppDataTable (customer, status, total, expiry, created, ⋮) with a
 * whole-row open; mobile (< 768px): cards through `#mobile-card`. Status tabs,
 * the filters slideover and URL persistence keep their behavior. Empty, no
 * match, loading and error come from AppDataTable's shared states.
 *
 * Columns are sortable ONLY for totalCents, expiresAt, createdAt — the fields
 * the backend accepts as `sortBy`; `customer` keeps its accessorFn for display
 * but is NOT sortable (sorting it would 400).
 */

import '../styles/quotations-list-visual.css'

import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable } from '@/core/shared/components/DataTable'
import SortableHeader from '@/core/shared/components/DataTable/SortableHeader.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import {
  DataTableFilters,
  useDataTableFilters,
  useFiltersUrlAdapter,
} from '@/core/shared/data-table-filters'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'
import { QUOTATION_STATUS } from '../constants/quotation.constants'
import type { QuotationStatus, QuotationResponseDto } from '../interfaces/quotation.types'
import { isExpired, statusToTone, statusToLabel } from '../utils/quotation.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { useQuotationsListTable } from '../composables/useQuotationsListTable'
import { quotationApi } from '../api/quotation.api'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import { createQuotationFiltersSchema } from '../config/quotationFiltersSchema'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

// ─── State wiring ─────────────────────────────────────────────────────────────

const router = useRouter()
const authStore = useAuthStore()
const canCreate = computed(() => authStore.userCan('create', 'Quotation'))
const canDelete = computed(() => authStore.userCan('delete', 'Quotation'))
const tenantId = computed(() => authStore.currentTenantId || 'default')

// Mobile detection — below md, DataTableFilters runs embedded inside the
// wrapper's bottom-sheet (single "Filtros" tap → one sheet). At md+ it runs
// standalone so its own "Filtros" trigger + lateral slideover return to the
// desktop toolbar (the embedded card sections must NEVER leak into desktop).
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

// ─── Customer options (loaded once for the slideover) ─────────────────────────

const customersQuery = useQuery({
  queryKey: computed(() => customerQueryKeys.paginated(tenantId.value)),
  queryFn: () => customerApi.getPaginated({ pageIndex: 0, pageSize: 100, sorting: [], globalFilter: '' }),
  staleTime: 30_000,
})

const customerOptions = computed(() =>
  (customersQuery.data.value?.data ?? []).map((customer) => ({
    value: customer.id,
    label: customer.fullName || `${customer.firstName} ${customer.lastName ?? ''}`.trim(),
  })),
)

const quotationFiltersSchema = computed(() => createQuotationFiltersSchema({
  customerOptions: customerOptions.value,
  customerLoading: customersQuery.isLoading.value,
}))

const filtersAdapter = useFiltersUrlAdapter(quotationFiltersSchema)
const filtersCtl = useDataTableFilters(quotationFiltersSchema, filtersAdapter)
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
  columnOrder,
  columnSizing,
  density,
  resetLayout,
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
  setStatusFilter,
} = useQuotationsListTable(filtersCtl.backendParams)

// ─── Status tabs definition ───────────────────────────────────────────────────

interface StatusTab {
  label: string
  value: QuotationStatus | 'ALL'
}

const STATUS_TABS: StatusTab[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Borradores', value: QUOTATION_STATUS.DRAFT },
  { label: 'Enviadas', value: QUOTATION_STATUS.SENT },
  { label: 'Expiradas', value: QUOTATION_STATUS.EXPIRED },
  { label: 'Canceladas', value: QUOTATION_STATUS.CANCELLED },
]

/** The selected tab — the only status filter (the Filtros panel has no Estado). */
const activeStatusTab = ref<QuotationStatus | 'ALL'>('ALL')

function onStatusTabClick(value: QuotationStatus | 'ALL'): void {
  activeStatusTab.value = value
  setStatusFilter(value === 'ALL' ? undefined : value)
}

// Reset pagination to page 0 whenever the slideover filter state changes.
watch(() => filtersCtl.serializedState.value, () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

// ─── Navigation ───────────────────────────────────────────────────────────────

function goToCreate(): void {
  void router.push('/pos/cotizaciones/nueva')
}

function goToDetail(quotation: QuotationResponseDto): void {
  void router.push(`/pos/cotizaciones/${quotation.id}`)
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function customerName(quotation: QuotationResponseDto): string {
  const c = quotation.customer
  if (!c) return 'Sin cliente'
  const full = `${c.firstName} ${c.lastName ?? ''}`.trim()
  return full || 'Sin cliente'
}

function effectiveStatus(quotation: QuotationResponseDto): QuotationStatus {
  if (quotation.status === 'SENT' && isExpired(quotation)) {
    return 'EXPIRED'
  }
  return quotation.status
}

function rowStatus(quotation: QuotationResponseDto) {
  const status = effectiveStatus(quotation)
  return { tone: statusToTone(status), label: statusToLabel(status) }
}

const rowLabel = (quotation: QuotationResponseDto) => `cotización de ${customerName(quotation)}`

// ─── Delete flow (REQ-QAF-013) ────────────────────────────────────────────────

const queryClient = useQueryClient()

const confirmState = ref({
  open: false,
  id: '',
  customer: '',
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => quotationApi.deleteQuotation(id),
  onSuccess: async () => {
    confirmState.value = { open: false, id: '', customer: '' }
    useToast().add({ title: 'Cotización eliminada', color: 'success' })
    await queryClient.invalidateQueries({
      queryKey: quotationQueryKeys.list(tenantId.value),
    })
  },
  onError: (error) => {
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    const message =
      err.response?.data?.message ?? err.message ?? 'No se pudo eliminar la cotización'
    useToast().add({ title: 'Error', description: message, color: 'error' })
  },
})

function handleDelete(quotation: QuotationResponseDto): void {
  confirmState.value = {
    open: true,
    id: quotation.id,
    customer: customerName(quotation),
  }
}

function handleConfirmDelete(): void {
  const id = confirmState.value.id
  if (!id) return
  deleteMutation.mutate(id)
}

// ─── Column definitions ───────────────────────────────────────────────────────

/**
 * accessorFn for the `customer` column. Sorting by `customer` must use the
 * resolved `firstName lastName` (what the cashier sees in the UI), not the
 * raw nested object.
 */
const columns: TableColumn<QuotationResponseDto>[] = [
  {
    // Not backend-sortable (sortBy accepts only createdAt/updatedAt/
    // totalCents/expiresAt) — kept unsortable so no click can fire an
    // invalid sortBy.
    id: 'customer',
    accessorFn: customerName,
    header: 'Cliente',
    enableSorting: false,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Estado',
    enableSorting: false,
    meta: { class: { th: 'w-32' } },
  },
  {
    id: 'totalCents',
    accessorKey: 'totalCents',
    header: 'Total',
    enableSorting: true,
    meta: { class: { th: 'w-36 text-right', td: 'text-right' } },
  },
  {
    id: 'expiresAt',
    accessorKey: 'expiresAt',
    header: 'Expira',
    enableSorting: true,
    meta: { class: { th: 'w-36' } },
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Creada',
    enableSorting: true,
    meta: { class: { th: 'w-36' } },
  },
  {
    id: 'actions',
    header: 'Acciones',
    enableSorting: false,
    meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
  },
]

// ─── Row actions (⋮ menu: open first, destructive last) ───────────────────────

function actionsFor(quotation: QuotationResponseDto): RowAction[] {
  const isDeletableStatus =
    quotation.status === QUOTATION_STATUS.DRAFT ||
    quotation.status === QUOTATION_STATUS.CANCELLED

  return [
    { key: 'open', label: 'Ver detalle', icon: 'i-lucide-eye' },
    ...(canDelete.value && isDeletableStatus
      ? [{ key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true }]
      : []),
  ]
}

function onAction(key: string, quotation: QuotationResponseDto): void {
  if (key === 'open') goToDetail(quotation)
  else if (key === 'delete') handleDelete(quotation)
}

// The whole row opens the quotation: AppDataTable's `row-open` for table rows,
// `rowProps` for cards. The customer button is the tab stop, so neither row is.
const clickable = useClickableRow<QuotationResponseDto>(goToDetail, { focusable: false })

// ─── States ──────────────────────────────────────────────────────────────────

const search = computed(() => globalFilter.value.trim())

/** The list is empty because a search, a tab or a filter matched nothing. */
const filtered = computed(
  () => search.value.length > 0 || filtersCtl.activeCount.value > 0 || activeStatusTab.value !== 'ALL',
)

const noMatchTitle = computed(() =>
  search.value ? `Ningún resultado para «${search.value}»` : 'Ningún resultado',
)

const emptyState = computed(() => ({
  title: 'Aún no hay cotizaciones',
  description: 'Aquí aparecerán las cotizaciones que crees.',
  ...(canCreate.value ? { actionLabel: 'Nueva cotización', actionIcon: 'i-lucide-file-plus' } : {}),
}))

function clearAllFilters(): void {
  globalFilter.value = ''
  filtersCtl.clearAll()
  onStatusTabClick('ALL')
}

const errorMessage = 'No se pudieron cargar las cotizaciones'
</script>

<template>
  <div class="hf-theme hf-ui quotations-list-visual flex w-full min-w-0 flex-col gap-6 md:px-10">
    <div class="hf-page-header">
      <h1 class="hf-page-title">Cotizaciones</h1>
    </div>

    <UCard
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
      data-testid="quotations-list-view"
    >
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
        <div class="space-y-4">
          <div class="quotations-status-tabs flex flex-nowrap items-center gap-1 overflow-x-auto" data-testid="status-tabs" role="tablist" aria-label="Filtrar cotizaciones por estado">
            <button
              v-for="tab in STATUS_TABS"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="activeStatusTab === tab.value"
              :aria-current="activeStatusTab === tab.value ? 'page' : undefined"
              class="quotations-status-tab"
              :class="{ 'is-active': activeStatusTab === tab.value }"
              @click="onStatusTabClick(tab.value)"
            >
              {{ tab.label }}
            </button>
          </div>

          <AppDataTable
            v-model:sorting="sorting"
            v-model:pagination="pagination"
            v-model:global-filter="globalFilter"
            v-model:column-pinning="columnPinning"
            v-model:column-visibility="columnVisibility"
            v-model:column-order="columnOrder"
            v-model:column-sizing="columnSizing"
            v-model:density="density"
            v-model:row-selection="rowSelection"
            :persist-layout="true"
            :columns="columns"
            :data="data"
            :loading="isLoading"
            :fetching="isFetching"
            :error="isError"
            :error-message="errorMessage"
            :page-count="pageCount"
            :total-count="totalCount"
            :showing-from="showingFrom"
            :showing-to="showingTo"
            :page-size-options="pageSizeOptions"
            :enable-row-selection="false"
            :row-open="goToDetail"
            :empty-state="emptyState"
            :filtered="filtered"
            :no-match-title="noMatchTitle"
            :active-filter-count="filtersCtl.activeCount.value"
            mobile-render="cards"
            display-mode="auto"
            class="hf-data-table"
            portal-class="hf-theme hf-ui quotations-list-portal"
            pagination-portal-class="hf-theme hf-ui quotations-list-portal"
            search-placeholder="Buscar cotizaciones…"
            empty="No hay cotizaciones"
            :show-add-button="canCreate"
            add-button-text="Nueva cotización"
            add-button-icon="i-lucide-file-plus"
            add-button-test-id="new-quotation-button"
            @refresh="refresh"
            @add="goToCreate"
            @empty-action="goToCreate"
            @clear-filters="clearAllFilters"
            @reset-columns="resetLayout"
          >
            <!-- Embedded below md: the wrapper's bottom sheet owns the trigger,
                 header and footer, so users see ONE "Filtros" tap → ONE sheet. -->
            <template #filters>
              <DataTableFilters
                v-model:state="filtersState"
                :schema="quotationFiltersSchema"
                :embedded="isMobile"
                portal-class="hf-theme hf-ui quotations-list-portal"
              />
            </template>

            <!-- Sortable headers only for the columns the backend accepts as sortBy. -->
            <template #totalCents-header="{ column }">
              <SortableHeader :column="column" label="Total" />
            </template>
            <template #expiresAt-header="{ column }">
              <SortableHeader :column="column" label="Expira" />
            </template>
            <template #createdAt-header="{ column }">
              <SortableHeader :column="column" label="Creada" />
            </template>
            <template #actions-header><span class="sr-only">Acciones</span></template>

            <template #customer-cell="{ row }">
              <button
                type="button"
                class="hf-row-primary quotation-row-link"
                :data-testid="`quotation-link-${row.original.id}`"
                @click="goToDetail(row.original)"
              >{{ customerName(row.original) }}</button>
            </template>

            <template #status-cell="{ row }">
              <StatusBadge v-bind="rowStatus(row.original)" />
            </template>

            <template #totalCents-cell="{ row }">
              <span class="hf-figure quotations-total-value">{{ formatCentsMXN(row.original.totalCents) }}</span>
            </template>

            <template #expiresAt-cell="{ row }">
              <span class="quotation-when">{{ formatShortDateTime(row.original.expiresAt) }}</span>
            </template>

            <template #createdAt-cell="{ row }">
              <span class="quotation-when">{{ formatShortDateTime(row.original.createdAt) }}</span>
            </template>

            <template #actions-cell="{ row }">
              <RowActionsMenu
                :actions="actionsFor(row.original)"
                :row-label="rowLabel(row.original)"
                portal-class="quotations-list-portal"
                @select="onAction($event, row.original)"
              />
            </template>

            <template #mobile-card="{ row }">
              <article v-bind="clickable.rowProps(row)" class="quotation-card" data-testid="quotation-card">
                <div class="quotation-card-head">
                  <button
                    type="button"
                    class="hf-row-primary quotation-row-link"
                    :data-testid="`quotation-link-${row.id}`"
                    @click="goToDetail(row)"
                  >{{ customerName(row) }}</button>
                  <RowActionsMenu
                    :actions="actionsFor(row)"
                    :row-label="rowLabel(row)"
                    portal-class="quotations-list-portal"
                    @select="onAction($event, row)"
                  />
                </div>
                <div class="quotation-card-meta">
                  <StatusBadge v-bind="rowStatus(row)" />
                </div>
                <div class="quotation-card-footer">
                  <span class="hf-figure quotations-total-value">{{ formatCentsMXN(row.totalCents) }}</span>
                  <span>{{ formatShortDateTime(row.createdAt) }}</span>
                </div>
              </article>
            </template>
          </AppDataTable>
        </div>
      </div>

      <ConfirmModal
        :open="confirmState.open"
        title="Eliminar cotización"
        :description="`¿Eliminar la cotización de ${confirmState.customer}? Esta acción no se puede deshacer.`"
        confirm-label="Eliminar"
        confirm-color="error"
        :ui="{ content: 'hf-theme hf-ui hf-form-overlay quotations-list-portal' }"
        :loading="deleteMutation.isPending.value"
        @update:open="(val) => { if (!val) confirmState.open = false }"
        @confirm="handleConfirmDelete"
      />
    </UCard>
  </div>
</template>

<style scoped>
.quotations-status-tabs { scrollbar-width: none; }
.quotations-status-tabs::-webkit-scrollbar { display: none; }
@media (max-width: 767px) {
  .quotations-status-tabs { mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent); }
}
.quotations-status-tab { flex: none; white-space: nowrap; border: 1px solid transparent; border-radius: var(--hf-radius-control); padding: 8px 14px; color: var(--hf-muted); font-size: 14px; font-weight: 500; transition: background-color 150ms, color 150ms; }
.quotations-status-tab:hover { background: var(--hf-surface-muted); color: var(--hf-heading); }
.quotations-status-tab.is-active { border-color: var(--hf-border); background: var(--hf-surface-muted); color: var(--hf-heading); font-weight: 600; }
.quotation-row-link { padding: 0; border: 0; background: none; text-align: left; font-size: 14px; cursor: pointer; }
.quotation-when { color: var(--hf-muted); font-size: 13px; white-space: nowrap; }
.quotation-card { position: relative; min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.quotation-card-head { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.quotation-card-head .quotation-row-link { flex: 1; min-width: 0; padding-top: 2px; font-size: 15px; line-height: 1.4; white-space: normal; }
.quotation-card-head > :last-child { margin: -8px -8px 0 0; flex: none; }
.quotation-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.quotation-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--hf-border); color: var(--hf-muted); font-size: 13px; }
.quotation-card-footer .quotations-total-value { color: var(--hf-ink); }
</style>
