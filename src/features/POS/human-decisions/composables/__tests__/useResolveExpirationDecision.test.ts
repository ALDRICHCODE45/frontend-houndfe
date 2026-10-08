import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin, useQuery } from '@tanstack/vue-query'
import { defineComponent, h, nextTick, watch } from 'vue'
import { mount } from '@vue/test-utils'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { humanDecisionApi } from '../../api/human-decision.api'
import {
  resolvedExpiration,
  unavailableExpiration,
} from '../../interfaces/__tests__/expirationDecision.fixture'
import type { ResolvedExpirationDecision } from '../../interfaces/expiration-decision.types'
import { useResolveExpirationDecision } from '../useResolveExpirationDecision'

vi.mock('../../api/human-decision.api', () => ({
  humanDecisionApi: { resolveExpiration: vi.fn() },
}))

vi.mock('@/features/auth/stores/useAuthStore', async () => {
  const { computed, reactive, ref } = await import('vue')
  const user = ref<{ id: string } | null>(null)
  const currentTenant = ref<{ id: string } | null>(null)
  const store = reactive({
    user,
    currentTenant,
    currentTenantId: computed(() => currentTenant.value?.id ?? ''),
    refreshToken: ref<string | null>(null),
  })
  return { useAuthStore: () => store }
})

const resolved: ResolvedExpirationDecision = resolvedExpiration(unavailableExpiration)
const report = { action: 'REPORT_EXPIRATION_UNAVAILABLE', expectedVersion: 1 } as const
const signal = (status: number, code: string) => ({
  response: { status, data: { statusCode: status, code, message: 'x' } },
})
const mounted: Array<{ unmount: () => void }> = []

function session(tenantId = 'tenant-1', userId = 'user-1') {
  const store = useAuthStore()
  store.user = { id: userId, email: `${userId}@x`, name: userId, isActive: true, createdAt: 'x' }
  store.currentTenant = { id: tenantId, name: tenantId, slug: tenantId }
  return store
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function open(onSetup?: (owner: ReturnType<typeof useResolveExpirationDecision>) => void) {
  let owner!: ReturnType<typeof useResolveExpirationDecision>
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Host = defineComponent({
    setup: () => {
      owner = useResolveExpirationDecision()
      onSetup?.(owner)
      return () => h('div')
    },
  })
  const wrapper = mount(Host, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  mounted.push(wrapper)
  return { owner, queryClient, wrapper }
}

describe('useResolveExpirationDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session()
  })

  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    vi.restoreAllMocks()
  })

  it('blocks invalid input, missing identity, duplicate dispatch and post-disposal work', async () => {
    const { owner, wrapper } = open()
    const invalid = await owner.dispatch('exp-1', {
      action: 'PROVIDE_EXPIRATION_TEXT',
      expirationText: '',
      expectedVersion: 1,
    })
    expect(invalid).toEqual({ status: 'blocked', reason: 'invalid-input' })
    const store = useAuthStore()
    store.currentTenant = null
    const missing = await owner.dispatch('exp-1', report)
    expect(missing).toEqual({ status: 'blocked', reason: 'unauthenticated' })
    session()

    const gate = deferred<ResolvedExpirationDecision>()
    vi.mocked(humanDecisionApi.resolveExpiration).mockReturnValue(gate.promise)
    const first = owner.dispatch('exp-1', report)
    expect(owner.isPending.value).toBe(true)
    expect(await owner.dispatch('exp-1', report)).toEqual({ status: 'blocked', reason: 'busy' })
    gate.resolve(resolved)
    expect(await first).toEqual({ status: 'resolved', decision: resolved })
    expect(humanDecisionApi.resolveExpiration).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    expect(await owner.dispatch('exp-1', report)).toEqual({ status: 'blocked', reason: 'disposed' })
    expect(humanDecisionApi.resolveExpiration).toHaveBeenCalledTimes(1)
  })

  it('keeps context across a token-only refresh and marks dispatch-time tenant keys stale', async () => {
    const gate = deferred<ResolvedExpirationDecision>()
    vi.mocked(humanDecisionApi.resolveExpiration).mockReturnValue(gate.promise)
    const { owner, queryClient } = open()
    const setQueryData = vi.spyOn(queryClient, 'setQueryData')
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const detailKey = humanDecisionQueryKeys.detail('tenant-1', 'exp-1')
    const request = owner.dispatch('exp-1', report)
    useAuthStore().refreshToken = 'rotated-refresh'
    expect(setQueryData).not.toHaveBeenCalled()
    gate.resolve(resolved)
    expect(await request).toEqual({ status: 'resolved', decision: resolved })
    expect(setQueryData).toHaveBeenCalledWith(detailKey, resolved)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: humanDecisionQueryKeys.listPrefix('tenant-1'),
      refetchType: 'none',
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: detailKey, refetchType: 'none' })
  })

  it.each([
    ['resolve', 'an immediate A-B-A switch'],
    ['reject', 'an immediate A-B-A switch'],
    ['resolve', 'a logout/login of the same identity'],
    ['reject', 'a logout/login of the same identity'],
    ['resolve', 'disposal'],
    ['reject', 'disposal'],
  ] as const)('discards a late %s after %s', async (settle, timeline) => {
    const gate = deferred<ResolvedExpirationDecision>()
    vi.mocked(humanDecisionApi.resolveExpiration).mockReturnValue(gate.promise)
    const { owner, queryClient, wrapper } = open()
    const setQueryData = vi.spyOn(queryClient, 'setQueryData')
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const request = owner.dispatch('exp-1', report)
    if (timeline === 'disposal') {
      wrapper.unmount()
    } else if (timeline.startsWith('an immediate')) {
      session('tenant-2')
      session('tenant-1')
    } else {
      const store = useAuthStore()
      store.user = null
      store.currentTenant = null
      session('tenant-1', 'user-1')
    }
    if (settle === 'resolve') gate.resolve(resolved)
    else gate.reject(signal(409, 'VERSION_CONFLICT'))
    expect(await request).toEqual({ status: 'discarded' })
    expect(setQueryData).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(owner.error.value).toBeNull()
    expect(owner.requiresReauthentication.value).toBe(false)
    expect(owner.isPending.value).toBe(false)
  })

  it.each([
    ['401', signal(401, 'UNAUTHORIZED'), true, false],
    ['network', { code: 'ERR_NETWORK' }, false, false],
    ['VERSION_CONFLICT', signal(409, 'VERSION_CONFLICT'), false, true],
  ] as const)(
    'handles a same-context %s failure without crossing context',
    async (_label, failure, reauth, isConflict) => {
      vi.mocked(humanDecisionApi.resolveExpiration)
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(resolved)
      const { owner, queryClient } = open()
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      const rejected = await owner.dispatch('exp-1', report)
      expect(rejected).toEqual({ status: 'rejected' })
      expect(owner.requiresReauthentication.value).toBe(reauth)
      expect(owner.error.value).toBeDefined()
      expect(invalidate).toHaveBeenCalledTimes(isConflict ? 2 : 0)
      const [first] = vi.mocked(humanDecisionApi.resolveExpiration).mock.calls
      const retried = await owner.dispatch('exp-1', report)
      expect(retried).toEqual({ status: 'resolved', decision: resolved })
      const [, second] = vi.mocked(humanDecisionApi.resolveExpiration).mock.calls
      expect(first![1].resolutionRequestId === second![1].resolutionRequestId).toBe(!isConflict)
    },
  )

  it.each(['success', 'conflict'] as const)(
    'discards a %s when the context switches during cache work',
    async (kind) => {
      const cache = deferred<void>()
      const mock = vi.mocked(humanDecisionApi.resolveExpiration)
      if (kind === 'success') mock.mockResolvedValue(resolved)
      else mock.mockRejectedValue(signal(409, 'VERSION_CONFLICT'))
      const { owner, queryClient } = open()
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(cache.promise)
      const request = owner.dispatch('exp-1', report)
      await vi.waitFor(() => expect(invalidate).toHaveBeenCalled())
      session('tenant-2')
      cache.resolve()
      expect(await request).toEqual({ status: 'discarded' })
    },
  )

  it('aborts a superseded origin request and keeps the replacement request intact', async () => {
    const gate = deferred<ResolvedExpirationDecision>()
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID')
    uuid.mockReturnValueOnce('uuid-A' as never).mockReturnValueOnce('uuid-B' as never)
    vi.mocked(humanDecisionApi.resolveExpiration).mockImplementation((id) =>
      id === 'exp-2' ? gate.promise : Promise.reject({ code: 'ERR_NETWORK' }),
    )
    let replacement: Promise<unknown> | undefined
    let switched = false
    const { owner } = open((o) => {
      watch(
        o.isPending,
        () => {
          if (switched) return
          switched = true
          session('tenant-2')
          replacement = o.dispatch('exp-2', report)
        },
        { flush: 'sync' },
      )
    })
    const origin = owner.dispatch('exp-1', report)
    expect(await origin).toEqual({ status: 'discarded' })
    gate.resolve(resolved)
    expect(await replacement).toEqual({ status: 'resolved', decision: resolved })
    const calls = vi.mocked(humanDecisionApi.resolveExpiration).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0]![0]).toBe('exp-2')
    expect(calls[0]![1].resolutionRequestId).toBe('uuid-B')
  })

  it('starts no origin cache fetch after a list listener switches context', async () => {
    const listFn = vi.fn().mockResolvedValue({ data: [] })
    const detailFn = vi.fn().mockResolvedValue(resolved)
    const listKey = humanDecisionQueryKeys.listPrefix('tenant-1')
    const detailKey = humanDecisionQueryKeys.detail('tenant-1', 'exp-1')
    const { owner, queryClient } = open(() => {
      useQuery({ queryKey: listKey, queryFn: listFn })
      useQuery({ queryKey: detailKey, queryFn: detailFn })
    })
    await vi.waitFor(() => expect(queryClient.getQueryData(listKey)).toBeDefined())
    const unsubscribe = queryClient.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.query.queryKey[2] === 'list') session('tenant-2')
    })
    vi.mocked(humanDecisionApi.resolveExpiration).mockResolvedValue(resolved)
    expect(await owner.dispatch('exp-1', report)).toEqual({ status: 'discarded' })
    await nextTick()
    expect([listFn, detailFn].map((fn) => fn.mock.calls.length)).toEqual([1, 1])
    unsubscribe()
  })

  it.each(['resolved', 'rejected'] as const)(
    'discards a %s result when pending cleanup switches context',
    async (kind) => {
      const mock = vi.mocked(humanDecisionApi.resolveExpiration)
      if (kind === 'resolved') mock.mockResolvedValue(resolved)
      else mock.mockRejectedValue(signal(409, 'VERSION_CONFLICT'))
      let switched = false
      const { owner } = open((o) => {
        watch(
          o.isPending,
          (pending) => {
            if (pending || switched) return
            switched = true
            session('tenant-2')
          },
          { flush: 'sync' },
        )
      })
      expect(await owner.dispatch('exp-1', report)).toEqual({ status: 'discarded' })
    },
  )

  it('leaves the re-auth flag reset when a sync error watcher switches context', async () => {
    vi.mocked(humanDecisionApi.resolveExpiration).mockRejectedValue(signal(401, 'UNAUTHORIZED'))
    const { owner } = open((o) =>
      watch(o.error, () => session('tenant-2'), { flush: 'sync', once: true }),
    )
    expect(await owner.dispatch('exp-1', report)).toEqual({ status: 'discarded' })
    expect(owner.requiresReauthentication.value).toBe(false)
    expect(owner.error.value).toBeNull()
  })

  it('suppresses origin invalidations when a cache callback switches context', async () => {
    vi.mocked(humanDecisionApi.resolveExpiration).mockResolvedValue(resolved)
    const { owner, queryClient } = open()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    vi.spyOn(queryClient, 'setQueryData').mockImplementation(() => {
      session('tenant-2')
      return undefined
    })
    expect(await owner.dispatch('exp-1', report)).toEqual({ status: 'discarded' })
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('keeps transport truth when cache maintenance rejects', async () => {
    vi.mocked(humanDecisionApi.resolveExpiration).mockResolvedValue(resolved)
    const success = open()
    vi.spyOn(success.queryClient, 'invalidateQueries').mockRejectedValue(new Error('cache down'))
    const kept = await success.owner.dispatch('exp-1', report)
    expect(kept).toEqual({ status: 'resolved', decision: resolved })
    vi.mocked(humanDecisionApi.resolveExpiration).mockRejectedValue(signal(409, 'VERSION_CONFLICT'))
    const failure = open()
    vi.spyOn(failure.queryClient, 'invalidateQueries').mockRejectedValue(new Error('cache down'))
    const rejected = await failure.owner.dispatch('exp-1', report)
    expect(rejected).toEqual({ status: 'rejected' })
  })

  it('does not let a superseded request clear the replacement request lock', async () => {
    const origin = deferred<ResolvedExpirationDecision>()
    const replacement = deferred<ResolvedExpirationDecision>()
    vi.mocked(humanDecisionApi.resolveExpiration)
      .mockReturnValueOnce(origin.promise)
      .mockReturnValueOnce(replacement.promise)
    const { owner } = open()
    const first = owner.dispatch('exp-1', report)
    session('tenant-2')
    const second = owner.dispatch('exp-2', report)
    expect(owner.isPending.value).toBe(true)
    origin.resolve(resolved)
    expect(await first).toEqual({ status: 'discarded' })
    expect(owner.isPending.value).toBe(true)
    replacement.resolve(resolved)
    expect(await second).toEqual({ status: 'resolved', decision: resolved })
  })

  it('resets the retry UUID after a success or a context change', async () => {
    let sequence = 0
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID')
    uuid.mockImplementation((() => `uuid-${++sequence}`) as never)
    vi.mocked(humanDecisionApi.resolveExpiration).mockResolvedValue(resolved)
    const { owner } = open()
    const payloadId = (index: number) =>
      vi.mocked(humanDecisionApi.resolveExpiration).mock.calls[index]![1].resolutionRequestId
    await owner.dispatch('exp-1', report)
    await owner.dispatch('exp-1', report)
    expect(payloadId(0)).toBe('uuid-1')
    expect(payloadId(1)).toBe('uuid-2')
    session('tenant-2')
    session('tenant-1')
    await owner.dispatch('exp-1', report)
    expect(payloadId(2)).toBe('uuid-3')
  })
})
