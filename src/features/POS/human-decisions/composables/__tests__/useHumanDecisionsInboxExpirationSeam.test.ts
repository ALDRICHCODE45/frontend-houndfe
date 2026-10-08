/**
 * EXPIRATION inbox↔owner integration seam.
 *
 * Mounts the REAL inbox over the REAL list/detail query composables and the REAL
 * EXPIRATION owner with an isolated real QueryClient per case. Only the HTTP
 * boundary (`human-decision.api`) is replaced; it exposes exactly the four used
 * methods and throws on any unexpected call, so nothing can reach the network.
 * Auth/permission state is a controlled reactive fixture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { humanDecisionApi } from '../../api/human-decision.api'
import {
  pendingExpiration,
  provideExpiration,
  resolvedExpiration,
  unavailableExpiration,
} from '../../interfaces/__tests__/expirationDecision.fixture'
import type { ResolvedExpirationDecision } from '../../interfaces/expiration-decision.types'
import { useHumanDecisionsInbox } from '../useHumanDecisionsInbox'

vi.mock('../../api/human-decision.api', () => ({
  humanDecisionApi: {
    list: vi.fn(),
    getById: vi.fn(),
    resolve: vi.fn(),
    resolveExpiration: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: vi.fn() }))

const detailKey = humanDecisionQueryKeys.detail('tenant-1', 'exp-1')
const report = { action: 'REPORT_EXPIRATION_UNAVAILABLE', expectedVersion: 1 } as const

const authTenantId = ref('tenant-1')
const authUser = ref<{ id: string } | null>({ id: 'user-1' })
const canUpdate = ref(true)
const authStore = reactive({
  user: authUser,
  currentTenantId: authTenantId,
  userCan: () => canUpdate.value,
})

type Inbox = ReturnType<typeof useHumanDecisionsInbox>
type Harness = { inbox: Inbox; queryClient: QueryClient }
const wrappers: Array<{ unmount: () => void }> = []
const clients: QueryClient[] = []

function mountInbox(): Harness {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  clients.push(queryClient)
  let inbox!: Inbox
  const Host = defineComponent({
    setup: () => {
      inbox = useHumanDecisionsInbox()
      return () => h('div')
    },
  })
  wrappers.push(mount(Host, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return { inbox, queryClient }
}

async function openDetailReady(harness: Harness): Promise<void> {
  harness.inbox.openDetail('exp-1')
  await vi.waitFor(() => expect(harness.inbox.detail.data.value).toEqual(pendingExpiration))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => (resolve = res))
  return { promise, resolve }
}

describe('useHumanDecisionsInbox ↔ EXPIRATION owner seam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authTenantId.value = 'tenant-1'
    authUser.value = { id: 'user-1' }
    canUpdate.value = true
    vi.mocked(useAuthStore).mockReturnValue(authStore as never)
    vi.mocked(humanDecisionApi.list).mockResolvedValue({
      data: [pendingExpiration],
      pagination: { pageIndex: 0, pageSize: 20, totalCount: 1, pageCount: 1 },
    })
    vi.mocked(humanDecisionApi.getById).mockImplementation(async (id: string) => {
      if (id === 'exp-1') return pendingExpiration
      throw new Error(`unexpected getById(${id})`)
    })
    // No case may reach the transport without configuring its own response.
    vi.mocked(humanDecisionApi.resolve).mockImplementation(async () => {
      throw new Error('unexpected resolve call')
    })
    vi.mocked(humanDecisionApi.resolveExpiration).mockImplementation(async () => {
      throw new Error('unexpected resolveExpiration call')
    })
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    clients.splice(0).forEach((client) => client.clear())
    vi.restoreAllMocks()
  })

  it('writes the resolution into the detail cache and feedback without extra reads', async () => {
    const harness = mountInbox()
    await openDetailReady(harness)
    const expected = resolvedExpiration(unavailableExpiration)
    vi.mocked(humanDecisionApi.resolveExpiration).mockResolvedValue(expected)

    await harness.inbox.resolveExpirationDecision(report)

    const call = vi.mocked(humanDecisionApi.resolveExpiration)
    expect(call).toHaveBeenCalledTimes(1)
    expect(call.mock.calls[0]![0]).toBe('exp-1')
    expect(harness.inbox.expirationSucceeded.value).toBe(true)
    expect(harness.inbox.expirationErrorMessage.value).toBeNull()
    expect(harness.inbox.expirationConflict.value).toBe(false)
    expect(harness.inbox.detail.data.value).toEqual(expected)
    expect(harness.queryClient.getQueryData(detailKey)).toEqual(expected)
    expect(vi.mocked(humanDecisionApi.getById)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(humanDecisionApi.list)).toHaveBeenCalledTimes(1)
  })

  it('maps 401 to reauthentication feedback and keeps the pending cache intact', async () => {
    const harness = mountInbox()
    await openDetailReady(harness)
    vi.mocked(humanDecisionApi.resolveExpiration).mockRejectedValue({
      response: { status: 401, data: { code: 'UNAUTHORIZED' } },
    })

    await harness.inbox.resolveExpirationDecision(report)

    expect(harness.inbox.expirationRequiresReauthentication.value).toBe(true)
    expect(harness.inbox.expirationErrorMessage.value).toContain('sesión expiró')
    expect(harness.inbox.expirationSucceeded.value).toBe(false)
    expect(harness.inbox.expirationConflict.value).toBe(false)
    expect(harness.queryClient.getQueryData(detailKey)).toEqual(pendingExpiration)
    expect(harness.inbox.detail.data.value).toEqual(pendingExpiration)
  })

  it.each(['VERSION_CONFLICT', 'ALREADY_RESOLVED'] as const)(
    'maps %s to read-only conflict feedback and blocks a retry',
    async (code) => {
      const harness = mountInbox()
      await openDetailReady(harness)
      vi.mocked(humanDecisionApi.resolveExpiration).mockRejectedValue({
        response: { status: 409, data: { code } },
      })

      await harness.inbox.resolveExpirationDecision(report)

      expect(harness.inbox.expirationConflict.value).toBe(true)
      expect(harness.inbox.expirationErrorMessage.value).toBeNull()
      expect(harness.inbox.expirationSucceeded.value).toBe(false)
      expect(harness.queryClient.getQueryData(detailKey)).toEqual(pendingExpiration)

      await harness.inbox.resolveExpirationDecision(report)
      expect(vi.mocked(humanDecisionApi.resolveExpiration)).toHaveBeenCalledTimes(1)
    },
  )

  it('retains one request identity when an ambiguous attempt is retried', async () => {
    const uuid = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('uuid-A' as never)
      .mockReturnValueOnce('uuid-B' as never)
    const harness = mountInbox()
    await openDetailReady(harness)
    vi.mocked(humanDecisionApi.resolveExpiration)
      .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce(resolvedExpiration(unavailableExpiration))

    await harness.inbox.resolveExpirationDecision(report)
    expect(harness.inbox.expirationConflict.value).toBe(false)
    expect(harness.inbox.expirationErrorMessage.value).toContain('No se pudo registrar')

    await harness.inbox.resolveExpirationDecision(report)

    const resolveMock = vi.mocked(humanDecisionApi.resolveExpiration)
    const ids = resolveMock.mock.calls.map((call) => call[1].resolutionRequestId)
    expect(ids).toEqual(['uuid-A', 'uuid-A'])
    expect(uuid).toHaveBeenCalledTimes(1)
    expect(harness.inbox.expirationSucceeded.value).toBe(true)
  })

  it('retires the attempt identity after a definitive conflict', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('uuid-A' as never)
      .mockReturnValueOnce('uuid-B' as never)
    const harness = mountInbox()
    await openDetailReady(harness)
    vi.mocked(humanDecisionApi.resolveExpiration)
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'VERSION_CONFLICT' } } })
      .mockResolvedValueOnce(resolvedExpiration(unavailableExpiration))

    await harness.inbox.resolveExpirationDecision(report)
    expect(harness.inbox.expirationConflict.value).toBe(true)

    harness.inbox.openDetail('exp-1') // reopening clears the read-only lock for a fresh attempt
    await harness.inbox.resolveExpirationDecision(report)

    const resolveMock = vi.mocked(humanDecisionApi.resolveExpiration)
    const ids = resolveMock.mock.calls.map((call) => call[1].resolutionRequestId)
    expect(ids).toEqual(['uuid-A', 'uuid-B'])
    expect(harness.inbox.expirationSucceeded.value).toBe(true)
  })

  it('issues only one request for overlapping submissions', async () => {
    const gate = deferred<ResolvedExpirationDecision>()
    const harness = mountInbox()
    await openDetailReady(harness)
    vi.mocked(humanDecisionApi.resolveExpiration).mockReturnValue(gate.promise)

    const first = harness.inbox.resolveExpirationDecision(report)
    await harness.inbox.resolveExpirationDecision(report)
    expect(vi.mocked(humanDecisionApi.resolveExpiration)).toHaveBeenCalledTimes(1)

    gate.resolve(resolvedExpiration(unavailableExpiration))
    await first
    expect(harness.inbox.expirationSucceeded.value).toBe(true)
  })

  it('discards an A-B-A late settlement without overwriting current cache or feedback', async () => {
    const origin = deferred<ResolvedExpirationDecision>()
    const current = deferred<ResolvedExpirationDecision>()
    const currentResult = resolvedExpiration(unavailableExpiration)
    const originResult = resolvedExpiration(provideExpiration)
    vi.mocked(humanDecisionApi.resolveExpiration)
      .mockReturnValueOnce(origin.promise)
      .mockReturnValueOnce(current.promise)

    const harness = mountInbox()
    await openDetailReady(harness)

    const late = harness.inbox.resolveExpirationDecision(report)
    authTenantId.value = 'tenant-2'
    authTenantId.value = 'tenant-1'
    await vi.waitFor(() => expect(harness.inbox.detail.data.value).toEqual(pendingExpiration))

    const fresh = harness.inbox.resolveExpirationDecision(report)
    current.resolve(currentResult)
    await fresh
    expect(harness.inbox.expirationSucceeded.value).toBe(true)
    expect(harness.queryClient.getQueryData(detailKey)).toEqual(currentResult)

    origin.resolve(originResult)
    await late

    // The obsolete settlement must not overwrite the current observable state.
    expect(harness.queryClient.getQueryData(detailKey)).toEqual(currentResult)
    expect(harness.inbox.detail.data.value).toEqual(currentResult)
    expect(harness.inbox.expirationSucceeded.value).toBe(true)
    expect(harness.inbox.expirationErrorMessage.value).toBeNull()
    expect(harness.inbox.expirationConflict.value).toBe(false)
  })
})
