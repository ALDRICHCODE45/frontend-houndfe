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

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable } from '@/core/shared/components/DataTable'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { QUOTATION_STATUS } from '../constants/quotation.constants'
import type { QuotationStatus } from '../interfaces/quotation.types'
import { isExpired, statusToTone, statusToLabel } from '../utils/quotation.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { useQuotationsList, type QuotationStatusFilter } from '../composables/useQuotationsList'
import type { QuotationResponseDto } from '../interfaces/quotation.types'
import QuotationsSearchInput from '../components/QuotationsSearchInput.vue'

// ─── State wiring ─────────────────────────────────────────────────────────────

const router = useRouter()
const authStore = useAuthStore()
const canCreate = computed(() => authStore.userCan('create', 'Quotation'))

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
]

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
  <section class="quotations-list-view flex flex-col gap-4" data-testid="quotations-list-view">
    <!-- Header -->
    <header
      class="flex flex-col gap-3 border-b border-default px-1 pb-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted">Cotizaciones</h1>
        <p class="mt-1 text-sm text-muted">
          Listado de cotizaciones por cliente, con filtros por estado y búsqueda.
        </p>
      </div>

      <div v-if="canCreate" class="flex items-center gap-2">
        <UButton
          data-testid="new-quotation-button"
          icon="i-lucide-plus"
          color="primary"
          size="sm"
          class="shadow-sm"
          @click="goToCreate"
        >
          Nueva cotización
        </UButton>
      </div>
    </header>

    <!-- Filters: status tabs + search input -->
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
    </AppDataTable>
  </section>
</template>
