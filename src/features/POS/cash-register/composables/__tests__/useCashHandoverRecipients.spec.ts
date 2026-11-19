/**
 * useCashHandoverRecipients — S6: the handover recipient comes from
 * `GET /cash-handovers/recipients?kind=…` (handoff 25 §1), gated by the sender's
 * own `create:CashHandover` (canListRecipients). `read:User` and the assignable
 * users list are no longer involved, and there is no raw UUID fallback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'
import type { Mock } from 'vitest'

vi.mock('../../api/cash.api', () => ({ cashApi: { listHandoverRecipients: vi.fn() } }))
vi.mock('@/features/POS/users/api/user.api', () => ({
  usersApi: { listAssignable: vi.fn().mockResolvedValue([]) },
}))

const auth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'cashier-1' } as { id: string } | null,
  permissionCodes: ['create:CashHandover'] as string[],
  permissionsLoaded: true,
  userCan: vi.fn(),
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { cashApi } from '../../api/cash.api'
import { usersApi } from '@/features/POS/users/api/user.api'
import { useCashHandoverRecipients } from '../useCashHandoverRecipients'

const api = cashApi as unknown as { listHandoverRecipients: Mock }

const FLOAT = [
  { userId: 'cashier-1', displayName: 'Ana Cajera', roleName: 'Cajero' },
  { userId: 'sup-1', displayName: 'Luis Supervisor', roleName: 'Supervisor' },
]
const WITHDRAWAL = [{ userId: 'sup-1', displayName: 'Luis Supervisor', roleName: 'Supervisor' }]

function grant(permissions: string[]) {
  const set = new Set(permissions)
  auth.permissionCodes = permissions
  auth.userCan.mockImplementation((action: string, subject: string) => set.has(`${action}:${subject}`))
}

function mountRecipients(active?: () => boolean) {
  let result!: ReturnType<typeof useCashHandoverRecipients>
  const TestComponent = defineComponent({
    setup() {
      result = useCashHandoverRecipients(active ? { active } : {})
      return () => h('div')
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return { result, queryClient, wrapper }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.accessToken = 'token-1'
  auth.currentTenantId = 'tenant-1'
  auth.user = { id: 'cashier-1' }
  auth.permissionsLoaded = true
  grant(['create:CashHandover'])
  api.listHandoverRecipients.mockImplementation((kind: string) =>
    Promise.resolve(kind === 'FLOAT' ? FLOAT : WITHDRAWAL),
  )
})

enableAutoUnmount(afterEach)

describe('useCashHandoverRecipients · S6 recipients endpoint', () => {
  it('reads each kind from GET /cash-handovers/recipients under the principal-scoped key', async () => {
    const { result, queryClient } = mountRecipients()
    await flush()

    expect(api.listHandoverRecipients).toHaveBeenCalledWith('FLOAT')
    expect(api.listHandoverRecipients).toHaveBeenCalledWith('WITHDRAWAL')
    expect(result.allowed.value).toBe(true)
    expect(result.state.value.FLOAT.items).toEqual(FLOAT)
    expect(result.state.value.WITHDRAWAL.items).toEqual(WITHDRAWAL)
    expect(result.state.value.FLOAT.loading).toBe(false)
    expect(result.state.value.FLOAT.error).toBe(false)

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey)
    for (const kind of ['FLOAT', 'WITHDRAWAL']) {
      // ['cash', tenant, user, permissions, generation, 'recipients', kind]
      expect(keys).toContainEqual([
        'cash',
        'tenant-1',
        'cashier-1',
        expect.any(String),
        expect.any(String),
        'recipients',
        kind,
      ])
    }
    // Never the old people picker.
    expect(usersApi.listAssignable).not.toHaveBeenCalled()
  })

  it('does not read without create:CashHandover, even with read:User', async () => {
    grant(['read:User', 'read:CashSession'])
    const { result } = mountRecipients()
    await flush()

    expect(api.listHandoverRecipients).not.toHaveBeenCalled()
    expect(result.allowed.value).toBe(false)
    expect(result.state.value.FLOAT.loading).toBe(false)
  })

  it('waits until the handover task is active', async () => {
    const active = ref(false)
    mountRecipients(() => active.value)
    await flush()
    expect(api.listHandoverRecipients).not.toHaveBeenCalled()

    active.value = true
    await flush()
    expect(api.listHandoverRecipients).toHaveBeenCalledTimes(2)
  })

  it('reports a failed kind as an error and retries only that kind', async () => {
    api.listHandoverRecipients.mockImplementation((kind: string) =>
      kind === 'WITHDRAWAL' ? Promise.reject(new Error('boom')) : Promise.resolve(FLOAT),
    )
    const { result } = mountRecipients()
    await flush()
    await flush()
    expect(result.state.value.WITHDRAWAL.error).toBe(true)
    expect(result.state.value.FLOAT.error).toBe(false)

    api.listHandoverRecipients.mockClear()
    api.listHandoverRecipients.mockResolvedValue(WITHDRAWAL)
    await result.refetch('WITHDRAWAL')
    await flush()
    expect(api.listHandoverRecipients).toHaveBeenCalledTimes(1)
    expect(api.listHandoverRecipients).toHaveBeenCalledWith('WITHDRAWAL')
    expect(result.state.value.WITHDRAWAL.items).toEqual(WITHDRAWAL)
  })

  it('does not reuse the previous user’s recipients after a same-tenant switch', async () => {
    mountRecipients()
    await flush()
    expect(api.listHandoverRecipients).toHaveBeenCalledTimes(2)

    auth.user = { id: 'cashier-2' }
    await flush()
    await flush()
    expect(api.listHandoverRecipients).toHaveBeenCalledTimes(4)
  })
})
