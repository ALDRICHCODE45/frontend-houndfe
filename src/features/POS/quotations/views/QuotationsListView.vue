<script setup lang="ts">
/**
 * QuotationsListView — REQ-QAF-009..014 / T-FE-10.
 *
 * Brings the quotations list to feature parity with the Sales list:
 *   - UCard with split body bg (REQ-QAF-009).
 *   - TableHeaderDescription in the #header slot.
 *   - Status tabs (Todos / Borradores / Enviadas / Expiradas / Canceladas).
 *   - Slideover with the 5 first-slice filters (status, customerId, createdAt,
 *     expiresAt, totalCents) + active chips (REQ-QAF-010).
 *   - AppDataTable with toolbar global search, column visibility, page-size
 *     options (REQ-QAF-011).
 *   - URL persistence via useFiltersUrlAdapter (REQ-QAF-012).
 *   - Delete flow preserved exactly (REQ-QAF-013).
 *   - The legacy `QuotationsSearchInput` is gone (REQ-QAF-016).
 *
 * After the standardize-quotations-table change the toolbar is a single
 * DataTableToolbar row assembling: search, Filtros, refresh, Columnas,
 * "Nueva cotización", and ViewToggle (in #actions). The external refresh +
 * "Nueva cotización" UButtons are gone — the buttons now live inside
 * AppDataTable's toolbar and carry the legacy `refresh-quotations-button` /
 * `new-quotation-button` testids via the new optional
 * `refreshButtonTestId` / `addButtonTestId` props (REQ-QAF-016 invariant).
 * Columns are sorted by `enableSorting: true` + SortableHeader for
 * customer, status, totalCents, expiresAt, createdAt; `customer` uses an
 * `accessorFn` that resolves `firstName lastName` so sorting matches what
 * the cashier sees.
 *
 * The token scope class `.quotations-list-view` stays on the surface root so
 * `@layer coco-quotations` keeps resolving `--coco-primary` for the CTA.
 */

import '../styles/coco-tokens.css'

import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable } from '@/core/shared/components/DataTable'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import SortableHeader from '@/core/shared/components/DataTable/SortableHeader.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import {
  DataTableFilters,
  useDataTableFilters,
  useFiltersUrlAdapter,
} from '@/core/shared/data-table-filters'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'
import { QUOTATION_STATUS } from '../constants/quotation.constants'
import type { QuotationStatus, QuotationResponseDto } from '../interfaces/quotation.types'
import { isExpired, statusToTone, statusToLabel } from '../utils/quotation.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { useQuotationsListTable } from '../composables/useQuotationsListTable'
import { useQuotationsViewMode } from '../composables/useQuotationsViewMode'
import QuotationCardGrid from '../components/QuotationCardGrid.vue'
import { quotationApi } from '../api/quotation.api'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import { createQuotationFiltersSchema } from '../config/quotationFiltersSchema'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'

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
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  error,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
  setStatusFilter,
} = useQuotationsListTable(filtersCtl.backendParams)

// ─── View mode (table ↔ cards), persisted to localStorage ────────────────────

const { viewMode, displayMode } = useQuotationsViewMode()

// ─── Status tabs definition ───────────────────────────────────────────────────

interface StatusTab {
  label: string
  value: QuotationStatus | 'ALL'
}

const STATUS_TABS: StatusTab[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Borradores', value: QUOTATION_STATUS.DRAFT },
  { label: 'Enviadas', value: QUOTATION_STATUS.SENT },
  { label: 'Expiradas', value: QUOTATION_STATUS.EXPIRED },
  { label: 'Canceladas', value: QUOTATION_STATUS.CANCELLED },
]

/**
 * Effective active status used for the tab's aria-current state.
 * The slideover status (when set) takes precedence over the tab — we
 * detect that by reading the slideover's serialized status field. When
 * the user clicks a tab, we mirror the value into the slideover's status
 * (single-element array) so the same source of truth drives both the
 * visual indication and the filter.
 */
const activeStatusTab = computed<QuotationStatus | 'ALL'>(() => {
  const slideover = filtersState.value.status
  if (Array.isArray(slideover) && slideover.length > 0) {
    return slideover[0] as QuotationStatus
  }
  if (typeof slideover === 'string' && slideover.length > 0) {
    const first = slideover.split(',')[0]?.trim()
    if (first) return first as QuotationStatus
  }
  return 'ALL'
})

function onStatusTabClick(value: QuotationStatus | 'ALL'): void {
  // Tab → set the slideover status to a single element (keeps the
  // single source of truth consistent with the composable's tab) and
  // notify the composable. REQ-QAF-010: selecting a tab "clears" the
  // slideover's prior status by overwriting it with a single value.
  if (value === 'ALL') {
    filtersCtl.clearFilter('status')
    setStatusFilter(undefined)
  } else {
    filtersState.value = { ...filtersState.value, status: [value] }
    setStatusFilter(value)
  }
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

// ─── Delete flow (REQ-QAF-013) ────────────────────────────────────────────────

const queryClient = useQueryClient()

const confirmState = ref({
  open: false,
  id: '',
  folio: '',
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => quotationApi.deleteQuotation(id),
  onSuccess: async () => {
    confirmState.value = { open: false, id: '', folio: '' }
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
    folio: quotation.id.slice(0, 8),
  }
}

function handleConfirmDelete(): void {
  const id = confirmState.value.id
  if (!id) return
  deleteMutation.mutate(id)
}

// ─── Column definitions ───────────────────────────────────────────────────────

function truncatedId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function customerName(quotation: QuotationResponseDto): string {
  const c = quotation.customer
  if (!c) return 'Sin cliente'
  const full = `${c.firstName} ${c.lastName ?? ''}`.trim()
  return full || 'Sin cliente'
}

/**
 * accessorFn for the `customer` column. Sorting by `customer` must use the
 * resolved `firstName lastName` (what the cashier sees in the UI), not the
 * raw nested object — otherwise sort order is undefined and the click feels
 * broken.
 */
function customerAccessorFn(row: QuotationResponseDto): string {
  return customerName(row)
}

function effectiveStatus(quotation: QuotationResponseDto): QuotationStatus {
  if (quotation.status === 'SENT' && isExpired(quotation)) {
    return 'EXPIRED'
  }
  return quotation.status
}

function rowStatusTone(quotation: QuotationResponseDto): ReturnType<typeof statusToTone> {
  return statusToTone(effectiveStatus(quotation))
}

function rowStatusLabel(quotation: QuotationResponseDto): string {
  return statusToLabel(effectiveStatus(quotation))
}

function formatExpiryDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

function formatCreatedAt(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(iso))
}

const columns: TableColumn<QuotationResponseDto>[] = [
  {
    id: 'id',
    accessorKey: 'id',
    header: 'ID',
    enableSorting: false,
    meta: { class: { th: 'w-28', td: 'font-mono text-xs' } },
  },
  {
    // Column id matches the backend field name so `sorting[0].id` lands on
    // the right `sortBy` without a mapping layer.
    id: 'customer',
    accessorFn: customerAccessorFn,
    header: 'Cliente',
    enableSorting: true,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Estado',
    enableSorting: true,
    meta: { class: { th: 'w-32' } },
  },
  {
    id: 'totalCents',
    accessorKey: 'totalCents',
    header: 'Total',
    enableSorting: true,
    meta: { class: { th: 'w-32 text-right', td: 'text-right tabular-nums' } },
  },
  {
    id: 'expiresAt',
    accessorKey: 'expiresAt',
    header: 'Expira',
    enableSorting: true,
    meta: { class: { th: 'w-32' } },
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Fecha',
    enableSorting: true,
    meta: { class: { th: 'w-32' } },
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    meta: { class: { th: 'w-12' } },
  },
]

// ─── Row actions (UDropdownMenu items per row) ────────────────────────────────

function getRowItems(quotation: QuotationResponseDto) {
  const navigationActions = [
    { label: 'Ver detalle', onSelect: () => goToDetail(quotation) },
  ]

  const isDeletableStatus =
    quotation.status === QUOTATION_STATUS.DRAFT ||
    quotation.status === QUOTATION_STATUS.CANCELLED

  const destructiveActions = canDelete.value && isDeletableStatus
    ? [{
        label: 'Eliminar',
        color: 'error' as const,
        onSelect: () => handleDelete(quotation),
      }]
    : []

  return [navigationActions, destructiveActions].filter((section) => section.length > 0)
}

// ─── Error message ───────────────────────────────────────────────────────────

const errorMessage = computed(() => {
  const err = error.value as { response?: { data?: { message?: string } }; message?: string } | null
  if (!err) return 'No se pudieron cargar las cotizaciones. Reintenta.'
  return err.response?.data?.message ?? err.message ?? 'No se pudieron cargar las cotizaciones. Reintenta.'
})
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-10">
    <UCard
      :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"
      class="quotations-list-view overflow-hidden rounded-2xl border border-default shadow-sm"
      data-testid="quotations-list-view"
    >
      <template #header>
        <TableHeaderDescription
          title="Cotizaciones"
          description="Listado de cotizaciones por cliente, con filtros por estado, fechas y montos."
        />
      </template>

      <div class="px-6 py-5 space-y-4">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-1" data-testid="status-tabs" role="tablist" aria-label="Filtrar cotizaciones por estado">
            <button
              v-for="tab in STATUS_TABS"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="activeStatusTab === tab.value"
              :aria-current="activeStatusTab === tab.value ? 'page' : undefined"
              class="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
              :class="
                activeStatusTab === tab.value
                  ? 'border border-default bg-elevated text-highlighted shadow-sm'
                  : 'text-muted hover:bg-elevated/60 hover:text-default'
              "
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
            v-model:row-selection="rowSelection"
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
            mobile-render="cards"
            :display-mode="displayMode"
            :enable-column-visibility="true"
            search-placeholder="Buscar cotizaciones…"
            empty="No hay cotizaciones"
            :show-add-button="canCreate"
            add-button-text="Nueva cotización"
            add-button-icon="i-lucide-file-plus"
            add-button-test-id="new-quotation-button"
            refresh-button-test-id="refresh-quotations-button"
            @refresh="refresh"
            @add="goToCreate"
            @clear-filters="filtersCtl.clearAll()"
          >
            <!-- Filtros moved inside AppDataTable's #filters slot — REQ-QAF-011.
                 Embedded mode (WU-3 / polish-filters-bottom-sheet): the
                 wrapper's USlideover owns the trigger, header and footer —
                 DataTableFilters v2 renders only its sections + chips
                 inside the unified bottom-sheet so users see ONE "Filtros"
                 tap → ONE sheet (no nested slideover-in-slideover).
                 Card sections are owned by DataTableFilters' embedded groups. -->
            <template #filters>
              <DataTableFilters
                v-model:state="filtersState"
                :schema="quotationFiltersSchema"
                :embedded="true"
              />
            </template>

            <!-- ViewToggle persisted via useQuotationsViewMode. -->
            <template #actions>
              <ViewToggle v-model="viewMode" />
            </template>

            <!-- Sortable header slots — column ids match backend field names. -->
            <template #customer-header="{ column }">
              <SortableHeader :column="column" label="Cliente" />
            </template>
            <template #status-header="{ column }">
              <SortableHeader :column="column" label="Estado" />
            </template>
            <template #totalCents-header="{ column }">
              <SortableHeader :column="column" label="Total" />
            </template>
            <template #expiresAt-header="{ column }">
              <SortableHeader :column="column" label="Expira" />
            </template>
            <template #createdAt-header="{ column }">
              <SortableHeader :column="column" label="Fecha" />
            </template>

            <template #id-cell="{ row }">
              <span class="font-mono text-xs text-muted">{{ truncatedId(row.original.id) }}</span>
            </template>

            <template #customer-cell="{ row }">
              <UButton
                variant="link"
                color="primary"
                class="!p-0 text-sm font-medium hover:underline"
                :data-testid="`quotation-link-${row.original.id}`"
                @click="goToDetail(row.original)"
              >
                {{ customerName(row.original) }}
              </UButton>
            </template>

            <template #status-cell="{ row }">
              <StatusDotBadge
                :tone="rowStatusTone(row.original)"
                :label="rowStatusLabel(row.original)"
                compact
              />
            </template>

            <template #totalCents-cell="{ row }">
              <span class="font-medium text-default">{{ formatCentsMXN(row.original.totalCents) }}</span>
            </template>

            <template #expiresAt-cell="{ row }">
              <span class="text-sm text-muted">{{ formatExpiryDate(row.original.expiresAt) }}</span>
            </template>

            <template #createdAt-cell="{ row }">
              <span class="text-sm text-muted">{{ formatCreatedAt(row.original.createdAt) }}</span>
            </template>

            <template #actions-cell="{ row }">
              <UDropdownMenu
                :items="getRowItems(row.original)"
                :content="{ align: 'end' }"
              >
                <UButton
                  icon="i-lucide-ellipsis-vertical"
                  color="neutral"
                  variant="ghost"
                  class="size-7 cursor-pointer"
                  :data-testid="`row-actions-${row.original.id}`"
                />
              </UDropdownMenu>
            </template>

            <template #cards="{ data, loading, empty }">
              <QuotationCardGrid
                :quotations="data"
                :loading="loading"
                :empty="empty"
                :can-delete="canDelete"
                @card-click="goToDetail"
                @delete="handleDelete"
              />
            </template>
          </AppDataTable>
        </div>
      </div>

      <ConfirmModal
        :open="confirmState.open"
        title="Eliminar cotización"
        :description="`¿Eliminar la cotización #${confirmState.folio}? Esta acción no se puede deshacer.`"
        confirm-label="Eliminar"
        confirm-color="error"
        :loading="deleteMutation.isPending.value"
        @update:open="(val) => { if (!val) confirmState.open = false }"
        @confirm="handleConfirmDelete"
      />
    </UCard>
  </div>
</template>
