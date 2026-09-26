<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { HumanDecision } from '../interfaces/human-decision.types'
import type { HumanDecisionResolutionInput } from '../utils/humanDecisionResolutionAttempt'
import HumanDecisionDetailSlideover from '../components/HumanDecisionDetailSlideover.vue'
import HumanDecisionsListPanel from '../components/HumanDecisionsListPanel.vue'
import { useHumanDecisionsInbox } from '../composables/useHumanDecisionsInbox'

const {
  list: {
    data,
    pagination,
    globalFilter,
    statusFilter,
    setStatusFilter,
    totalCount,
    pageCount,
    isLoading: listLoading,
    isFetching,
    isError: listError,
    pageSizeOptions,
    showingFrom,
    showingTo,
    refresh,
  },
  detail: { data: decision, isLoading: detailLoading, isError: detailError },
  detailOpen,
  canUpdate,
  resolving,
  resolutionErrorMessage,
  resolutionConflict,
  openDetail,
  resolveDecision,
  retryDetail,
} = useHumanDecisionsInbox()

// A selection snapshot survives pagination/filter changes and cannot be upgraded by cached detail.
const selection = shallowRef<Pick<HumanDecision, 'id' | 'status'> | null>(null)
const canResolveSelection = computed(
  () =>
    selection.value?.status === 'PENDING' &&
    decision.value?.id === selection.value.id &&
    decision.value?.status === 'PENDING' &&
    canUpdate.value,
)

function selectDetail(row: Pick<HumanDecision, 'id' | 'status'>) {
  selection.value = { id: row.id, status: row.status }
  openDetail(row.id)
}

function resolvePending(input: HumanDecisionResolutionInput) {
  if (canResolveSelection.value) return resolveDecision(input)
}
</script>

<template>
  <section class="flex flex-col gap-6 md:px-10">
    <HumanDecisionsListPanel
      v-model:pagination="pagination"
      v-model:global-filter="globalFilter"
      :status-filter="statusFilter"
      :data="data"
      :loading="listLoading"
      :fetching="isFetching"
      :error="listError"
      :page-count="pageCount"
      :total-count="totalCount"
      :page-size-options="pageSizeOptions"
      :showing-from="showingFrom"
      :showing-to="showingTo"
      @update:status-filter="setStatusFilter"
      @refresh="refresh"
      @open-detail="selectDetail"
    />

    <HumanDecisionDetailSlideover
      v-model:open="detailOpen"
      :decision="decision ?? null"
      :loading="detailLoading"
      :error="detailError"
      :can-update="canResolveSelection"
      :resolving="resolving"
      :conflict="resolutionConflict"
      :resolution-error-message="resolutionErrorMessage"
      @retry="retryDetail"
      @resolve="resolvePending"
    />
  </section>
</template>
