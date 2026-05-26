import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { adminTenantMembershipQueryKeys } from '@/core/shared/constants/query-keys'
import { membershipsApi } from '../api/memberships.api'

export function useTenantRolesQuery(tenantId: MaybeRefOrGetter<string>) {
  const query = useQuery({
    queryKey: computed(() => adminTenantMembershipQueryKeys.roles(toValue(tenantId))),
    queryFn: () => membershipsApi.getTenantRoles(toValue(tenantId)),
  })

  const roles = computed(() => query.data.value ?? [])

  return {
    roles,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
