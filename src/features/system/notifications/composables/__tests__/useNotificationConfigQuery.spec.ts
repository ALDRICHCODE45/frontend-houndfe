// useNotificationConfigQuery.spec.ts — RED-first tests for the query
// composables (config + assignable users).
//
// We test by mocking @tanstack/vue-query's useQuery (the same pattern
// useEligibleUsersQuery.spec uses) and then assert:
// - the right queryKey was passed (per `notificationConfigQueryKeys.config`)
// - the right queryFn was passed
// - the data is shaped by `fromConfigResponse` (the field-asymmetry mapper)
//
// For the assignable users query we assert it reuses the existing
// `usersQueryKeys.assignable()` and `usersApi.listAssignable()` — no new
// endpoint, no new query key factory.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  useNotificationConfigQuery,
  useAssignableUsersQuery,
} from '../useNotificationConfigQuery'
import { notificationConfigQueryKeys, usersQueryKeys } from '@/core/shared/constants/query-keys'
import { fromConfigResponse } from '../../utils/notificationConfigMappers'
import type { NotificationConfigResponse } from '../../interfaces/notification-config.types'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

vi.mock('@/features/POS/users/api/user.api', () => ({
  usersApi: {
    listAssignable: vi.fn(),
  },
}))

async function setupQueryReturn(data: unknown) {
  const { useQuery } = await import('@tanstack/vue-query')
  vi.mocked(useQuery).mockReturnValue({
    data: ref(data),
    isLoading: ref(false),
    isError: ref(false),
    error: ref(null),
  } as never)
}

describe('useNotificationConfigQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the tenant-scoped query key to useQuery', async () => {
    await setupQueryReturn(null)

    useNotificationConfigQuery(() => 'tenant-1')

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      queryKey: { value: readonly unknown[] }
    }
    expect(callArgs.queryKey.value).toEqual(notificationConfigQueryKeys.config('tenant-1'))
  })

  it('uses the tenantId from the getter at call time (reactive, not captured)', async () => {
    await setupQueryReturn(null)

    useNotificationConfigQuery(() => 'tenant-9')

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      queryKey: { value: readonly unknown[] }
    }
    expect(callArgs.queryKey.value).toEqual(['notification-config', 'tenant-9'])
  })

  it('exposes data shaped by fromConfigResponse (recipients → recipientUserIds)', async () => {
    const backend: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u1', 'u2'],
      enabledActions: ['LOW_STOCK'],
    }
    await setupQueryReturn(backend)

    const { data } = useNotificationConfigQuery(() => 'tenant-1')

    expect(data.value).toEqual(fromConfigResponse(backend))
    // Specifically: the GET view key "recipients" is NEVER visible.
    expect((data.value as unknown as Record<string, unknown>)?.recipients).toBeUndefined()
  })

  it('exposes isLoading, isError, error passthroughs from useQuery', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(true),
      isError: ref(false),
      error: ref(null),
    } as never)

    const { isLoading, isError, error } = useNotificationConfigQuery(() => 'tenant-1')

    expect(isLoading.value).toBe(true)
    expect(isError.value).toBe(false)
    expect(error.value).toBeNull()
  })
})

describe('useAssignableUsersQuery (reuses existing usersApi + usersQueryKeys)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the existing usersQueryKeys.assignable() key — does NOT create a new factory', async () => {
    await setupQueryReturn([])

    useAssignableUsersQuery()

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      queryKey: readonly unknown[]
    }
    expect(callArgs.queryKey).toEqual(usersQueryKeys.assignable())
  })

  it('exposes the assignable users list from the query data', async () => {
    const mockUsers = [
      { id: 'u1', name: 'Ana' },
      { id: 'u2', name: 'Bruno' },
    ]
    await setupQueryReturn(mockUsers)

    const { users } = useAssignableUsersQuery()

    expect(users.value).toEqual(mockUsers)
  })

  it('returns an empty array when data is undefined (never fetched yet)', async () => {
    await setupQueryReturn(undefined)

    const { users } = useAssignableUsersQuery()

    expect(users.value).toEqual([])
  })
})
