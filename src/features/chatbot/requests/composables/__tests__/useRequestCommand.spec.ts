import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { axiosError, withQuery } from './withQuery'
import type { ChatbotRequestCommandResponse } from '../../interfaces/chatbot-request.types'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: {
    claim: vi.fn(),
    release: vi.fn(),
    reassign: vi.fn(),
    cancel: vi.fn(),
    merge: vi.fn(),
    linkCustomer: vi.fn(),
    resolve: vi.fn(),
  },
}))

const auth = vi.hoisted(() => ({ tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: () => true,
  }),
}))

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import { chatbotRequestKeys } from '../../constants/queryKeys'
import { useRequestCommand } from '../useRequestCommand'

const api = vi.mocked(chatbotRequestApi)

const response = (version = 2): ChatbotRequestCommandResponse => ({
  request: {
    id: 'req-1',
    folio: 'S-000123',
    kind: 'DECISION',
    subtype: 'RESTOCK',
    status: 'IN_PROGRESS',
    displayStatus: 'IN_PROGRESS',
    version,
    assignee: { id: 'u-1', displayName: 'Laura' },
    claimedAt: '2026-11-11T17:00:00.000Z',
    overdueAt: null,
    closedAt: null,
  },
})

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = withQuery(() => useRequestCommand(), client)
  return { command: result, invalidate }
}

const keyOf = (call: number) => api.claim.mock.calls[call]![2]

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  auth.tenantId = 'tenant-1'
})

describe('useRequestCommand — idempotency key lifecycle', () => {
  it('sends the command with a uuid Idempotency-Key and the body of the contract', async () => {
    api.claim.mockResolvedValue(response())
    const { command } = setup()

    const outcome = await command.claim('req-1', { expectedVersion: 1 })

    expect(outcome.status).toBe('done')
    expect(api.claim).toHaveBeenCalledWith('req-1', { expectedVersion: 1 }, expect.stringMatching(/^[0-9a-f-]{36}$/))
  })

  it('reuses the key when the same attempt is retried after a network error', async () => {
    api.claim.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(response())
    const { command } = setup()

    const first = await command.claim('req-1', { expectedVersion: 1 })
    expect(first.status).toBe('failed')
    const retry = await command.claim('req-1', { expectedVersion: 1 })

    expect(retry.status).toBe('done')
    expect(keyOf(1)).toBe(keyOf(0))
  })

  it('reuses the key after a 5xx, whose answer is unknown', async () => {
    api.claim.mockRejectedValueOnce(axiosError(500, { code: 'INTERNAL_ERROR' })).mockResolvedValueOnce(response())
    const { command } = setup()

    await command.claim('req-1', { expectedVersion: 1 })
    await command.claim('req-1', { expectedVersion: 1 })

    expect(keyOf(1)).toBe(keyOf(0))
  })

  it('opens a new attempt (new key) when the body changes', async () => {
    api.claim.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(response())
    const { command } = setup()

    await command.claim('req-1', { expectedVersion: 1 })
    await command.claim('req-1', { expectedVersion: 2 })

    expect(keyOf(1)).not.toBe(keyOf(0))
  })

  it('resets the key after a success: the next click is a new attempt', async () => {
    api.claim.mockResolvedValue(response())
    const { command } = setup()

    await command.claim('req-1', { expectedVersion: 1 })
    await command.claim('req-1', { expectedVersion: 1 })

    expect(keyOf(1)).not.toBe(keyOf(0))
  })

  it('resets the key after a typed 409 (a new attempt needs a new key)', async () => {
    api.claim
      .mockRejectedValueOnce(axiosError(409, { code: 'VERSION_CONFLICT', current: { version: 2 } }))
      .mockResolvedValueOnce(response())
    const { command } = setup()

    await command.claim('req-1', { expectedVersion: 1 })
    await command.claim('req-1', { expectedVersion: 1 })

    expect(keyOf(1)).not.toBe(keyOf(0))
  })

  it('resets the key after IDEMPOTENCY_CONFLICT and after a 422', async () => {
    api.claim
      .mockRejectedValueOnce(axiosError(409, { code: 'IDEMPOTENCY_CONFLICT' }))
      .mockRejectedValueOnce(axiosError(422, { code: 'ACTION_NOT_ALLOWED' }))
      .mockResolvedValueOnce(response())
    const { command } = setup()

    await command.claim('req-1', { expectedVersion: 1 })
    await command.claim('req-1', { expectedVersion: 1 })
    await command.claim('req-1', { expectedVersion: 1 })

    expect(new Set([keyOf(0), keyOf(1), keyOf(2)]).size).toBe(3)
  })

  it('does not share a key between requests or between commands', async () => {
    api.claim.mockRejectedValue(new Error('Network Error'))
    api.release.mockRejectedValue(new Error('Network Error'))
    const { command } = setup()

    await command.claim('req-1', { expectedVersion: 1 })
    await command.claim('req-2', { expectedVersion: 1 })
    await command.release('req-1', { expectedVersion: 1 })

    expect(keyOf(1)).not.toBe(keyOf(0))
    expect(api.release.mock.calls[0]![2]).not.toBe(keyOf(0))
  })
})

describe('useRequestCommand — in flight', () => {
  it('ignores a submit while one is pending and reports isPending', async () => {
    let finish!: (value: ChatbotRequestCommandResponse) => void
    api.claim.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const { command } = setup()

    const first = command.claim('req-1', { expectedVersion: 1 })
    expect(command.isPending.value).toBe(true)
    const second = await command.claim('req-1', { expectedVersion: 1 })

    expect(second).toEqual({ status: 'ignored' })
    expect(api.claim).toHaveBeenCalledTimes(1)

    finish(response())
    expect((await first).status).toBe('done')
    expect(command.isPending.value).toBe(false)
  })

  it('is no longer pending after a failure', async () => {
    api.claim.mockRejectedValue(new Error('Network Error'))
    const { command } = setup()
    await command.claim('req-1', { expectedVersion: 1 })
    expect(command.isPending.value).toBe(false)
  })
})

describe('useRequestCommand — invalidation', () => {
  const all = () => ({ queryKey: chatbotRequestKeys.all('tenant-1') })

  it('refreshes the whole feature key after a success', async () => {
    api.claim.mockResolvedValue(response())
    const { command, invalidate } = setup()
    await command.claim('req-1', { expectedVersion: 1 })
    await flushPromises()
    expect(invalidate).toHaveBeenCalledWith(all())
  })

  it('refreshes after a state-changing error so the detail shows what changed', async () => {
    api.claim.mockRejectedValue(
      axiosError(409, { code: 'REQUEST_CLAIMED_BY_OTHER', current: { claimedBy: { id: 'u-2', displayName: 'Ana' } } }),
    )
    const { command, invalidate } = setup()
    await command.claim('req-1', { expectedVersion: 1 })
    expect(invalidate).toHaveBeenCalledWith(all())
  })

  it('does not refresh after validation, permission, network or server errors', async () => {
    const { command, invalidate } = setup()
    for (const failure of [
      axiosError(400, { code: 'VALIDATION_ERROR' }),
      axiosError(403, { code: 'INSUFFICIENT_PERMISSIONS' }),
      axiosError(422, { code: 'USER_NOT_ASSIGNABLE' }),
      axiosError(500, { code: 'INTERNAL_ERROR' }),
      new Error('Network Error'),
    ]) {
      api.reassign.mockRejectedValueOnce(failure)
      await command.reassign('req-1', { expectedVersion: 2, toUserId: 'u-3' })
    }
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('scopes the refresh to the tenant', async () => {
    auth.tenantId = 'tenant-9'
    api.claim.mockResolvedValue(response())
    const { command, invalidate } = setup()
    await command.claim('req-1', { expectedVersion: 1 })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatbotRequestKeys.all('tenant-9') })
  })
})

describe('useRequestCommand — error state', () => {
  it('keeps the typed error with its current patch, and clears it on the next run', async () => {
    api.claim
      .mockRejectedValueOnce(
        axiosError(409, { code: 'REQUEST_CLAIMED_BY_OTHER', current: { version: 5, claimedBy: { id: 'u-2', displayName: 'Ana López' } } }),
      )
      .mockResolvedValueOnce(response())
    const { command } = setup()

    const outcome = await command.claim('req-1', { expectedVersion: 1 })
    expect(outcome.status === 'failed' && outcome.error.code).toBe('REQUEST_CLAIMED_BY_OTHER')
    expect(command.error.value?.current?.claimedBy?.displayName).toBe('Ana López')

    await command.claim('req-1', { expectedVersion: 5 })
    expect(command.error.value).toBeNull()
  })

  it('clearError and reset forget the error and the open attempt', async () => {
    api.claim.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(response())
    const { command } = setup()
    await command.claim('req-1', { expectedVersion: 1 })
    expect(command.error.value).not.toBeNull()

    command.reset()
    expect(command.error.value).toBeNull()
    await command.claim('req-1', { expectedVersion: 1 })
    expect(keyOf(1)).not.toBe(keyOf(0))
  })
})

describe('useRequestCommand — every command goes through its api call with the body unchanged', () => {
  it('routes cancel, reassign, merge, link and resolve', async () => {
    for (const fn of [api.cancel, api.reassign, api.merge, api.linkCustomer, api.resolve, api.release]) {
      fn.mockResolvedValue(response())
    }
    const { command } = setup()

    await command.cancel('req-1', { expectedVersion: 1, reason: 'DUPLICATE' })
    await command.reassign('req-1', { expectedVersion: 2, toUserId: 'u-3', note: 'Turno' })
    await command.merge('req-1', { expectedVersion: 2, intoRequestId: 'req-9', intoExpectedVersion: 4 })
    await command.linkCustomer('req-1', { expectedVersion: 1, customerId: 'cus-7' })
    await command.resolve('req-1', { expectedVersion: 1, action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 7 })
    await command.release('req-1', { expectedVersion: 2 })

    expect(api.cancel).toHaveBeenCalledWith('req-1', { expectedVersion: 1, reason: 'DUPLICATE' }, expect.any(String))
    expect(api.reassign).toHaveBeenCalledWith('req-1', { expectedVersion: 2, toUserId: 'u-3', note: 'Turno' }, expect.any(String))
    expect(api.merge).toHaveBeenCalledWith('req-1', { expectedVersion: 2, intoRequestId: 'req-9', intoExpectedVersion: 4 }, expect.any(String))
    expect(api.linkCustomer).toHaveBeenCalledWith('req-1', { expectedVersion: 1, customerId: 'cus-7' }, expect.any(String))
    expect(api.resolve).toHaveBeenCalledWith('req-1', { expectedVersion: 1, action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 7 }, expect.any(String))
    expect(api.release).toHaveBeenCalledWith('req-1', { expectedVersion: 2 }, expect.any(String))
  })
})
