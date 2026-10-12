/**
 * useCashSessionCommands — command disciplines that protect the principal:
 *   - a stable Idempotency-Key per ATTEMPT, scoped to actor+context+body and
 *     reset only after a confirmed success, BEFORE the refetch;
 *   - the session identity (tenant + user + permission generation) is captured
 *     BEFORE the request and re-checked after it, so a same-tenant logout/login
 *     never lets an old result reach the new user's forms, nor invalidates the
 *     new user's caches;
 *   - a command is rejected up-front when there is no active tenant/user;
 *   - a cache-refresh failure after an authoritative success must NOT surface as
 *     a command failure (which would invite a duplicate re-issue).
 *
 * The API module is mocked: this proves UI/cache behaviour, NOT live backend
 * integration.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'

vi.mock('../../api/cash.api', () => ({
  cashApi: {
    listRegisters: vi.fn(),
    createRegister: vi.fn(),
    updateRegister: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    openSession: vi.fn(),
    startCount: vi.fn(),
    declare: vi.fn(),
    appendNotes: vi.fn(),
    verify: vi.fn(),
    cashIn: vi.fn(),
    cashOut: vi.fn(),
    declareHandover: vi.fn(),
    receiveHandover: vi.fn(),
    getCustody: vi.fn(),
    releaseDrawer: vi.fn(),
  },
}))

const auth = reactive({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: ['create:CashIn'] as string[],
  permissionsLoaded: true,
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { authStorage } from '@/features/auth/services/auth-storage'
import { cashApi } from '../../api/cash.api'
import { useCashSessionCommands } from '../useCashSessionCommands'

interface CashApiMock {
  listRegisters: Mock
  createRegister: Mock
  updateRegister: Mock
  listSessions: Mock
  getSession: Mock
  openSession: Mock
  startCount: Mock
  declare: Mock
  appendNotes: Mock
  verify: Mock
  cashIn: Mock
  cashOut: Mock
  declareHandover: Mock
  receiveHandover: Mock
  getCustody: Mock
  releaseDrawer: Mock
}

const api = cashApi as unknown as CashApiMock

function mountCommands() {
  let commands!: ReturnType<typeof useCashSessionCommands>
  const TestComponent = defineComponent({
    setup() {
      commands = useCashSessionCommands()
      return () => h('div')
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { commands, queryClient, invalidateSpy, wrapper }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** `cashIn(sessionId, body, idempotencyKey)` — the key is the 3rd argument. */
const KEY_SLOT = 2

beforeEach(() => {
  vi.clearAllMocks()
  auth.accessToken = 'token-1'
  auth.currentTenantId = 'tenant-1'
  auth.user = { id: 'user-1' }
  auth.permissionCodes = ['create:CashIn']
  auth.permissionsLoaded = true
  for (const fn of Object.values(api)) fn.mockResolvedValue({})
})

// Every mounted test component is unmounted so its query observers cannot leak
// into the next test (the auth stub is a module-level reactive shared by all of them).
enableAutoUnmount(afterEach)

describe('useCashSessionCommands · stable per-attempt keys', () => {
  it('never reuses a key for a different actor or a changed body', async () => {
    const { commands } = mountCommands()

    await commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })
    auth.user = { id: 'user-2' }
    await commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })
    auth.user = { id: 'user-1' }
    await commands.cashIn('s-1', { amountCents: 3000, reason: 'Cambio' })

    const keys = api.cashIn.mock.calls.map((call) => call[KEY_SLOT])
    expect(new Set(keys).size).toBe(3)
  })

  it('keeps the SAME key after a failure so a retry replays the same attempt', async () => {
    const { commands } = mountCommands()
    api.cashIn.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({})

    await expect(commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })).rejects.toThrow(
      'boom',
    )
    await commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })

    const [first, second] = api.cashIn.mock.calls.map((call) => call[KEY_SLOT])
    expect(first).toBe(second)
  })

  it('sends the declared FLOAT/WITHDRAWAL body untouched', async () => {
    const { commands } = mountCommands()
    await commands.declareHandover('s-1', {
      handoverKind: 'FLOAT',
      recipientUserId: 'recipient-1',
      declaredCents: 50000,
    })
    expect(api.declareHandover.mock.calls[0]![0]).toBe('s-1')
    expect(api.declareHandover.mock.calls[0]![1]).toEqual({
      handoverKind: 'FLOAT',
      recipientUserId: 'recipient-1',
      declaredCents: 50000,
    })
  })
})

describe('useCashSessionCommands · active-identity gate', () => {
  it('rejects WITHOUT calling the API when there is no active tenant', async () => {
    const { commands } = mountCommands()
    auth.currentTenantId = ''

    await expect(commands.cashIn('s-1', { amountCents: 1, reason: 'x' })).rejects.toThrow(
      /sesión no está activa/i,
    )
    expect(api.cashIn).not.toHaveBeenCalled()
  })

  it('rejects WITHOUT calling the API when there is no active user', async () => {
    const { commands } = mountCommands()
    auth.user = null

    await expect(commands.releaseDrawer('s-1')).rejects.toThrow(/sesión no está activa/i)
    expect(api.releaseDrawer).not.toHaveBeenCalled()
  })
})

describe('useCashSessionCommands · stale results after an identity change', () => {
  it('discards an in-flight result when the user changes within the same tenant', async () => {
    const { commands, invalidateSpy } = mountCommands()
    const pending = deferred<unknown>()
    api.cashIn.mockReturnValueOnce(pending.promise)

    const inFlight = commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })
    auth.user = { id: 'user-2' }
    pending.resolve({ id: 'm-1' })

    await expect(inFlight).rejects.toThrow(/sesión cambió/i)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('discards an in-flight result when the permission generation changes', async () => {
    const { commands, invalidateSpy } = mountCommands()
    const pending = deferred<unknown>()
    api.declare.mockReturnValueOnce(pending.promise)

    const inFlight = commands.declare('s-1', { lines: [{ channelKey: 'CASH', amountCents: 0 }] })
    auth.permissionCodes = ['create:CashIn', 'read:CashSessionAudit']
    pending.resolve({})

    await expect(inFlight).rejects.toThrow(/sesión cambió/i)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('discards an in-flight result across a same-identity logout/login (new session lifecycle)', async () => {
    const { commands, invalidateSpy } = mountCommands()
    const pending = deferred<unknown>()
    api.cashIn.mockReturnValueOnce(pending.promise)

    const inFlight = commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })
    // Identical principal and permissions, but a NEW session lifecycle.
    auth.accessToken = 'token-2'
    authStorage.setTokens({ accessToken: 'token-2', refreshToken: 'token-2-refresh' })
    pending.resolve({ id: 'm-1' })

    await expect(inFlight).rejects.toThrow(/sesión cambió/i)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('discards the result when the identity changes DURING the cache refresh', async () => {
    const { commands, invalidateSpy } = mountCommands()
    // The refresh is an async continuation too: a switch while it is awaited must
    // not hand the completed result to whoever is active now.
    invalidateSpy.mockImplementation(async () => {
      auth.user = { id: 'user-2' }
    })

    await expect(
      commands.declare('s-1', { lines: [{ channelKey: 'CASH', amountCents: 0 }] }),
    ).rejects.toThrow(/sesión cambió/i)
  })

  it('discards an in-flight result after a logout (no tenant)', async () => {
    const { commands, invalidateSpy } = mountCommands()
    const pending = deferred<unknown>()
    api.declare.mockReturnValueOnce(pending.promise)

    const inFlight = commands.declare('s-1', { lines: [{ channelKey: 'CASH', amountCents: 0 }] })
    auth.currentTenantId = ''
    pending.resolve({})

    await expect(inFlight).rejects.toThrow(/sesión cambió/i)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('still invalidates the captured principal’s caches on an unchanged success', async () => {
    const { commands, invalidateSpy } = mountCommands()
    await commands.declare('s-1', { lines: [{ channelKey: 'CASH', amountCents: 0 }] })

    const keys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    // ['cash', tenantId, userId, permissionFingerprint, generation, 'sessions', 'list']
    expect(keys).toContainEqual([
      'cash',
      'tenant-1',
      'user-1',
      expect.any(String),
      expect.any(String),
      'sessions',
      'list',
    ])
  })
})

describe('useCashSessionCommands · overlapping entry is refused', () => {
  it('does not dispatch a second command while one is still in flight', async () => {
    const { commands } = mountCommands()
    const pending = deferred<unknown>()
    api.cashIn.mockReturnValueOnce(pending.promise)

    const first = commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })
    await expect(commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })).rejects.toThrow(
      /en curso/i,
    )
    expect(api.cashIn).toHaveBeenCalledTimes(1)

    pending.resolve({})
    await first
  })

  it('does not create a second command when a duplicate click lands during the REFRESH (after the attempt reset)', async () => {
    const { commands, invalidateSpy } = mountCommands()
    const refresh = deferred<unknown>()
    invalidateSpy.mockImplementation(async () => {
      await refresh.promise
    })

    const first = commands.declare('s-1', { lines: [{ channelKey: 'CASH', amountCents: 0 }] })
    await flush()

    // The attempt was already reset and the refetch is still awaited.
    await expect(
      commands.declare('s-1', { lines: [{ channelKey: 'CASH', amountCents: 0 }] }),
    ).rejects.toThrow(/en curso/i)
    expect(api.declare).toHaveBeenCalledTimes(1)

    refresh.resolve({})
    await first
  })

  it('releases the busy state after a failed command so the retry is allowed', async () => {
    const { commands } = mountCommands()
    api.cashOut.mockRejectedValueOnce(new Error('boom'))

    await expect(commands.cashOut('s-1', { amountCents: 1, reason: 'x' })).rejects.toThrow('boom')
    await commands.cashOut('s-1', { amountCents: 1, reason: 'x' })

    expect(api.cashOut).toHaveBeenCalledTimes(2)
  })
})

describe('useCashSessionCommands · authoritative success vs refresh failure', () => {
  it('reports the success (does not reject) when the cache refresh fails', async () => {
    const { commands, invalidateSpy } = mountCommands()
    invalidateSpy.mockRejectedValueOnce(new Error('refresh failed'))

    await expect(
      commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' }),
    ).resolves.toBeDefined()
  })

  it('resets the attempt on success BEFORE the refetch, so a later identical command is not confused with the completed one', async () => {
    const { commands, invalidateSpy } = mountCommands()
    invalidateSpy.mockRejectedValueOnce(new Error('refresh failed'))

    await commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })
    await commands.cashIn('s-1', { amountCents: 2500, reason: 'Cambio' })

    const [first, second] = api.cashIn.mock.calls.map((call) => call[KEY_SLOT])
    expect(first).not.toBe(second)
  })

  it('opens a session with openingConfirmed forced to literal true', async () => {
    const { commands } = mountCommands()
    await commands.openSession('r-1', { openingCents: 50000, openingHandoverId: 'f-1' })
    expect(api.openSession.mock.calls[0]![0]).toBe('r-1')
    expect(api.openSession.mock.calls[0]![1]).toEqual({
      openingCents: 50000,
      openingConfirmed: true,
      openingHandoverId: 'f-1',
    })
  })
})
