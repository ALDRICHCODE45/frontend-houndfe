<script setup lang="ts">
/**
 * ExpiringDocumentsView — WU-12B
 *
 * Tenant-wide dashboard showing all EmployeeDocument records expiring soon.
 *
 * Layout:
 *   - Page header with an expiry-window selector (next 30 / 60 / 90 days)
 *   - Shared AppDataTable: document, category badge, resolved employee (avatar +
 *     name), localized expiry date, days-remaining badge — with loading / error /
 *     empty states, sticky header, mobile cards, and built-in pagination.
 *
 * Data notes:
 *   - The endpoint returns the FULL server-sorted array (NOT paginated), so rows
 *     are sliced client-side via paginateRows.
 *   - It returns employeeId (UUID) only. A single cached listForPicker('') query
 *     resolves id → name. KNOWN LIMIT: listForPicker caps at pageSize 100 active
 *     employees, so a document owned by an employee beyond the first 100 active
 *     resolves to "—".
 *
 * Permission gate: read:EmployeeDocument (enforced at route level AND composable).
 *
 * Backend constraint (§4.4):
 *   GET /admin/employees-documents/expiring?daysUntilExpiry=N
 *   Route uses HYPHEN — NOT under /:employeeId.
 *   Default: 30 days. Returns array sorted by expiresAt asc.
 *   NEVER send tenantId.
 *
 * Design: warm orange primary, Nuxt UI 4 components + shared AppDataTable.
 */

import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable, createSimpleHeader } from '@/core/shared/components/DataTable'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { DEFAULT_TABLE_PAGE_SIZE } from '@/core/shared/utils/pagination.utils'
import { employeesApi } from '../api/employees.api'
import {
  useExpiringDocuments,
  computeExpiringDocumentRow,
  paginateRows,
} from '../composables/useExpiringDocuments'
import type { ExpiringDocumentRow } from '../composables/useExpiringDocuments'
import { buildManagerMap, resolveManagerName } from '../composables/useManagerResolution'
import { DOCUMENT_CATEGORY_LABELS } from '../interfaces/employee.types'

// ─── Expiry-window selector (look-ahead threshold — NOT page size) ─────────────

type ThresholdDays = 30 | 60 | 90

const thresholdOptions: { label: string; value: ThresholdDays }[] = [
  { label: '30 días', value: 30 },
  { label: '60 días', value: 60 },
  { label: '90 días', value: 90 },
]

const selectedThreshold = ref<ThresholdDays>(30)

// ─── Auth / tenant ──────────────────────────────────────────────────────────────

const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

// ─── Query: expiring documents (server-sorted, full array — NOT paginated) ─────

const { data: expiringDocs, isLoading, isError, isFetching, refetch } =
  useExpiringDocuments(computed(() => selectedThreshold.value))

// ─── Employee name resolution (one cached list of active employees) ────────────
// The endpoint returns employeeId (UUID) only. Fetch the active-employee list
// once and build an id→name map. Shares the manager-picker cache key so the
// request is deduped app-wide. KNOWN LIMIT: listForPicker caps at pageSize 100 →
// documents owned by an employee beyond the first 100 active resolve to "—".
const { data: pickerEmployees } = useQuery({
  queryKey: computed(() => employeeQueryKeys.activeForPicker(tenantId.value, '')),
  queryFn: () => employeesApi.listForPicker(''),
  enabled: computed(() => !!tenantId.value),
  staleTime: 60_000,
})

const employeeMap = computed(() => buildManagerMap(pickerEmployees.value ?? []))

/** Resolve an employeeId to a display name; "—" on miss (unresolved / >100 cap). */
function getEmployeeName(employeeId: string): string {
  return resolveManagerName(employeeId, employeeMap.value)
}

// ─── Rows + client-side pagination ─────────────────────────────────────────────

const allRows = computed<ExpiringDocumentRow[]>(() =>
  (expiringDocs.value ?? []).map((doc) => computeExpiringDocumentRow(doc)),
)

const page = ref(1)
const pageSize = ref(DEFAULT_TABLE_PAGE_SIZE)

const paged = computed(() => paginateRows(allRows.value, page.value, pageSize.value))

// Reset to the first page whenever the window changes (result set changes).
watch(selectedThreshold, () => {
  page.value = 1
})

// Bridge AppDataTable's 0-based PaginationState with our 1-based page ref.
const pagination = computed({
  get: () => ({ pageIndex: page.value - 1, pageSize: pageSize.value }),
  set: (val: { pageIndex: number; pageSize: number }) => {
    if (val.pageSize !== pageSize.value) {
      pageSize.value = val.pageSize
      page.value = 1
    } else {
      page.value = val.pageIndex + 1
    }
  },
})

const showingFrom = computed(() =>
  paged.value.total === 0 ? 0 : (page.value - 1) * pageSize.value + 1,
)
const showingTo = computed(() =>
  Math.min(page.value * pageSize.value, paged.value.total),
)

const emptyMessage = computed(
  () => `No hay documentos que venzan en los próximos ${selectedThreshold.value} días`,
)

// ─── Columns ─────────────────────────────────────────────────────────────────────

const columns = computed<TableColumn<ExpiringDocumentRow>[]>(() => [
  { id: 'documento', header: createSimpleHeader('Documento'), enableSorting: false },
  { id: 'categoria', header: createSimpleHeader('Categoría'), enableSorting: false },
  { id: 'colaborador', header: createSimpleHeader('Colaborador'), enableSorting: false },
  { id: 'vencimiento', header: createSimpleHeader('Fecha de vencimiento'), enableSorting: false },
  { id: 'restante', header: createSimpleHeader('Tiempo restante'), enableSorting: false },
])

// ─── Category badge color ──────────────────────────────────────────────────────

function getCategoryColor(
  category: string,
): 'primary' | 'warning' | 'error' | 'neutral' | 'success' {
  switch (category) {
    case 'CONTRACT':
    case 'NDA':
      return 'primary'
    case 'MEDICAL':
    case 'WARNING':
      return 'error'
    case 'EVALUATION':
    case 'CERTIFICATE':
      return 'success'
    default:
      return 'neutral'
  }
}

// ─── Days-remaining badge color ────────────────────────────────────────────────

function getDaysRemainingColor(days: number): 'error' | 'warning' | 'neutral' {
  if (days <= 7) return 'error'
  if (days <= 30) return 'warning'
  return 'neutral'
}

// ─── Category label ────────────────────────────────────────────────────────────

function getCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORY_LABELS[category as keyof typeof DOCUMENT_CATEGORY_LABELS] ?? category
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <AdminPageHeader
            title="Documentos por vencer"
            description="Documentos del personal próximos a su fecha de vencimiento"
          />

          <!-- Expiry-window selector (look-ahead threshold — NOT page size) -->
          <div class="flex shrink-0 items-center gap-2">
            <span class="text-sm text-muted">Vencen en los próximos:</span>
            <USelect
              v-model="selectedThreshold"
              :items="thresholdOptions"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-32"
              aria-label="Ventana de vencimiento"
            />
          </div>
        </div>
      </template>

      <div class="px-6 py-5">
        <AppDataTable
          v-model:pagination="pagination"
          :columns="columns"
          :data="paged.pageRows"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :page-count="paged.pageCount"
          :total-count="paged.total"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="[10, 20, 50]"
          :show-toolbar="false"
          :empty="emptyMessage"
          error-message="No se pudo cargar los documentos. Intentá de nuevo."
          @refresh="() => refetch()"
        >
          <!-- Document title (notes or category fallback) -->
          <template #documento-cell="{ row }">
            <p class="font-medium text-highlighted">{{ row.original.title }}</p>
          </template>

          <!-- Category badge -->
          <template #categoria-cell="{ row }">
            <UBadge :color="getCategoryColor(row.original.category)" variant="subtle" size="sm">
              {{ getCategoryLabel(row.original.category) }}
            </UBadge>
          </template>

          <!-- Employee — resolved name + avatar, or "—" on miss -->
          <template #colaborador-cell="{ row }">
            <div
              v-if="getEmployeeName(row.original.employeeId) !== '—'"
              class="flex items-center gap-2"
            >
              <EntityAvatar
                :name="getEmployeeName(row.original.employeeId)"
                :seed="row.original.employeeId"
                size="sm"
              />
              <span class="truncate text-sm font-medium text-default">
                {{ getEmployeeName(row.original.employeeId) }}
              </span>
            </div>
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <!-- Expiry date — localized label -->
          <template #vencimiento-cell="{ row }">
            <span class="text-highlighted">{{ row.original.expiresAtLabel }}</span>
          </template>

          <!-- Days remaining badge -->
          <template #restante-cell="{ row }">
            <UBadge :color="getDaysRemainingColor(row.original.daysRemaining)" variant="soft" size="sm">
              {{ row.original.daysRemainingLabel }}
            </UBadge>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
