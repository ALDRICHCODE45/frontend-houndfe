import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { adminTenantMembershipQueryKeys, adminUserQueryKeys } from '@/core/shared/constants/query-keys'
import { usersApi } from '@/features/admin/users/api/users.api'
import type { ServerTableParams } from '@/core/shared/types/table.types'
import { membershipsApi } from '../api/memberships.api'

interface SelectOption {
  label: string
  value: string
}

export interface UserSelectOption extends SelectOption {
  email: string
  avatar: {
    alt: string
  }
}

const FULL_LIST_PARAMS: ServerTableParams = {
  pageIndex: 0,
  pageSize: 1000,
  sorting: [],
  globalFilter: '',
}

const USERS_PAGE_SIZE = 100
const MAX_USERS_PAGES = 10

async function getUsersForMembershipOptions() {
  const aggregatedUsers = [] as Awaited<ReturnType<typeof usersApi.getPaginated>>['data']

  for (let pageIndex = 0; pageIndex < MAX_USERS_PAGES; pageIndex += 1) {
    const page = await usersApi.getPaginated({
      ...FULL_LIST_PARAMS,
      pageIndex,
      pageSize: USERS_PAGE_SIZE,
    })

    aggregatedUsers.push(...page.data)

    if (page.data.length < USERS_PAGE_SIZE) {
      break
    }
  }

  return aggregatedUsers
}

export function useMembershipOptions(tenantId: () => string) {
  const usersQuery = useQuery({
    queryKey: computed(() => adminUserQueryKeys.paginated(tenantId())),
    queryFn: async () => ({
      data: await getUsersForMembershipOptions(),
      pagination: {
        pageIndex: 0,
        pageSize: USERS_PAGE_SIZE,
        totalCount: 0,
        pageCount: 1,
      },
    }),
  })

  const rolesQuery = useQuery({
    queryKey: computed(() => adminTenantMembershipQueryKeys.roles(tenantId())),
    queryFn: () => membershipsApi.getTenantRoles(tenantId()),
  })

  const membershipsQuery = useQuery({
    queryKey: computed(() => adminTenantMembershipQueryKeys.list(tenantId())),
    queryFn: () => membershipsApi.getPaginated(tenantId(), FULL_LIST_PARAMS),
  })

  const userOptions = computed<UserSelectOption[]>(() => {
    const existingMemberUserIds = new Set(
      (membershipsQuery.data.value?.data ?? []).map((membership) => membership.userId),
    )

    return (usersQuery.data.value?.data ?? [])
      .filter((user) => user.isActive && !existingMemberUserIds.has(user.id))
      .map((user) => ({
        value: user.id,
        label: user.name,
        email: user.email,
        avatar: {
          alt: user.name,
        },
      }))
  })

  const roleOptions = computed<SelectOption[]>(() =>
    (rolesQuery.data.value ?? []).map((role) => ({
      value: role.id,
      label: role.name,
    })),
  )

  const isLoadingOptions = computed(
    () => usersQuery.isLoading.value || rolesQuery.isLoading.value || membershipsQuery.isLoading.value,
  )

  return {
    userOptions,
    roleOptions,
    isLoadingOptions,
  }
}
