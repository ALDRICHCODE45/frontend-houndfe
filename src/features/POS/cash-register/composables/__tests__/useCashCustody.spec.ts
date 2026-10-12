/**
 * useCashCustody — the dedicated recipient read.
 *
 * Missing `read:CashHandover` is a denial, never a silent empty page: the query
 * must not run at all without the grant (the UI shows an access state). The
 * cache slot is scoped to tenant + recipient + page + limit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import type { Mock } from 'vitest'

vi.mock('../../api/cash.api', () => ({ cashApi: { getCustody: vi.fn() } }))

const auth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'recipient-1' } as { id: string } | null,
  permissionCodes: ['read:CashHandover'] as string[],
  permissionsLoaded: true,
  userCan: vi.fn(),
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { authStorage } from '@/features/auth/services/auth-storage'
import { cashApi } from '../../api/cash.api'
import { useCashCustody } from '../useCashCustody'
import { cashQueryKeys } from '../cashQueryKeys'

const api = cashApi as unknown as { getCustody: Mock }

function mountCustody() {
  let result!: ReturnType<typeof useCashCustody>
  const TestComponent = defineComponent({
    setup() {
      result = useCashCustody()
      return () => h('div')
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { result, queryClient, wrapper }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.accessToken = 'token-1'
  auth.currentTenantId = 'tenant-1'
  auth.user = { id: 'recipient-1' }
  auth.permissionCodes = ['read:CashHandover']
  auth.permissionsLoaded = true
  auth.userCan.mockReturnValue(false)
  api.getCustody.mockResolvedValue({
    pendingHandovers: { items: [], page: 1, limit: 25, total: 0 },
    eligibleFloat: { items: [], page: 1, limit: 25, total: 0 },
  })
})

// Every mounted test component is unmounted so its query observers cannot leak
// into the next test (the auth stub is a module-level reactive shared by all of them).
enableAutoUnmount(afterEach)

describe('useCashCustody · read:CashHandover is its own grant', () => {
  it('does NOT query without read:CashHandover (denial, not an empty page)', async () => {
    const { result } = mountCustody()
    await flush()

    expect(api.getCustody).not.toHaveBeenCalled()
    expect(result.allowed.value).toBe(false)
    expect(result.isLoading.value).toBe(false)
  })

  it('does NOT let read:CashSessionAudit substitute for read:CashHandover', async () => {
    auth.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'CashSessionAudit',
    )
    const { result } = mountCustody()
    await flush()

    expect(result.allowed.value).toBe(false)
    expect(api.getCustody).not.toHaveBeenCalled()
  })

  it('queries with page/limit only once read:CashHandover is granted', async () => {
    auth.userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'CashHandover',
    )
    const { result } = mountCustody()
    await flush()

    expect(result.allowed.value).toBe(true)
    expect(api.getCustody).toHaveBeenCalledWith({ page: 1, limit: 25 })
    expect(result.pendingTotal.value).toBe(0)
  })

  it('isolates the cache slot per principal (tenant + user + permission generation)', () => {
    const base = {
      tenantId: 'tenant-a',
      userId: 'recipient-1',
      permissionFingerprint: 'fp-1',
      generation: 1,
    }
    expect(cashQueryKeys.custody(base, 1, 25)).not.toEqual(
      cashQueryKeys.custody({ ...base, tenantId: 'tenant-b' }, 1, 25),
    )
    // Same tenant, different user: the previous recipient's custody is NEVER reused.
    expect(cashQueryKeys.custody(base, 1, 25)).not.toEqual(
      cashQueryKeys.custody({ ...base, userId: 'recipient-2' }, 1, 25),
    )
    // Same tenant and user, different permission generation.
    expect(cashQueryKeys.custody(base, 1, 25)).not.toEqual(
      cashQueryKeys.custody({ ...base, permissionFingerprint: 'fp-2' }, 1, 25),
    )
    // Same identity and permissions, DIFFERENT session lifecycle: a new slot.
    expect(cashQueryKeys.custody(base, 1, 25)).not.toEqual(
      cashQueryKeys.custody({ ...base, generation: 2 }, 1, 25),
    )
  })

  it('does NOT reuse custody after a same-identity logout/login (new session lifecycle)', async () => {
    auth.userCan.mockReturnValue(true)
    mountCustody()
    await flush()
    expect(api.getCustody).toHaveBeenCalledTimes(1)

    // Same recipient, same tenant, same permissions — a NEW session lifecycle.
    auth.accessToken = 'token-2'
    authStorage.setTokens({ accessToken: 'token-2', refreshToken: 'token-2-refresh' })
    await flush()
    await flush()

    expect(api.getCustody).toHaveBeenCalledTimes(2)
  })

  it('does NOT reuse another recipient’s custody after a same-tenant user switch', async () => {
    auth.userCan.mockReturnValue(true)
    mountCustody()
    await flush()
    expect(api.getCustody).toHaveBeenCalledTimes(1)

    auth.user = { id: 'recipient-2' }
    await flush()
    await flush()

    expect(api.getCustody).toHaveBeenCalledTimes(2)
  })

  it('never lets the client supply a recipient (only page/limit travel)', async () => {
    auth.userCan.mockReturnValue(true)
    mountCustody()
    await flush()

    expect(Object.keys(api.getCustody.mock.calls[0]![0]!)).toEqual(['page', 'limit'])
  })
})
