import { effectScope, shallowRef } from 'vue'
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { useSupplierCommands } from '../useSupplierCommands'

// Real shared HTTP client and supplier adapter: only the transport and the
// credential refresh endpoint are faked, so the refresh/replay interceptor runs.
vi.mock('@/features/auth/services/auth-storage', () => ({
  authStorage: {
    getAccessToken: vi.fn(() => 'access-token'),
    getRefreshToken: vi.fn(() => 'refresh-token'),
    getSessionGeneration: vi.fn(() => 0),
    commitRotation: vi.fn((generation, tokens) => ({ ...tokens, generation })),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}))
vi.mock('@/features/auth/services/session-events', () => ({ emitSessionExpired: vi.fn() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ setSessionFromTokens: vi.fn(), applySessionRotation: vi.fn() }),
}))

const originalAdapter = http.defaults.adapter
function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
    status: 401, statusText: 'Unauthorized', headers: {}, config, data: { message: 'Token expired' },
  })
}
function setup() {
  const context = shallowRef({ userId: 'user-1', tenantId: 'branch-1', ready: true, canCreate: true, canUpdate: true, canDelete: true })
  const scope = effectScope()
  const owner = scope.run(() => useSupplierCommands(context))!
  return { context, scope, owner }
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})
afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('supplier deletion through the shared credential-refresh replay', () => {
  it('replays the same confirmed request once after refresh while the context is unchanged', async () => {
    const sent: InternalAxiosRequestConfig[] = []
    http.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      sent.push(config)
      if (sent.length === 1) throw unauthorized(config)
      return { data: '', status: 204, statusText: 'No Content', headers: {}, config }
    })
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } })
    const { owner, scope } = setup()
    expect(await owner.delete('supplier-1', { expectedVersion: 2 })).toEqual({ status: 'deleted', id: 'supplier-1' })
    expect(sent).toHaveLength(2)
    expect(sent[1]!.headers['Idempotency-Key']).toBe(sent[0]!.headers['Idempotency-Key'])
    expect(sent[1]!.method).toBe('delete')
    scope.stop()
  })

  it.each(['ready', 'permission'] as const)('does not replay DELETE when %s retires the context during refresh', async (change) => {
    const sent: InternalAxiosRequestConfig[] = []
    http.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      sent.push(config)
      throw unauthorized(config)
    })
    let finishRefresh!: (value: unknown) => void
    const refreshing = new Promise(resolve => { finishRefresh = resolve })
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(refreshing as never)
    const { owner, context, scope } = setup()
    const result = owner.delete('supplier-1', { expectedVersion: 2 })
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    context.value = { ...context.value, ...(change === 'ready' ? { ready: false } : { canDelete: false }) }
    finishRefresh({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } })
    expect(await result).toEqual({ status: 'discarded' })
    expect(sent).toHaveLength(1)
    scope.stop()
  })
})
