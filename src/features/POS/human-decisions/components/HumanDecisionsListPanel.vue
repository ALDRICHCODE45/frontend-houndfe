<script setup lang="ts">
import { computed, ref } from 'vue'
import { AppDataTable } from '@/core/shared/components/DataTable'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { PaginationState, SortingState } from '@/core/shared/types/table.types'
import { useHumanDecisionColumns } from '../composables/useHumanDecisionColumns'
import type { HumanDecision, HumanDecisionListFilter } from '../interfaces/human-decision.types'
import {
  listDatePresentationLabel,
  productMetaPresentationLabel,
  requestedQuantityPresentationLabel,
  resolvedResponseLabel,
} from '../utils/humanDecisionPresentation'
import HumanDecisionCard from './HumanDecisionCard.vue'
import ResolvedHumanDecisionCard from './ResolvedHumanDecisionCard.vue'
import '../styles/human-decisions-visual.css'

const props = withDefaults(
  defineProps<{
    data: HumanDecision[]
    statusFilter?: HumanDecisionListFilter
    loading?: boolean
    fetching?: boolean
    error?: boolean
    errorMessage?: string
    pageCount?: number
    totalCount?: number
    pageSizeOptions?: number[]
    showingFrom?: number
    showingTo?: number
  }>(),
  {
    statusFilter: 'ALL',
    loading: false,
    fetching: false,
    error: false,
    errorMessage: 'No se pudieron cargar las solicitudes',
    pageCount: 0,
    totalCount: 0,
    pageSizeOptions: () => [20, 50],
    showingFrom: 0,
    showingTo: 0,
  },
)

const emit = defineEmits<{
  refresh: []
  openDetail: [selection: Pick<HumanDecision, 'id' | 'status'>]
  'update:statusFilter': [status: HumanDecisionListFilter]
}>()

function selectDecision(row: HumanDecision) {
  emit('openDetail', { id: row.id, status: row.status })
}

const statusItems: { label: string; value: HumanDecisionListFilter }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Pendientes', value: 'PENDING' },
  { label: 'Respondidas recientemente', value: 'RESOLVED' },
]

function selectStatus(status: unknown) {
  if (status === 'ALL' || status === 'PENDING' || status === 'RESOLVED') {
    emit('update:statusFilter', status)
  }
}
const pagination = defineModel<PaginationState>('pagination', {
  default: () => ({ pageIndex: 0, pageSize: 20 }),
})
const globalFilter = defineModel<string>('globalFilter', { default: '' })
const sorting = ref<SortingState>([])
const { columns } = useHumanDecisionColumns()

// ── List states ───────────────────────────────────────────────────────────────
const searchTerm = computed(() => globalFilter.value.trim())
const filtered = computed(() => searchTerm.value !== '' || props.statusFilter !== 'ALL')
const noMatchTitle = computed(() =>
  searchTerm.value ? `Ningún resultado para «${searchTerm.value}»` : 'Ningún resultado',
)
const emptyState = {
  title: 'Aún no hay solicitudes',
  description: 'Aquí aparecerán las solicitudes que necesiten tu respuesta.',
}

function clearFilters() {
  globalFilter.value = ''
  pagination.value = { ...pagination.value, pageIndex: 0 }
  if (props.statusFilter !== 'ALL') emit('update:statusFilter', 'ALL')
}
</script>

<template>
  <div class="hf-theme hf-ui human-decisions-visual flex w-full min-w-0 flex-col gap-6">
    <!-- Canonical table workspace (design-system §4): heading outside the surface. -->
    <div class="hf-page-header">
      <h1 class="hf-page-title">Solicitudes</h1>
    </div>

    <UCard
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <div class="hf-table-content w-full min-w-0 space-y-4 px-3 py-3 sm:px-4 sm:py-4">
        <AppDataTable
          v-model:pagination="pagination"
          v-model:sorting="sorting"
          v-model:global-filter="globalFilter"
          :columns="columns"
          :data="data"
          :loading="loading"
          :fetching="fetching"
          :error="error"
          :error-message="errorMessage"
          :empty-state="emptyState"
          :filtered="filtered"
          :no-match-title="noMatchTitle"
          empty="Aún no hay solicitudes"
          :page-count="pageCount"
          :total-count="totalCount"
          :page-size-options="pageSizeOptions"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :row-open="selectDecision"
          display-mode="auto"
          mobile-render="cards"
          mobile-breakpoint="md"
          search-placeholder="Buscar por producto..."
          class="hf-data-table"
          portal-class="hf-theme hf-ui human-decisions-list-portal"
          pagination-portal-class="hf-theme hf-ui human-decisions-list-portal"
          @refresh="emit('refresh')"
          @clear-filters="clearFilters"
        >
          <template #filters>
            <ToolbarSelectFilter
              :model-value="statusFilter"
              :items="statusItems"
              label="Estado"
              portal-class="hf-theme hf-ui human-decisions-list-portal"
              test-id="human-decisions-status"
              @update:model-value="selectStatus"
            />
          </template>

          <template #product-cell="{ row }">
            <div class="min-w-0 max-w-80">
              <button
                type="button"
                class="hf-row-primary text-left"
                data-testid="human-decision-table-open"
                @click="selectDecision(row.original)"
              >
                {{ row.original.snapshot.productName }}
              </button>
              <span class="hf-row-secondary">
                {{ row.original.title }} · {{ productMetaPresentationLabel(row.original) }}
              </span>
            </div>
          </template>

          <template #status-cell="{ row }">
            <StatusBadge
              :label="row.original.status === 'PENDING' ? 'Pendiente' : 'Respondida'"
              :tone="row.original.status === 'PENDING' ? 'warning' : 'success'"
            />
          </template>

          <template #requestedQuantity-cell="{ row }">
            <span class="hf-figure text-sm" data-testid="human-decision-quantity">
              {{
                row.original.type === 'EXPIRATION'
                  ? '—'
                  : requestedQuantityPresentationLabel(row.original.snapshot.requestedQuantity)
              }}
            </span>
          </template>

          <template #createdAt-cell="{ row }">
            <time :datetime="row.original.createdAt" class="text-sm text-muted">
              {{ listDatePresentationLabel(row.original.createdAt) }}
            </time>
          </template>

          <template #response-cell="{ row }">
            <div data-testid="human-decision-response" class="min-w-0 text-sm">
              <template v-if="row.original.status === 'RESOLVED'">
                <p
                  class="truncate"
                  data-testid="human-decision-response-text"
                  :title="resolvedResponseLabel(row.original.resolution)"
                >
                  {{ resolvedResponseLabel(row.original.resolution) }}
                </p>
                <p class="truncate text-[13px] text-muted">
                  {{ row.original.resolution.resolvedBy.displayName }} ·
                  <time :datetime="row.original.resolution.resolvedAt">{{
                    listDatePresentationLabel(row.original.resolution.resolvedAt)
                  }}</time>
                </p>
              </template>
              <span v-else aria-label="Sin respuesta">—</span>
            </div>
          </template>

          <template #mobile-card="{ row }">
            <HumanDecisionCard
              v-if="row.status === 'PENDING'"
              :decision="row"
              @open-detail="selectDecision(row)"
            />
            <ResolvedHumanDecisionCard v-else :decision="row" @open-detail="selectDecision(row)" />
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
