import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { adminTenantMembershipQueryKeys } from '@/core/shared/constants/query-keys'
import { membershipsApi } from '../api/memberships.api'

export function useEligibleUsersQuery(
  tenantId: MaybeRefOrGetter<string>,
  search: MaybeRefOrGetter<string>,
) {
  const trimmedSearch = computed(() => toValue(search).trim())

  const enabled = computed(() => {
    const length = trimmedSearch.value.length
    return length === 0 || length >= 2
  })

  const query = useQuery({
    queryKey: computed(() =>
      adminTenantMembershipQueryKeys.eligible(toValue(tenantId), {
        search: trimmedSearch.value,
        page: 1,
      }),
    ),
    queryFn: () =>
      membershipsApi.getEligibleUsers(toValue(tenantId), {
        search: trimmedSearch.value,
        page: 1,
        limit: 20,
      }),
    enabled,
    placeholderData: keepPreviousData,
  })

  const users = computed(() => query.data.value?.data ?? [])

  return {
    users,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
