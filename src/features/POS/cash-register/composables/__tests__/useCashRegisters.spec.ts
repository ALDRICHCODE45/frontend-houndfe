/**
 * useCashRegisters — the "complete flow including register commands" the parent
 * asked to cover:
 *   - the list slot is principal-scoped (tenant + user + permission generation),
 *     so a same-tenant user switch refetches instead of reusing a slot;
 *   - a register command is refused up-front without an active tenant/user;
 *   - an in-flight result that returns after the principal changed is DISCARDED
 *     and never invalidates the new principal's caches;
 *   - the attempt key is scoped to the actor and reset only on confirmed success;
 *   - a refresh failure after an authoritative success is not a command failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'

vi.mock('../../api/cash.api', () => ({
  cashApi: { listRegisters: vi.fn(), createRegister: vi.fn(), updateRegister: vi.fn() },
}))

const auth = reactive({
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: ['read:CashRegister', 'create:CashRegister'] as string[],
  permissionsLoaded: true,
  userCan: vi.fn(),
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { cashApi } from '../../api/cash.api'
import { useCashRegisters } from '../useCashRegisters'

const api = cashApi as unknown as {
  listRegisters: Mock
  createRegister: Mock
  updateRegister: Mock
}

function mountRegisters() {
  let registers!: ReturnType<typeof useCashRegisters>
  const TestComponent = defineComponent({
    setup() {
      registers = useCashRegisters()
      return () => h('div')
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { registers, queryClient, invalidateSpy, wrapper }
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

/** `createRegister(body, idempotencyKey)` / `updateRegister(id, body, key)`. */
const CREATE_KEY_SLOT = 1
const UPDATE_KEY_SLOT = 2

enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.clearAllMocks()
  auth.currentTenantId = 'tenant-1'
  auth.user = { id: 'user-1' }
  auth.permissionCodes = ['read:CashRegister', 'create:CashRegister']
  auth.permissionsLoaded = true
  auth.userCan.mockImplementation(
    (action: string, subject: string) => action === 'read' && subject === 'CashRegister',
  )
  api.listRegisters.mockResolvedValue([])
  api.createRegister.mockResolvedValue({ id: 'r-1', name: 'Caja', isActive: true })
  api.updateRegister.mockResolvedValue({ id: 'r-1', name: 'Caja', isActive: false })
})

describe('useCashRegisters · principal-scoped list', () => {
  it('does NOT reuse another user’s registers after a same-tenant user switch', async () => {
    mountRegisters()
    await flush()
    expect(api.listRegisters).toHaveBeenCalledTimes(1)

    auth.user = { id: 'user-2' }
    await flush()
    await flush()

    expect(api.listRegisters).toHaveBeenCalledTimes(2)
  })

  it('does not query without an active user', async () => {
    auth.user = null
    mountRegisters()
    await flush()

    expect(api.listRegisters).not.toHaveBeenCalled()
  })
})

describe('useCashRegisters · command identity', () => {
  it('refuses a command without an active tenant, without calling the API', async () => {
    const { registers } = mountRegisters()
    auth.currentTenantId = ''

    await expect(registers.createRegister({ name: 'Caja' })).rejects.toThrow(
      /sesión no está activa/i,
    )
    expect(api.createRegister).not.toHaveBeenCalled()
  })

  it('refuses a command without an active user, without calling the API', async () => {
    const { registers } = mountRegisters()
    auth.user = null

    await expect(registers.updateRegister('r-1', { isActive: false })).rejects.toThrow(
      /sesión no está activa/i,
    )
    expect(api.updateRegister).not.toHaveBeenCalled()
  })

  it('discards an in-flight result when the user changes within the same tenant', async () => {
    const { registers, invalidateSpy } = mountRegisters()
    const pending = deferred<unknown>()
    api.createRegister.mockReturnValueOnce(pending.promise)

    const inFlight = registers.createRegister({ name: 'Caja' })
    auth.user = { id: 'user-2' }
    pending.resolve({ id: 'r-1' })

    await expect(inFlight).rejects.toThrow(/sesión cambió/i)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('scopes the attempt key to the actor and resets it on success', async () => {
    const { registers } = mountRegisters()

    await registers.createRegister({ name: 'Caja' })
    auth.user = { id: 'user-2' }
    await registers.createRegister({ name: 'Caja' })
    auth.user = { id: 'user-1' }
    await registers.createRegister({ name: 'Caja' })

    const keys = api.createRegister.mock.calls.map((call) => call[CREATE_KEY_SLOT])
    expect(new Set(keys).size).toBe(3)
  })

  it('keeps the same key after a failure so the retry replays the attempt', async () => {
    const { registers } = mountRegisters()
    api.updateRegister.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({})

    await expect(registers.updateRegister('r-1', { isActive: false })).rejects.toThrow('boom')
    await registers.updateRegister('r-1', { isActive: false })

    const [first, second] = api.updateRegister.mock.calls.map((call) => call[UPDATE_KEY_SLOT])
    expect(first).toBe(second)
  })

  it('discards the result when the identity changes DURING the cache refresh', async () => {
    const { registers, invalidateSpy } = mountRegisters()
    invalidateSpy.mockImplementation(async () => {
      auth.user = { id: 'user-2' }
    })

    await expect(registers.createRegister({ name: 'Caja' })).rejects.toThrow(/sesión cambió/i)
  })

  it('reports the success when the cache refresh fails', async () => {
    const { registers, invalidateSpy } = mountRegisters()
    invalidateSpy.mockRejectedValueOnce(new Error('refresh failed'))

    await expect(registers.createRegister({ name: 'Caja' })).resolves.toBeDefined()
  })
})
