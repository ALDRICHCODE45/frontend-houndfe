<script setup lang="ts">
/**
 * ExpiringDocumentsView — WU-A (REQ-1..REQ-9 migration to useServerTable)
 *
 * Tenant-wide dashboard showing all EmployeeDocument records expiring soon.
 *
 * Layout:
 *   - Page header (AdminPageHeader) with the expiry-window selector moved to
 *     the table's `#filters` slot (REQ-7).
 *   - Shared AppDataTable: document, category badge, server-resolved employee
 *     (avatar + fullName), localized expiry date, days-remaining badge — with
 *     toolbar search (≥2 chars), server-side sorting via SortableHeader,
 *     column visibility (4 hideable, `documento` anchor), loading / error /
 *     empty states, and server-side pagination.
 *
 * Data notes:
 *   - The endpoint is SERVER-paginated/searchable/sortable. `useExpiringDocuments`
 *     composes the shared useServerTable (untouched); this view is a thin
 *     composition surface over its returned state.
 *   - The backend resolves fullName/employeeNumber per row — no secondary
 *     listForPicker name-resolution query (drops the >100-cap limitation).
 *   - Error precedence: response.data.message (string|array[0]) → error.message
 *     → "No se pudieron cargar los documentos. Intenta de nuevo."
 *
 * Permission gate: read:EmployeeDocument (enforced at route level AND composable).
 *
 * Backend constraint (§4.4):
 *   GET /admin/employees-documents/expiring?daysUntilExpiry=N (server-paginated)
 *   Route uses HYPHEN — NOT under /:employeeId.
 *   NEVER send tenantId.
 *
 * Design: warm orange primary, Nuxt UI 4 components + shared AppDataTable.
 */

import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable, FilterSectionCard, SortableHeader, createSimpleHeader } from '@/core/shared/components/DataTable'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import { useExpiringDocuments } from '../composables/useExpiringDocuments'
import type { ExpiringDocumentTableRow } from '../composables/useExpiringDocuments'
import { EMPLOYEE_DOCUMENT_CATEGORY } from '../constants/employee.constants'
import { DOCUMENT_CATEGORY_LABELS } from '../interfaces/employee.types'

// ─── Expiry-window selector (look-ahead threshold — NOT page size) ─────────────

const thresholdOptions: { label: string; value: 30 | 60 | 90 }[] = [
  { label: '30 días', value: 30 },
  { label: '60 días', value: 60 },
  { label: '90 días', value: 90 },
]

// ─── Table state (composable = useServerTable closure composition) ─────────────

const {
  selectedThreshold,
  documents,
  pagination,
  sorting,
  globalFilter,
  columnVisibility,
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
} = useExpiringDocuments()

const emptyMessage = computed(
  () => `No hay documentos que venzan en los próximos ${selectedThreshold.value} días`,
)

// ─── Error message — backendMessage > error.message > Spanish fallback (REQ-5)

const documentsErrorMessage = computed(() => {
  const err = error.value as
    | { response?: { data?: { message?: unknown } }; message?: string }
    | null
    | undefined
  const backendMessage = err?.response?.data?.message
  if (typeof backendMessage === 'string' && backendMessage.trim()) {
    return backendMessage
  }
  if (Array.isArray(backendMessage) && backendMessage.length > 0) {
    const first = backendMessage[0]
    if (typeof first === 'string') return first
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message
  }
  return 'No se pudieron cargar los documentos. Intenta de nuevo.'
})

// ─── Columns (REQ-2/REQ-4) ─────────────────────────────────────────────────────

const columns = computed<TableColumn<ExpiringDocumentTableRow>[]>(() => [
  { id: 'documento', header: createSimpleHeader('Documento'), enableSorting: false, enableHiding: false },
  { id: 'categoria', header: createSimpleHeader('Categoría'), enableSorting: true, enableHiding: true },
  { id: 'colaborador', header: createSimpleHeader('Colaborador'), enableSorting: true, enableHiding: true },
  { id: 'vencimiento', header: createSimpleHeader('Fecha de vencimiento'), enableSorting: true, enableHiding: true },
  { id: 'restante', header: createSimpleHeader('Tiempo restante'), enableSorting: true, enableHiding: true },
])

// ─── Category badge color ──────────────────────────────────────────────────────

function getCategoryColor(
  category: string,
): 'primary' | 'warning' | 'error' | 'neutral' | 'success' {
  switch (category) {
    case EMPLOYEE_DOCUMENT_CATEGORY.CONTRACT:
    case EMPLOYEE_DOCUMENT_CATEGORY.NDA:
      return 'primary'
    case EMPLOYEE_DOCUMENT_CATEGORY.MEDICAL:
    case EMPLOYEE_DOCUMENT_CATEGORY.WARNING:
      return 'error'
    case EMPLOYEE_DOCUMENT_CATEGORY.EVALUATION:
    case EMPLOYEE_DOCUMENT_CATEGORY.CERTIFICATE:
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
    <UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
      <template #header>
        <AdminPageHeader
          title="Documentos por vencer"
          description="Documentos del personal próximos a su fecha de vencimiento"
        />
      </template>

      <div class="px-6 py-5">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-visibility="columnVisibility"
          :columns="columns"
          :data="documents"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="documentsErrorMessage"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :show-toolbar="true"
          :active-filter-count="selectedThreshold !== 30 ? 1 : 0"
          enable-column-visibility
          :empty="emptyMessage"
          @refresh="refresh"
          @clear-filters="selectedThreshold = 30"
        >
          <!-- Expiry-window selector (REQ-7 — lives in #filters, not the header).
               polish-filters-bottom-sheet: FilterSectionCard owns the card
               chrome + "Vencimiento" title so the mobile sheet renders the
               slot directly (no vnode capture). -->
          <template #filters>
            <FilterSectionCard title="Vencimiento">
              <div class="flex shrink-0 items-center gap-2" data-testid="expiring-threshold-filters">
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
            </FilterSectionCard>
          </template>

          <!-- Sortable headers (REQ-2) -->
          <template #vencimiento-header="{ column }">
            <SortableHeader :column="column" label="Fecha de vencimiento" />
          </template>
          <template #restante-header="{ column }">
            <SortableHeader :column="column" label="Tiempo restante" />
          </template>
          <template #categoria-header="{ column }">
            <SortableHeader :column="column" label="Categoría" />
          </template>
          <template #colaborador-header="{ column }">
            <SortableHeader :column="column" label="Colaborador" />
          </template>

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

          <!-- Employee — server-resolved fullName + avatar (REQ-8) -->
          <template #colaborador-cell="{ row }">
            <div class="flex items-center gap-2">
              <EntityAvatar
                :name="row.original.fullName"
                :seed="row.original.employeeId"
                size="sm"
              />
              <span class="truncate text-sm font-medium text-default">
                {{ row.original.fullName }}
              </span>
            </div>
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
