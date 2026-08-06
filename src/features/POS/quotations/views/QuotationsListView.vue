<script setup lang="ts">
/**
 * QuotationsListView — S3 / REQ-QTN-002.
 *
 * Paginated list of quotations exposed at GET /quotations, behind the
 * `read:Quotation` route guard. The composition surface wires
 * `useQuotationsList` to:
 *
 *   - Status tabs (Todos / Borradores / Enviadas / Expiradas / Canceladas)
 *   - Debounced search input
 *   - `AppDataTable` with truncated UUID, customer, status badge, total,
 *     expiry, and creation date columns
 *   - Pagination driven by the table's `update:pagination` event
 *   - "Nueva cotización" CTA gated by `create:Quotation` CASL permission
 *   - Row navigation (cliente cell) → `/pos/cotizaciones/:id`
 *   - Empty / error / loading / fetching states via AppDataTable props
 *
 * Loading/empty/error states are handled by AppDataTable itself (REQ-QTN-016)
 * — this view just forwards `isLoading` / `isFetching` / `isError` / `data`
 * to the table props. The view still owns the dedicated "Nueva cotización"
 * button placement in the header.
 */
import '../styles/coco-tokens.css'

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable } from '@/core/shared/components/DataTable'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { QUOTATION_STATUS } from '../constants/quotation.constants'
import type { QuotationStatus } from '../interfaces/quotation.types'
import { isExpired, statusToTone, statusToLabel } from '../utils/quotation.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { useQuotationsList, type QuotationStatusFilter } from '../composables/useQuotationsList'
import type { QuotationResponseDto } from '../interfaces/quotation.types'
import { quotationApi } from '../api/quotation.api'
import { quotationQueryKeys } from '@/core/shared/constants/query-keys'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import QuotationsSearchInput from '../components/QuotationsSearchInput.vue'

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

const {
  status,
  search,
  page,
  limit,
  quotations,
  total,
  totalPages,
  isLoading,
  isFetching,
  isError,
  error,
  setStatus,
  setSearch,
  setPage,
  setLimit,
  refresh,
} = useQuotationsList({ defaultLimit: 10, debounceMs: 300 })

// ─── Status tabs definition ───────────────────────────────────────────────────

interface StatusTab {
  label: string
  value: QuotationStatusFilter
}

const STATUS_TABS: StatusTab[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Borradores', value: QUOTATION_STATUS.DRAFT },
  { label: 'Enviadas', value: QUOTATION_STATUS.SENT },
  { label: 'Expiradas', value: QUOTATION_STATUS.EXPIRED },
  { label: 'Canceladas', value: QUOTATION_STATUS.CANCELLED },
]

function onStatusTabClick(value: QuotationStatusFilter): void {
  setStatus(value)
}

// ─── Search wiring ───────────────────────────────────────────────────────────

function onSearchInput(value: string): void {
  setSearch(value)
}

// ─── Pagination wiring (AppDataTable → composable) ────────────────────────────
//
// The table emits 0-indexed pageIndex and uses pageSize. The composable + the
// backend use 1-indexed page and `limit`. Symmetric with EmployeesListView
// (see EmployeesListView.vue:318-330).
//
// Order matters: when the size changes, the composable resets page to 1. If
// we called setPage first with the NEW pageIndex (already 0-indexed against
// the OLD pageSize), the page-1 reset from setLimit would clobber it and the
// user would appear stuck on page 1 when navigating forward. So we detect
// "size changed" first and only call setPage when the index actually changed.

const pagination = computed({
  get: () => ({ pageIndex: page.value - 1, pageSize: limit.value }),
  set: (val: { pageIndex: number; pageSize: number }) => {
    const nextSize = val.pageSize
    const nextPage = val.pageIndex + 1
    if (nextSize !== limit.value) {
      setLimit(nextSize)
    }
    if (nextPage !== page.value) {
      setPage(nextPage)
    }
  },
})

// ─── Navigation ───────────────────────────────────────────────────────────────

function goToCreate(): void {
  void router.push('/pos/cotizaciones/nueva')
}

function goToDetail(quotation: QuotationResponseDto): void {
  void router.push(`/pos/cotizaciones/${quotation.id}`)
}

// ─── Delete flow (REQ-QTN-013 / backend §3.16) ──────────────────────────────
// DELETE /quotations/:id is restricted to DRAFT or CANCELLED quotations
// (409 QUOTATION_CANNOT_DELETE otherwise). The CASL `delete:Quotation`
// gate runs in the dropdown builder below; the backend's status guard is
// defense-in-depth for stale list caches.

const queryClient = useQueryClient()
const tenantId = computed(() => authStore.currentTenantId)

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

// ── S8: lazy EXPIRED detection (REQ-QTN-008 / backend §7.4) ────────────────
// The backend flips SENT → EXPIRED on the next read, not on a cron. Until
// the cache catches up, a SENT row whose `expiresAt` is in the past should
// display as EXPIRED here too — otherwise the cashier would have to refresh
// the page to find out. DRAFT never lazy-expires.
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
// Two-group layout mirrors PromotionsView/CustomersView: the first group
// holds navigation, the second holds the destructive delete (red) when
// the row's status is one the backend will accept (DRAFT, CANCELLED).
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

// ─── Pagination display helpers ──────────────────────────────────────────────

const showingFrom = computed(() => {
  if (total.value === 0) return 0
  return (page.value - 1) * limit.value + 1
})

const showingTo = computed(() => {
  if (total.value === 0) return 0
  return Math.min(page.value * limit.value, total.value)
})

// ─── Error message ───────────────────────────────────────────────────────────

const errorMessage = computed(() => {
  const err = error.value as { response?: { data?: { message?: string } }; message?: string } | null
  if (!err) return 'No se pudieron cargar las cotizaciones. Reintenta.'
  return err.response?.data?.message ?? err.message ?? 'No se pudieron cargar las cotizaciones. Reintenta.'
})

// Re-export UButton via the auto-import registry — Nuxt UI components are
// resolved at template-compile time. No explicit resolveComponent needed.
</script>

<template>
  <!-- T-UI-26 / REQ-UI-011 — align with system table patterns: a
       rounded-2xl shadow-sm card wrapper that holds the entire surface
       (EmployeesListView pattern). The `.quotations-list-view` class
       stays on the root so the `@layer coco-quotations` token scope
       still resolves `--coco-primary` for everything inside. -->
  <section
    class="quotations-list-view overflow-hidden rounded-2xl border border-default bg-default shadow-sm"
    data-testid="quotations-list-view"
  >
    <!-- Header -->
    <header
      class="flex flex-col gap-3 border-b border-default px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted">Cotizaciones</h1>
        <p class="mt-1 text-sm text-muted">
          Listado de cotizaciones por cliente, con filtros por estado y búsqueda.
        </p>
      </div>

      <div v-if="canCreate" class="flex items-center gap-2">
        <!-- REQ-UI-001 / REQ-UI-011: the CTA MUST consume the Coco
             primary token via a Tailwind arbitrary value. Nuxt UI's
             `color="primary"` resolves to the project brand primary
             (#2442f6); we override with `bg-[var(--coco-primary)]`
             (#2557D6) so the visual matches the spec. -->
        <UButton
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
    </header>

    <!-- Filters: status tabs + search input -->
    <div class="flex flex-col gap-3 border-b border-default px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div
        class="flex flex-wrap items-center gap-1"
        data-testid="status-tabs"
        role="tablist"
        aria-label="Filtrar cotizaciones por estado"
      >
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="status === tab.value"
          :aria-current="status === tab.value ? 'page' : undefined"
          class="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
          :class="
            status === tab.value
              ? 'border border-default bg-elevated text-highlighted shadow-sm'
              : 'text-muted hover:bg-elevated/60 hover:text-default'
          "
          @click="onStatusTabClick(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <QuotationsSearchInput
        :model-value="search"
        :loading="isFetching"
        placeholder="Buscar por cliente…"
        @update:model-value="onSearchInput"
      />
    </div>

    <!-- Table -->
    <div class="px-5 py-4">
      <AppDataTable
        v-model:pagination="pagination"
        :columns="columns"
        :data="quotations"
        :loading="isLoading"
        :fetching="isFetching"
        :error="isError"
        :error-message="errorMessage"
        :page-count="totalPages"
        :total-count="total"
        :showing-from="showingFrom"
        :showing-to="showingTo"
        :page-size-options="[10, 20, 50]"
        :show-toolbar="false"
        :show-add-button="false"
        :show-refresh="false"
        empty="No hay cotizaciones"
        @refresh="refresh"
      >
        <!-- ID cell: truncated UUID rendered as a monospace token -->
        <template #id-cell="{ row }">
          <span class="font-mono text-xs text-muted">{{ truncatedId(row.original.id) }}</span>
        </template>

        <!-- Cliente cell: full name or "Sin cliente"; clickable → detail -->
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

        <!-- Estado cell: StatusDotBadge with QUOTATION_STATUS_TONE.
             S8: status is resolved through `effectiveStatus()` so a SENT row
             whose cached expiresAt is past flips to EXPIRED locally — see
             the comment above the helper for the rationale. -->
        <template #estado-cell="{ row }">
          <StatusDotBadge
            :tone="rowStatusTone(row.original)"
            :label="rowStatusLabel(row.original)"
            compact
          />
        </template>

        <!-- Total cell: formatCentsMXN -->
        <template #total-cell="{ row }">
          <span class="font-medium text-default">{{ formatCentsMXN(row.original.totalCents) }}</span>
        </template>

        <!-- Expira cell: formatted date or em-dash -->
        <template #expira-cell="{ row }">
          <span class="text-sm text-muted">{{ formatExpiryDate(row.original.expiresAt) }}</span>
        </template>

        <!-- Fecha cell: createdAt formatted -->
        <template #fecha-cell="{ row }">
          <span class="text-sm text-muted">{{ formatCreatedAt(row.original.createdAt) }}</span>
        </template>

        <!-- Actions cell: dropdown with view + delete (CASL + status-gated) -->
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

    <!-- REQ-QTN-013 — Delete confirmation. State holds the selected id +
         folio so the description can reference the truncated UUID the
         cashier sees in the table. Mutating the open flag inside
         `update:open` keeps the modal wired to the same confirm-state
         ref that the dropdown's `Eliminar` action populates. -->
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
  </section>
</template>
