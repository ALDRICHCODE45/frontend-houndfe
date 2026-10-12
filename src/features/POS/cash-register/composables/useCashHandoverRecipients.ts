/**
 * Recipient options for a custody declaration.
 *
 * "No invented user-list permissions": the UI reuses the EXISTING assignable
 * users source (`GET /users/assignable` + `usersQueryKeys.assignable()`), which
 * is what the app already exposes for people pickers, and only when the
 * identity already holds the existing `read:User` ability. Without it the
 * declaration form falls back to an explicit, validated recipient UUID input.
 */
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { usersQueryKeys } from '@/core/shared/constants/query-keys'
import { usersApi } from '@/features/POS/users/api/user.api'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

export function useCashHandoverRecipients() {
  const authStore = useAuthStore()
  const entitled = computed(() => authStore.userCan('read', 'User'))

  const query = useQuery<AssignableUser[]>({
    queryKey: usersQueryKeys.assignable(),
    queryFn: () => usersApi.listAssignable(),
    enabled: entitled,
    staleTime: 60_000,
  })

  return {
    entitled,
    assignableUsers: computed(() => query.data.value ?? []),
    isLoading: computed(() => entitled.value && query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: query.refetch,
  }
}
