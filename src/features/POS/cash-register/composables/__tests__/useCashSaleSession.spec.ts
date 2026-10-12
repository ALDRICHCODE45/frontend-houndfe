/**
 * useCashSaleSession — explicit cash-session selection for the POS charge.
 *
 * Contract under test (T6 / S3):
 *   - never fetch without `read:CashSession`, a resolved principal and resolved
 *     permissions (no request for an unauthorized identity);
 *   - only own + OPEN + current-tenant rows are offered; a foreign cashier,
 *     a non-OPEN status, a foreign tenant or a non-UUID id is never selectable;
 *   - pagination stays honest: only `page`/`limit` travel, the total spans ALL
 *     statuses (never presented as a filtered total);
 *   - the selection is NEVER auto-derived from the first/sole/previous row;
 *   - an ACTUAL selection clears synchronously on any principal, permission,
 *     unresolved-permission or session-lifecycle change (including a
 *     same-principal logout/login); the live captured-scope guard still fails
 *     a same-tick confirm closed before any stale id can travel;
 *   - the selected id is revalidated against the CURRENT access + captured
 *     scope + visible rows (`revalidateSelection` for the submit gate), so a
 *     stale or invalid selection fails closed instead of becoming "unbound".
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'

vi.mock('../../api/cash.api', () => ({
  cashApi: { listSessions: vi.fn() },
}))

const auth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: ['read:CashSession'] as string[],
  permissionsLoaded: true,
  /** Stable function identity that reads the mutable flag (a `vi.fn` swap would
   *  break the computed dependency tracking that mirrors the real store). */
  canReadSessions: true,
  userCan: (action: string, subject: string): boolean =>
    auth.canReadSessions && action === 'read' && subject === 'CashSession',
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { authStorage } from '@/features/auth/services/auth-storage'
import { cashApi } from '../../api/cash.api'
import { useCashSaleSession } from '../useCashSaleSession'

const api = cashApi as unknown as { listSessions: Mock }

const OPEN_UUID = '11111111-1111-4111-8111-111111111111'
const OPEN_UUID_2 = '22222222-2222-4222-8222-222222222222'
const COUNTING_UUID = '33333333-3333-4333-8333-333333333333'

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: OPEN_UUID,
    tenantId: 'tenant-1',
    registerId: 'r-1',
    status: 'OPEN',
    cashierUserId: 'user-1',
    openingCents: 0,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: false,
    ...overrides,
  }
}

function mountSession() {
  let result!: ReturnType<typeof useCashSaleSession>
  const TestComponent = defineComponent({
    setup() {
      result = useCashSaleSession()
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
  auth.user = { id: 'user-1' }
  auth.permissionCodes = ['read:CashSession']
  auth.permissionsLoaded = true
  auth.canReadSessions = true
  api.listSessions.mockResolvedValue({ items: [session()], page: 1, limit: 25, total: 1 })
})

enableAutoUnmount(afterEach)

describe('useCashSaleSession · authorization gate', () => {
  it('does not fetch without read:CashSession', async () => {
    auth.canReadSessions = false
    auth.permissionCodes = []
    const { result } = mountSession()
    await flush()

    expect(api.listSessions).not.toHaveBeenCalled()
    expect(result.canReadSessions.value).toBe(false)
    expect(result.availableSessions.value).toEqual([])
  })

  it('does not fetch without a resolved principal', async () => {
    auth.user = null
    mountSession()
    await flush()

    expect(api.listSessions).not.toHaveBeenCalled()
  })

  it('fetches only page/limit (no invented status or cashier filter)', async () => {
    mountSession()
    await flush()

    expect(api.listSessions).toHaveBeenCalledTimes(1)
    const params = api.listSessions.mock.calls[0]![0] as Record<string, unknown>
    expect(params).toEqual({ page: 1, limit: 25 })
    expect(params).not.toHaveProperty('status')
    expect(params).not.toHaveProperty('pendingOnly')
  })

  it('does not fetch when the public refetch is called without read:CashSession', async () => {
    auth.canReadSessions = false
    auth.permissionCodes = []
    const { result } = mountSession()
    await flush()
    expect(api.listSessions).not.toHaveBeenCalled()

    await result.refetch()
    await flush()

    expect(api.listSessions).not.toHaveBeenCalled()
  })

  it('does not fetch when the ability is revoked and refetch is called in the same tick', async () => {
    const { result } = mountSession()
    await flush()
    expect(api.listSessions).toHaveBeenCalledTimes(1)

    auth.permissionCodes = []
    auth.canReadSessions = false
    await result.refetch()
    await flush()
    await flush()

    expect(api.listSessions).toHaveBeenCalledTimes(1)
  })
})

describe('useCashSaleSession · authoritative revalidation (fail closed)', () => {
  it('clears an actual selection synchronously when permissions become unresolved', async () => {
    const { result } = mountSession()
    await flush()
    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    auth.permissionsLoaded = false

    expect(result.selectedId.value).toBeNull()
    expect(result.revalidateSelection()).toBe(false)
  })

  it('clears an actual selection synchronously when the read ability is revoked', async () => {
    const { result } = mountSession()
    await flush()
    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    auth.permissionCodes = []
    auth.canReadSessions = false

    expect(result.selectedId.value).toBeNull()
    expect(result.isSelectionEligible.value).toBe(false)
  })

  it('fails the live captured scope closed on a non-reactive same-principal lifecycle change, then clears', async () => {
    const { result } = mountSession()
    await flush()
    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    // `authStorage` generation is not reactive: synchronously the live guard
    // must already reject the old scope so a same-tick submit cannot emit it,
    // while the stored selection clears once the reactive identity observes the
    // transition (original identity-reset semantics).
    authStorage.setTokens({ accessToken: 'token-2', refreshToken: 'refresh-2' })
    expect(result.revalidateSelection()).toBe(false)

    auth.accessToken = 'token-2'
    await flush()
    await flush()
    expect(result.selectedId.value).toBeNull()
  })
})

describe('useCashSaleSession · own OPEN tenant filter', () => {
  it('offers only own, OPEN, current-tenant UUID rows', async () => {
    api.listSessions.mockResolvedValue({
      items: [
        session({ id: OPEN_UUID }),
        session({ id: COUNTING_UUID, status: 'COUNTING' }),
        session({ id: OPEN_UUID_2, cashierUserId: 'other-user' }),
        session({ id: 'not-a-uuid' }),
        session({ id: OPEN_UUID_2, tenantId: 'tenant-2' }),
      ],
      page: 1,
      limit: 25,
      total: 5,
    })
    const { result } = mountSession()
    await flush()

    expect(result.availableSessions.value.map((row) => row.id)).toEqual([OPEN_UUID])
  })

  it('never auto-selects the sole or first eligible session', async () => {
    const { result } = mountSession()
    await flush()

    expect(result.availableSessions.value).toHaveLength(1)
    expect(result.selectedId.value).toBeNull()
    expect(result.isSelectionEligible.value).toBe(false)
  })

  it('keeps the unfiltered total (all statuses) for honest paging', async () => {
    api.listSessions.mockResolvedValue({ items: [], page: 1, limit: 25, total: 42 })
    const { result } = mountSession()
    await flush()

    expect(result.total.value).toBe(42)
    expect(result.pageCount.value).toBe(2)
  })

  it('pages with the same page/limit contract; a selection the new page cannot show fails closed (never silently unbound)', async () => {
    api.listSessions.mockResolvedValue({
      items: [session({ id: OPEN_UUID })],
      page: 1,
      limit: 25,
      total: 30,
    })
    const { result } = mountSession()
    await flush()

    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    api.listSessions.mockResolvedValue({
      items: [session({ id: OPEN_UUID_2 })],
      page: 2,
      limit: 25,
      total: 30,
    })
    result.setPage(2)
    await flush()

    expect(api.listSessions).toHaveBeenLastCalledWith({ page: 2, limit: 25 })
    expect(result.availableSessions.value.map((row) => row.id)).toEqual([OPEN_UUID_2])
    // The selected id is preserved (an explicit opt-out is required) but it is
    // NOT eligible any more, so the caller must block the charge.
    expect(result.selectedId.value).toBe(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(false)
  })
})

describe('useCashSaleSession · selection validation', () => {
  it('accepts an eligible UUID and rejects foreign, non-OPEN, foreign-tenant and non-UUID ids', async () => {
    api.listSessions.mockResolvedValue({
      items: [
        session({ id: OPEN_UUID }),
        session({ id: OPEN_UUID_2, cashierUserId: 'other-user' }),
      ],
      page: 1,
      limit: 25,
      total: 2,
    })
    const { result } = mountSession()
    await flush()

    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    result.selectSession(OPEN_UUID_2)
    expect(result.selectedId.value).toBe(OPEN_UUID_2)
    expect(result.isSelectionEligible.value).toBe(false)
    expect(result.availableSessions.value.map((row: { id: string }) => row.id)).not.toContain(
      OPEN_UUID_2,
    )

    result.selectSession('not-a-uuid')
    expect(result.isSelectionEligible.value).toBe(false)

    result.selectSession('')
    expect(result.selectedId.value).toBeNull()
  })

  it('fails closed when the list refreshes to a row set without the selection', async () => {
    const { result } = mountSession()
    await flush()

    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    // The backend now reports the session as COUNTING — no longer selectable.
    api.listSessions.mockResolvedValue({
      items: [session({ id: OPEN_UUID, status: 'COUNTING' })],
      page: 1,
      limit: 25,
      total: 1,
    })
    await result.refetch()
    await flush()

    expect(result.selectedId.value).toBe(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(false)
  })
})

describe('useCashSaleSession · identity lifecycle', () => {
  it('clears the selection on a permission change and does not fetch again without the ability', async () => {
    const { result } = mountSession()
    await flush()
    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    auth.permissionCodes = []
    auth.canReadSessions = false
    await flush()
    await flush()

    expect(result.selectedId.value).toBeNull()
    expect(result.canReadSessions.value).toBe(false)
    expect(api.listSessions).toHaveBeenCalledTimes(1)
  })

  it('clears the selection on logout/login for the same principal', async () => {
    api.listSessions.mockResolvedValue({ items: [session()], page: 1, limit: 25, total: 1 })
    const { result } = mountSession()
    await flush()
    result.selectSession(OPEN_UUID)
    expect(result.isSelectionEligible.value).toBe(true)

    // Same user, tenant and permissions — a NEW session lifecycle.
    auth.accessToken = 'token-2'
    authStorage.setTokens({ accessToken: 'token-2', refreshToken: 'refresh-2' })
    await flush()
    await flush()

    expect(result.selectedId.value).toBeNull()
  })

  it('clears the selection when the same-tenant user switches', async () => {
    const { result } = mountSession()
    await flush()
    result.selectSession(OPEN_UUID)

    auth.user = { id: 'user-2' }
    await flush()
    await flush()

    expect(result.selectedId.value).toBeNull()
  })
})
