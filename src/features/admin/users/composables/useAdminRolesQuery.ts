import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { rolesApi } from '../../roles/api/roles.api'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { RoleTableRow } from '../../roles/interfaces/role.types'
import type { ServerTableParams } from '@/core/shared/types/table.types'

export interface RoleOption {
  value: string
  label: string
}

/**
 * useAdminRolesQuery — picker variant for forms (e.g. Create User slideover).
 *
 * Loads the tenant-wide role catalog via GET /admin/roles and maps each role
 * to a USelectMenu option `{ value: role.id, label: role.name }`.
 *
 * Cache key
 * ---------
 * Uses `adminRoleQueryKeys.paginated(tenantId)` as the BASE key (no serverParams
 * suffix). This is intentionally NOT the same cache entry as the
 * `AdminRolesView` table query, which appends `serverParams`
 * (page/sort/filter) to the same base via `useServerTable`. Sharing the cache
 * between the picker and the table would require both consumers to request the
 * same page/sort/filter, which they do not.
 *
 * Pagination
 * ----------
 * Fetches all roles for the picker in a single request by asking for a large
 * page (pageSize 1000). The backend caps page sizes well above this for roles.
 *
 * Enabled gate
 * ------------
 * The query only fires when BOTH:
 *   (a) a tenant id is resolved (truthy, non-empty after trim), AND
 *   (b) the current user has `read` permission on the `Role` subject
 *       (the same `useAuthStore().userCan('read', 'Role')` that gates
 *       `canReadRoles` in `UserUpsertSlideover.vue`).
 *
 * Reading both signals from the auth store here guarantees a single source of
 * truth: the disabled-UI state and the network-fire state always agree.
 *
 * Reactivity
 * ----------
 * `tenantId` accepts `MaybeRefOrGetter<string>`, so callers may pass a plain
 * string, a ref, or a getter. Both the query key and the enabled gate react
 * to tenant changes via `toValue()` inside their computeds.
 */
export function useAdminRolesQuery(tenantId: MaybeRefOrGetter<string>) {
  const authStore = useAuthStore()

  const enabled = computed(() => {
    const tenant = toValue(tenantId).trim()
    return tenant.length > 0 && authStore.userCan('read', 'Role')
  })

  const query = useQuery({
    queryKey: computed(() => adminRoleQueryKeys.paginated(toValue(tenantId))),
    queryFn: () =>
      rolesApi.getPaginated({
        pageIndex: 0,
        pageSize: 1000,
      } satisfies ServerTableParams),
    enabled,
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
