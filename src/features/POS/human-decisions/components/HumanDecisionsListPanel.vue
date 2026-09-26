<script setup lang="ts">
import { computed, ref } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'
import { AppDataTable } from '@/core/shared/components/DataTable'
import type { PaginationState, SortingState } from '@/core/shared/types/table.types'
import { useHumanDecisionColumns } from '../composables/useHumanDecisionColumns'
import type { HumanDecision, HumanDecisionListFilter } from '../interfaces/human-decision.types'
import {
  branchPresentationLabel,
  createdAtPresentationLabel,
  requestedQuantityPresentationLabel,
  skuPresentationLabel,
  resolvedResponseLabel,
} from '../utils/humanDecisionPresentation'
import HumanDecisionCard from './HumanDecisionCard.vue'
import ResolvedHumanDecisionCard from './ResolvedHumanDecisionCard.vue'

withDefaults(
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
    errorMessage: 'No se pudieron cargar las solicitudes. Reintenta.',
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

// The initial viewport supplies only the fallback; saved/manual choices win at any size.
const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')
const { viewMode, setMode } = useViewMode(
  'human-decisions-view-mode',
  ['table', 'card'] as const,
  isMobile.value ? 'card' : 'table',
)
const displayMode = computed(() => (viewMode.value === 'card' ? 'cards' : 'table'))

function selectViewMode(mode: string): void {
  if (mode === 'table' || mode === 'card') setMode(mode)
}
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
    <template #header>
      <TableHeaderDescription
        title="Solicitudes"
        description="Responde solicitudes de reposición con la información operativa disponible."
      />
    </template>
    <div class="w-full min-w-0 space-y-4 px-3 py-3 sm:px-4 sm:py-4">
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
        empty="No hay solicitudes para este filtro."
        :page-count="pageCount"
        :total-count="totalCount"
        :page-size-options="pageSizeOptions"
        :showing-from="showingFrom"
        :showing-to="showingTo"
        :display-mode="displayMode"
        mobile-render="cards"
        mobile-breakpoint="md"
        search-placeholder="Buscar por producto..."
        refresh-button-test-id="human-decisions-refresh"
        @refresh="emit('refresh')"
      >
        <template #actions>
          <div class="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted">
            <label for="human-decisions-status">Estado</label>
            <USelect
              id="human-decisions-status"
              :model-value="statusFilter"
              :items="statusItems"
              aria-label="Estado"
              class="min-h-11 max-w-full"
              @update:model-value="selectStatus"
            />
          </div>
          <div class="w-max max-w-full flex-none">
            <ViewToggle :model-value="viewMode" @update:model-value="selectViewMode" />
          </div>
        </template>

        <template #product-cell="{ row }">
          <div class="min-w-0 max-w-80">
            <p class="truncate font-medium text-highlighted">{{ row.original.title }}</p>
            <p class="truncate text-xs text-muted">{{ row.original.sanitizedSummary }}</p>
            <p class="truncate text-xs text-muted">
              {{ row.original.snapshot.productName }} ·
              {{ skuPresentationLabel(row.original.snapshot.sku) }}
            </p>
          </div>
        </template>

        <template #status-cell="{ row }">
          <UBadge
            :color="row.original.status === 'PENDING' ? 'warning' : 'success'"
            variant="subtle"
          >
            {{ row.original.status === 'PENDING' ? 'Pendiente' : 'Respondida' }}
          </UBadge>
        </template>

        <template #response-cell="{ row }">
          <div data-testid="human-decision-response" class="max-w-72 whitespace-normal text-sm">
            <template v-if="row.original.status === 'RESOLVED'">
              <p>{{ resolvedResponseLabel(row.original.resolution) }}</p>
              <p class="mt-1 text-xs text-muted">
                {{ row.original.resolution.resolvedBy.displayName }} ·
                <time :datetime="row.original.resolution.resolvedAt">{{
                  createdAtPresentationLabel(row.original.resolution.resolvedAt)
                }}</time>
              </p>
            </template>
            <span v-else aria-label="Sin respuesta">—</span>
          </div>
        </template>

        <template #branch-cell="{ row }">
          <span class="text-sm">{{
            branchPresentationLabel(row.original.snapshot.branchName)
          }}</span>
        </template>

        <template #requestedQuantity-cell="{ row }">
          <span class="text-sm">
            {{ requestedQuantityPresentationLabel(row.original.snapshot.requestedQuantity) }}
          </span>
        </template>

        <template #createdAt-cell="{ row }">
          <time :datetime="row.original.createdAt" class="text-sm">
            {{ createdAtPresentationLabel(row.original.createdAt) }}
          </time>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="min-h-11"
              data-testid="human-decision-table-open"
              :aria-label="`Abrir detalle: ${row.original.title}`"
              @click="selectDecision(row.original)"
            >
              Ver detalle
            </UButton>
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
</template>
