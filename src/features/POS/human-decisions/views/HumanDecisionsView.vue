<script setup lang="ts">
import HumanDecisionDetailSlideover from '../components/HumanDecisionDetailSlideover.vue'
import HumanDecisionsListPanel from '../components/HumanDecisionsListPanel.vue'
import { useHumanDecisionsInbox } from '../composables/useHumanDecisionsInbox'

const {
  list: {
    data,
    pagination,
    globalFilter,
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
</script>

<template>
  <section class="w-full space-y-4 p-4 sm:p-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-highlighted">Decisiones pendientes</h1>
      <p class="text-sm text-muted">
        Responde solicitudes de reposición con la información operativa disponible.
      </p>
    </header>

    <HumanDecisionsListPanel
      v-model:pagination="pagination"
      v-model:global-filter="globalFilter"
      :data="data"
      :loading="listLoading"
      :fetching="isFetching"
      :error="listError"
      :page-count="pageCount"
      :total-count="totalCount"
      :page-size-options="pageSizeOptions"
      :showing-from="showingFrom"
      :showing-to="showingTo"
      @refresh="refresh"
      @open-detail="openDetail"
    />

    <HumanDecisionDetailSlideover
      v-model:open="detailOpen"
      :decision="decision ?? null"
      :loading="detailLoading"
      :error="detailError"
      :can-update="canUpdate"
      :resolving="resolving"
      :conflict="resolutionConflict"
      :resolution-error-message="resolutionErrorMessage"
      @retry="retryDetail"
      @resolve="resolveDecision"
    />
  </section>
</template>
