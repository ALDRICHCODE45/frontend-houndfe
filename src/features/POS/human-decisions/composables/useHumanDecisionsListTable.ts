/**
 * HD2B — RESTOCK inbox list table. Wraps the shared `useServerTable`.
 *
 * The backend list endpoint is fixed: `status=PENDING`, sort `createdAt asc`,
 * and a `limit` of 20 or 50. The pure mapper below is the single place that
 * translates the table's zero-based state into that contract; the API response
 * already matches the shared `{data,pagination}` shape, so it is returned as-is.
 */

import { computed } from 'vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { humanDecisionApi } from '../api/human-decision.api'
import type {
  HumanDecisionListParams,
  HumanDecisionPageSize,
  PendingHumanDecision,
} from '../interfaces/human-decision.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [20, 50]
const WHITESPACE_RUN = /\s+/gu

/** Pure: ServerTableParams (0-indexed) → HumanDecisionListParams (1-indexed). */
export function mapServerTableParamsToHumanDecisionListParams(
  params: ServerTableParams,
): HumanDecisionListParams {
  const limit: HumanDecisionPageSize = params.pageSize === 50 ? 50 : 20
  const mapped: HumanDecisionListParams = {
    status: 'PENDING',
    page: params.pageIndex + 1,
    limit,
    sortBy: 'createdAt',
    sortOrder: 'asc',
  }

  const search = (params.globalFilter ?? '').normalize('NFC').replace(WHITESPACE_RUN, ' ').trim()
  if (search) mapped.search = search

  return mapped
}

export function useHumanDecisionsListTable() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  return useServerTable<PendingHumanDecision>({
    // `useServerTable` appends the live server params, so the base key is the
    // list prefix: the full key stays `[..., 'list', serverParams]`.
    queryKey: () => humanDecisionQueryKeys.listPrefix(tenantId.value),
    queryFn: (params) =>
      humanDecisionApi.list(mapServerTableParamsToHumanDecisionListParams(params)),
    defaultPageSize: DEFAULT_PAGE_SIZE,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    defaultSorting: [{ id: 'createdAt', desc: false }],
    persistKey: 'pos-human-decisions-list',
    urlSync: false,
  })
}
