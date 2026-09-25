<script setup lang="ts">
import { ref } from 'vue'
import { AppDataTable } from '@/core/shared/components/DataTable'
import type { PaginationState, SortingState } from '@/core/shared/types/table.types'
import { useHumanDecisionColumns } from '../composables/useHumanDecisionColumns'
import type { PendingHumanDecision } from '../interfaces/human-decision.types'
import {
  branchPresentationLabel,
  createdAtPresentationLabel,
  requestedQuantityPresentationLabel,
  skuPresentationLabel,
} from '../utils/humanDecisionPresentation'
import HumanDecisionCard from './HumanDecisionCard.vue'

withDefaults(
  defineProps<{
    data: PendingHumanDecision[]
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
    loading: false,
    fetching: false,
    error: false,
    errorMessage: 'No se pudieron cargar las decisiones pendientes. Reintenta.',
    pageCount: 0,
    totalCount: 0,
    pageSizeOptions: () => [20, 50],
    showingFrom: 0,
    showingTo: 0,
  },
)

const emit = defineEmits<{ refresh: []; openDetail: [decisionId: string] }>()
const pagination = defineModel<PaginationState>('pagination', {
  default: () => ({ pageIndex: 0, pageSize: 20 }),
})
const globalFilter = defineModel<string>('globalFilter', { default: '' })
const sorting = ref<SortingState>([{ id: 'createdAt', desc: false }])
const { columns } = useHumanDecisionColumns()
</script>

<template>
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
    empty="No hay decisiones pendientes."
    :page-count="pageCount"
    :total-count="totalCount"
    :page-size-options="pageSizeOptions"
    :showing-from="showingFrom"
    :showing-to="showingTo"
    display-mode="auto"
    mobile-render="cards"
    mobile-breakpoint="md"
    search-placeholder="Buscar por producto o sucursal..."
    refresh-button-test-id="human-decisions-refresh"
    @refresh="emit('refresh')"
  >
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

    <template #branch-cell="{ row }">
      <span class="text-sm">{{ branchPresentationLabel(row.original.snapshot.branchName) }}</span>
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
          @click="emit('openDetail', row.original.id)"
        >
          Ver detalle
        </UButton>
      </div>
    </template>

    <template #mobile-card="{ row }">
      <HumanDecisionCard :decision="row" @open-detail="emit('openDetail', $event)" />
    </template>
  </AppDataTable>
</template>
