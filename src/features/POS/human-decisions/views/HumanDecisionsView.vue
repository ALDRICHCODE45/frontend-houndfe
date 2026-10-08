<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { HumanDecision } from '../interfaces/human-decision.types'
import type { HumanDecisionResolutionInput } from '../utils/humanDecisionResolutionAttempt'
import type { ExpirationDecisionResolutionInput } from '../utils/expirationResolutionAttempt'
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
  expirationResolving,
  expirationErrorMessage,
  expirationConflict,
  expirationRequiresReauthentication,
  openDetail,
  resolveDecision,
  resolveExpirationDecision,
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

const isExpirationDetail = computed(() => decision.value?.type === 'EXPIRATION')
// One presentation channel, projected from the feedback of the displayed type only.
const activeResolving = computed(() =>
  isExpirationDetail.value ? expirationResolving.value : resolving.value,
)
const activeConflict = computed(() =>
  isExpirationDetail.value ? expirationConflict.value : resolutionConflict.value,
)
const activeResolutionError = computed(() =>
  isExpirationDetail.value ? expirationErrorMessage.value : resolutionErrorMessage.value,
)
const activeRequiresReauthentication = computed(
  () => isExpirationDetail.value && expirationRequiresReauthentication.value,
)

function resolvePending(input: HumanDecisionResolutionInput) {
  if (canResolveSelection.value) return resolveDecision(input)
}

function resolveExpiration(detailId: string, input: ExpirationDecisionResolutionInput) {
  const current = decision.value
  if (
    !detailOpen.value ||
    detailId !== selection.value?.id ||
    current?.id !== detailId ||
    current.type !== 'EXPIRATION' ||
    current.status !== 'PENDING' ||
    !canResolveSelection.value ||
    expirationResolving.value ||
    expirationConflict.value ||
    expirationRequiresReauthentication.value
  ) {
    return
  }
  return resolveExpirationDecision(input)
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
      :resolving="activeResolving"
      :conflict="activeConflict"
      :resolution-error-message="activeResolutionError"
      :requires-reauthentication="activeRequiresReauthentication"
      @retry="retryDetail"
      @resolve="resolvePending"
      @resolve-expiration="resolveExpiration"
    />
  </section>
</template>
