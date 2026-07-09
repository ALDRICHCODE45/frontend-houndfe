import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { rolesApi } from '../../roles/api/roles.api'
import type { RoleTableRow } from '../../roles/interfaces/role.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

export interface RoleOption {
  value: string
  label: string
}

/**
 * Loads the tenant-wide role catalog via GET /admin/roles and maps each role
 * to a USelectMenu option `{ value: role.id, label: role.name }`.
 *
 * Reuses `adminRoleQueryKeys.paginated(tenantId)` so the cache is shared with
 * the AdminRolesView table query.
 *
 * Use this in forms that need a role picker (e.g. create-user slideover).
 */
export function useAdminRolesQuery(tenantId: MaybeRefOrGetter<string>) {
  const query = useQuery({
    queryKey: computed(() => adminRoleQueryKeys.paginated(toValue(tenantId))),
    queryFn: () =>
      rolesApi.getPaginated({
        pageIndex: 0,
        pageSize: 1000,
      } satisfies ServerTableParams),
  })

  const roleOptions = computed<RoleOption[]>(() => {
    const rows: RoleTableRow[] = query.data.value?.data ?? []
    return rows.map((row) => ({ value: row.id, label: row.name }))
  })

  return {
    roleOptions,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}