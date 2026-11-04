<script setup lang="ts">
/**
 * ExpiringDocumentsView — tenant-wide dashboard of EmployeeDocument records
 * expiring soon.
 *
 * One layout: an AppDataTable on desktop and cards on mobile. The document
 * comes first, then the time left as a StatusBadge (expiring documents are
 * pending items that need action, so they are warning; the nearest or already
 * expired ones are urgent), then who owns it and when it expires. The
 * expiry-window select (30 / 60 / 90 days) sits in the toolbar as a named
 * control. The screen only reads, so there is no ⋮ column and rows are not
 * clickable.
 *
 * Four states (S10): "Sin documentos por vencer" naming the window (good news,
 * no create action), no-match for a search, skeletons and the shared error.
 *
 * Data notes:
 *   - The endpoint is SERVER-paginated/searchable/sortable. `useExpiringDocuments`
 *     composes the shared useServerTable (untouched); this view is a thin
 *     composition surface over its returned state.
 *   - The backend resolves fullName/employeeNumber per row — no secondary
 *     listForPicker name-resolution query.
 *   - Error precedence: response.data.message (string|array[0]) → error.message
 *     → "No se pudieron cargar los documentos. Intenta de nuevo."
 *
 * Permission gate: read:EmployeeDocument (enforced at route level AND composable).
 *
 * Backend constraint (§4.4):
 *   GET /admin/employees-documents/expiring?daysUntilExpiry=N (server-paginated)
 *   Route uses HYPHEN — NOT under /:employeeId.
 *   NEVER send tenantId.
 */

import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable, SortableHeader, createSimpleHeader } from '@/core/shared/components/DataTable'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import '../styles/employees-visual.css'
import { useExpiringDocuments } from '../composables/useExpiringDocuments'
import type { ExpiringDocumentTableRow, ExpiringThreshold } from '../composables/useExpiringDocuments'
import { DOCUMENT_CATEGORY_LABELS } from '../interfaces/employee.types'
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor, resolveListErrorMessage } from '../../shared/utils/list-state.utils'

// ─── Expiry-window selector (look-ahead threshold — NOT page size) ─────────────

const thresholdItems = [
  { label: '30 días', value: '30' },
  { label: '60 días', value: '60' },
  { label: '90 días', value: '90' },
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

const thresholdModel = computed({
  get: () => String(selectedThreshold.value),
  set: (value: string) => {
    selectedThreshold.value = Number(value) as ExpiringThreshold
  },
})

// ─── Four states (S10) ─────────────────────────────────────────────────────────

const documentsErrorMessage = computed(() =>
  resolveListErrorMessage(error.value, 'No se pudieron cargar los documentos. Intenta de nuevo.'),
)

const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
// Nothing about to expire is good news, not a first-use state: it names the
// window and offers no create action (documents are uploaded per collaborator).
const emptyState = computed(() => ({
  title: 'Sin documentos por vencer',
  description: `Ninguno vence en los próximos ${selectedThreshold.value} días.`,
}))

function clearFilters(): void {
  globalFilter.value = ''
}

// ─── Columns ───────────────────────────────────────────────────────────────────

const columns = computed<TableColumn<ExpiringDocumentTableRow>[]>(() => [
  { id: 'documento', header: createSimpleHeader('Documento'), enableSorting: false, enableHiding: false },
  { id: 'restante', header: createSimpleHeader('Tiempo restante'), enableSorting: true, enableHiding: true },
  { id: 'colaborador', header: createSimpleHeader('Colaborador'), enableSorting: true, enableHiding: true },
  { id: 'vencimiento', header: createSimpleHeader('Fecha de vencimiento'), enableSorting: true, enableHiding: true },
  { id: 'categoria', header: createSimpleHeader('Categoría'), enableSorting: true, enableHiding: true },
])

// ─── Display helpers ───────────────────────────────────────────────────────────

/**
 * Time-left badge. Every row here is a pending item that needs action, so it is
 * warning; the ones due within a week (or already past) are urgent, and the
 * far ones stay neutral.
 */
function remainingBadge(row: ExpiringDocumentTableRow) {
  const { daysRemaining, daysRemainingLabel } = row
  if (daysRemaining <= 7) return { tone: 'warning' as const, label: daysRemainingLabel, urgent: true }
  if (daysRemaining <= 30) return { tone: 'warning' as const, label: daysRemainingLabel, urgent: false }
  return { tone: 'neutral' as const, label: daysRemainingLabel, urgent: false }
}

function getCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORY_LABELS[category as keyof typeof DOCUMENT_CATEGORY_LABELS] ?? category
}
</script>

<template>
  <div class="hf-theme hf-ui employees-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <h1 class="hf-page-title">Documentos por vencer</h1>
    </header>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
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
          :empty-state="emptyState"
          :filtered="searchTerm !== ''"
          :no-match-title="noMatchTitle"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :show-toolbar="true"
          :active-filter-count="selectedThreshold !== 30 ? 1 : 0"
          display-mode="auto"
          mobile-render="cards"
          search-placeholder="Buscar documento o colaborador..."
          enable-column-visibility
          empty="No hay documentos por vencer"
          class="hf-data-table"
          portal-class="hf-theme hf-ui employees-list-portal"
          pagination-portal-class="hf-theme hf-ui employees-list-portal"
          @refresh="refresh"
          @clear-filters="clearFilters"
        >
          <template #filters>
            <ToolbarSelectFilter
              v-model="thresholdModel"
              :items="thresholdItems"
              label="Vencimiento"
              portal-class="hf-theme hf-ui employees-list-portal"
              test-id="expiring-threshold-filter"
            />
          </template>

          <!-- Sortable headers -->
          <template #restante-header="{ column }">
            <SortableHeader :column="column" label="Tiempo restante" />
          </template>
          <template #colaborador-header="{ column }">
            <SortableHeader :column="column" label="Colaborador" />
          </template>
          <template #vencimiento-header="{ column }">
            <SortableHeader :column="column" label="Fecha de vencimiento" />
          </template>
          <template #categoria-header="{ column }">
            <SortableHeader :column="column" label="Categoría" />
          </template>

          <!-- Document title (notes or category fallback) -->
          <template #documento-cell="{ row }">
            <div class="min-w-0">
              <span class="hf-row-primary">{{ row.original.title }}</span>
              <span class="hf-row-secondary">{{ getCategoryLabel(row.original.category) }}</span>
            </div>
          </template>

          <!-- Time left -->
          <template #restante-cell="{ row }">
            <StatusBadge
              v-bind="remainingBadge(row.original)"
              aria-prefix="Vencimiento:"
            />
          </template>

          <!-- Employee — server-resolved fullName + neutral avatar -->
          <template #colaborador-cell="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <EntityAvatar
                :name="row.original.fullName"
                :seed="row.original.employeeId"
                size="sm"
                aria-hidden="true"
              />
              <span class="truncate text-sm">{{ row.original.fullName }}</span>
            </div>
          </template>

          <!-- Expiry date — localized, short -->
          <template #vencimiento-cell="{ row }">
            <span class="text-sm text-muted">{{ row.original.expiresAtLabel }}</span>
          </template>

          <!-- Category — plain text: a category, not a status -->
          <template #categoria-cell="{ row }">
            <span class="text-sm">{{ getCategoryLabel(row.original.category) }}</span>
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.title"
              :actions="[]"
              test-id="expiring-document-card"
            >
              <template #secondary>{{ row.fullName }}</template>
              <template #badges>
                <StatusBadge v-bind="remainingBadge(row)" aria-prefix="Vencimiento:" />
              </template>
              <template #footer>
                <span class="min-w-0 truncate font-medium">{{ getCategoryLabel(row.category) }}</span>
                <span class="shrink-0">{{ row.expiresAtLabel }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
