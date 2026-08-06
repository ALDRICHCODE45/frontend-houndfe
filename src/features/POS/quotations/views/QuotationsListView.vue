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
    id: 'cliente',
    accessorKey: 'customer',
    header: 'Cliente',
    enableSorting: false,
  },
  {
    id: 'estado',
    accessorKey: 'status',
    header: 'Estado',
    enableSorting: false,
    meta: { class: { th: 'w-32' } },
  },
  {
    id: 'total',
    accessorKey: 'totalCents',
    header: 'Total',
    enableSorting: false,
    meta: { class: { th: 'w-32 text-right', td: 'text-right tabular-nums' } },
  },
  {
    id: 'expira',
    accessorKey: 'expiresAt',
    header: 'Expira',
    enableSorting: false,
    meta: { class: { th: 'w-32' } },
  },
  {
    id: 'fecha',
    accessorKey: 'createdAt',
    header: 'Fecha',
    enableSorting: false,
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
  <div class="flex flex-col gap-6 px-10">
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

          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <DataTableFilters
              v-model:state="filtersState"
              :schema="quotationFiltersSchema"
            />
            <div class="flex items-center justify-end gap-2">
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                size="sm"
                :loading="isFetching"
                aria-label="Actualizar cotizaciones"
                data-testid="refresh-quotations-button"
                @click="refresh"
              />
              <UButton
                v-if="canCreate"
                data-testid="new-quotation-button"
                icon="i-lucide-plus"
                color="primary"
                size="sm"
                class="bg-[var(--coco-primary)] text-white shadow-sm hover:brightness-110"
                @click="goToCreate"
              >
                Nueva cotización
              </UButton>
            </div>
          </div>
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
          :enable-column-visibility="true"
          :show-refresh="false"
          search-placeholder="Buscar cotizaciones…"
          empty="No hay cotizaciones"
          @refresh="refresh"
        >
          <template #id-cell="{ row }">
            <span class="font-mono text-xs text-muted">{{ truncatedId(row.original.id) }}</span>
          </template>

          <template #cliente-cell="{ row }">
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

          <template #estado-cell="{ row }">
            <StatusDotBadge
              :tone="rowStatusTone(row.original)"
              :label="rowStatusLabel(row.original)"
              compact
            />
          </template>

          <template #total-cell="{ row }">
            <span class="font-medium text-default">{{ formatCentsMXN(row.original.totalCents) }}</span>
          </template>

          <template #expira-cell="{ row }">
            <span class="text-sm text-muted">{{ formatExpiryDate(row.original.expiresAt) }}</span>
          </template>

          <template #fecha-cell="{ row }">
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
        </AppDataTable>
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
