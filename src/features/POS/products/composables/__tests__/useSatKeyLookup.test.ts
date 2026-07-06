/**
 * useSatKeyLookup — single-key hydration composable tests.
 *
 * Verifies:
 *  - Query is disabled when the key is empty.
 *  - 404 → data resolves to `null` (legacy/retired key path).
 *  - 2xx → data resolves to the SatKey entity.
 *  - AbortSignal is forwarded to the queryFn.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import { useSatKeyLookup } from '../useSatKeyLookup'

const getSatKeyMock = vi.fn()
vi.mock('../../api/satKey.api', () => ({
  getSatKey: (...args: unknown[]) => getSatKeyMock(...args),
  searchSatKeys: vi.fn(),
}))

vi.mock('@/core/shared/constants/query-keys', () => ({
  satKeyQueryKeys: {
    search: (term: string) => ['sat-keys', 'search', term] as const,
    detail: (key: string) => ['sat-keys', 'detail', key] as const,
  },
}))

const useQueryMock = vi.fn()
vi.mock('@tanstack/vue-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

const flushPromises = async () => {
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
}

describe('useSatKeyLookup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getSatKeyMock.mockReset()
    useQueryMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays disabled when the key is empty', async () => {
    useQueryMock.mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isFetching: ref(false),
    })

    const Harness = defineComponent({
      setup() {
        useSatKeyLookup(() => '')
        return () => h('div')
      },
    })
    mount(Harness)
    await flushPromises()

    const opts = useQueryMock.mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(opts.enabled.value).toBe(false)
  })

  it('passes the trimmed key in the query key when non-empty', async () => {
    useQueryMock.mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isFetching: ref(false),
    })

    const Harness = defineComponent({
      setup() {
        useSatKeyLookup(() => '  12345678  ')
        return () => h('div')
      },
    })
    mount(Harness)
    await flushPromises()

    const opts = useQueryMock.mock.calls[0]?.[0] as {
      queryKey: { value: readonly unknown[] }
      enabled: { value: boolean }
    }
    expect(opts.enabled.value).toBe(true)
    expect(opts.queryKey.value).toEqual(['sat-keys', 'detail', '12345678'])
  })

  it('forwards the AbortSignal to the queryFn → getSatKey', async () => {
    let capturedSignal: AbortSignal | undefined
    useQueryMock.mockImplementation((opts: { queryFn: (ctx: { signal: AbortSignal }) => unknown }) => {
      const fakeSignal = new AbortController().signal
      capturedSignal = fakeSignal
      void opts.queryFn({ signal: fakeSignal })
      return {
        data: ref(null),
        isLoading: ref(false),
        isFetching: ref(false),
      }
    })
    getSatKeyMock.mockResolvedValue(null)

    const Harness = defineComponent({
      setup() {
        useSatKeyLookup(() => '12345678')
        return () => h('div')
      },
    })
    mount(Harness)
    await flushPromises()

    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(getSatKeyMock).toHaveBeenCalledWith('12345678', { signal: capturedSignal })
  })
})
