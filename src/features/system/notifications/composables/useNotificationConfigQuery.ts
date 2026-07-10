// useNotificationConfigQuery.ts — server-state composables for the
// notification-config screen.
//
// Two composables live here because they share the same data source surface
// (the view will need both):
//   - useNotificationConfigQuery(tenantId) → GET /notification-config
//   - useAssignableUsersQuery()           → GET /users/assignable (existing)
//
// Both wrap @tanstack/vue-query `useQuery` and shape data through the pure
// mapper layer. tenantId is a `MaybeRefOrGetter` so callers may pass a
// reactive store value (`useAuthStore().currentTenantId`).

import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { notificationConfigQueryKeys, usersQueryKeys } from '@/core/shared/constants/query-keys'
import { notificationConfigApi } from '../api/notificationConfig.api'
import { usersApi } from '@/features/POS/users/api/user.api'
import { fromConfigResponse } from '../utils/notificationConfigMappers'
import type {
  ActionKey,
  NotificationConfigForm,
  NotificationConfigResponse,
} from '../interfaces/notification-config.types'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

/**
 * useNotificationConfigQuery — read-side composable.
 *
 * tenantId is reactive (MaybeRefOrGetter) so the cache key changes when the
 * auth store's current tenant changes. Data is shaped by `fromConfigResponse`
 * so the form-side asymmetry (GET `recipients` vs PUT `recipientUserIds`) is
 * invisible to consumers.
 */
export function useNotificationConfigQuery(tenantId: MaybeRefOrGetter<string>) {
  const query = useQuery<NotificationConfigResponse>({
    queryKey: computed(() => notificationConfigQueryKeys.config(toValue(tenantId))),
    queryFn: () => notificationConfigApi.get(),
    placeholderData: keepPreviousData,
  })

  // Shape the GET view through the mapper so consumers see the form
  // shape (`recipientUserIds`, not `recipients`). The mapper is pure and
  // identity on `enabled` / `enabledActions`. `query.data.value` is already
  // typed as `NotificationConfigResponse | undefined` via the useQuery generic.
  const data: Ref<NotificationConfigForm | undefined> = computed(() => {
    const view = query.data.value
    return view ? fromConfigResponse(view) : undefined
  })

  return {
    data,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  }
}

/**
 * useAssignableUsersQuery — recipient multi-select source.
 *
 * Reuses the existing `usersApi.listAssignable()` and `usersQueryKeys.assignable()`
 * from the POS users module. Backend resolves the tenant from the JWT, so no
 * tenantId is part of the contract here.
 */
export function useAssignableUsersQuery() {
  const query = useQuery({
    queryKey: usersQueryKeys.assignable(),
    queryFn: () => usersApi.listAssignable(),
    placeholderData: keepPreviousData,
  })

  const users: Ref<AssignableUser[]> = computed(() => query.data.value ?? [])

  return {
    users,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}

// Re-export the ActionKey type for convenience so callers can build
// form snapshots without importing the interfaces file directly.
export type { ActionKey }
