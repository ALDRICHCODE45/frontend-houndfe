/** One server-owned inbox page; no client ordering or recent-response cutoff. */
import { computed, readonly, shallowRef } from 'vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { humanDecisionApi } from '../api/human-decision.api'
import type {
  HumanDecision,
  HumanDecisionListFilter,
  HumanDecisionListParams,
  HumanDecisionPageSize,
} from '../interfaces/human-decision.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

/** Translate zero-based table pagination and normalize product-only search. */
export function mapServerTableParamsToHumanDecisionListParams(
  params: ServerTableParams,
  status: HumanDecisionListFilter = 'ALL',
): HumanDecisionListParams {
  const limit: HumanDecisionPageSize = params.pageSize === 50 ? 50 : 20
  const page = params.pageIndex + 1
  const mapped: HumanDecisionListParams =
    status === 'ALL'
      ? { status, page, limit }
      : status === 'PENDING'
        ? { status, page, limit, sortBy: 'createdAt', sortOrder: 'asc' }
        : { status, page, limit, sortBy: 'resolvedAt', sortOrder: 'desc' }
  const search = (params.globalFilter ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim()
  if (search) mapped.search = search
  return mapped
}

export function useHumanDecisionsListTable() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const statusFilter = shallowRef<HumanDecisionListFilter>('ALL')
  const table = useServerTable<HumanDecision>({
    queryKey: () => humanDecisionQueryKeys.filteredListPrefix(tenantId.value, statusFilter.value),
    queryFn: (params, { queryKey }) => {
      // filteredListPrefix ends in status; useServerTable appends the captured params.
      const status = queryKey[queryKey.length - 2]
      if (status !== 'ALL' && status !== 'PENDING' && status !== 'RESOLVED') {
        throw new Error('Invalid human decision list query status')
      }
      return humanDecisionApi.list(mapServerTableParamsToHumanDecisionListParams(params, status))
    },
    defaultPageSize: 20,
    pageSizeOptions: [20, 50],
    persistKey: 'pos-human-decisions-list',
    urlSync: false,
  })

  function setStatusFilter(status: HumanDecisionListFilter) {
    if (status === statusFilter.value) return
    table.pagination.value = { ...table.pagination.value, pageIndex: 0 }
    statusFilter.value = status
  }

  return { ...table, statusFilter: readonly(statusFilter), setStatusFilter }
}
