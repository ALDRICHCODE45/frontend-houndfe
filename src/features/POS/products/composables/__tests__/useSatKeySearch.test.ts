/**
 * useSatKeySearch — async-debounced search composable tests.
 *
 * Verifies the composable contract:
 *  - Fires GET /sat-keys ONLY when the trimmed term length ≥ MIN_SEARCH_CHARS.
 *  - Debounces input by SEARCH_DEBOUNCE_MS.
 *  - Forwards the AbortSignal to queryFn.
 *  - Uses the trimmed term in the query key (so TanStack auto-aborts
 *    stale in-flight requests when the user keeps typing).
 *  - Stays disabled for empty / single-character input.
 *
 * We mock @tanstack/vue-query's useQuery so we can drive the
 * composable's options and assert what it passes through to the
 * queryFn. vi.mock hoists above the import, so the top-level
 * `useSatKeySearch` import resolves to the real module bound to our
 * mocked useQuery.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import { useSatKeySearch } from '../useSatKeySearch'

// Mock the API so we can assert what the composable forwards.
const searchSatKeysMock = vi.fn().mockResolvedValue({
  items: [],
  limit: 20,
  offset: 0,
  total: 0,
})
vi.mock('../../api/satKey.api', () => ({
  searchSatKeys: (...args: unknown[]) => searchSatKeysMock(...args),
  getSatKey: vi.fn(),
}))

// Mock the central query-keys so we can assert the exact key tuple.
vi.mock('@/core/shared/constants/query-keys', () => ({
  satKeyQueryKeys: {
    search: (term: string) => ['sat-keys', 'search', term] as const,
    detail: (key: string) => ['sat-keys', 'detail', key] as const,
  },
}))

// Mock vue-query useQuery with a configurable spy.
const useQueryMock = vi.fn()
vi.mock('@tanstack/vue-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

interface CapturedOptions {
  queryKey: { value: readonly unknown[] }
  queryFn: (ctx: { signal: AbortSignal }) => Promise<unknown>
  enabled: { value: boolean }
  staleTime: number
}

function captureOptions() {
  let captured: CapturedOptions | undefined
  useQueryMock.mockImplementation((opts: CapturedOptions) => {
    captured = opts
    return {
      data: ref({ items: [], limit: 20, offset: 0, total: 0 }),
      isLoading: ref(false),
      isFetching: ref(false),
    }
  })
  return () => captured as CapturedOptions
}

const flushPromises = async () => {
  // Drive microtasks + a small slice of fake-timer time. Avoids hanging
  // on a real setTimeout that would never fire under vi.useFakeTimers().
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
}

describe('useSatKeySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useQueryMock.mockReset()
    searchSatKeysMock.mockClear()
    useQueryMock.mockReturnValue({
      data: ref({ items: [], limit: 20, offset: 0, total: 0 }),
      isLoading: ref(false),
      isFetching: ref(false),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays disabled when the initial search is empty', async () => {
    const getOptions = captureOptions()
    const Harness = defineComponent({
      setup() {
        useSatKeySearch(() => '')
        return () => h('div')
      },
    })
    mount(Harness)
    vi.advanceTimersByTime(500)
    await flushPromises()

    const opts = getOptions()
    expect(opts.enabled.value).toBe(false)
  })

  it('stays disabled when the trimmed term is shorter than 2 chars', async () => {
    const getOptions = captureOptions()
    const term = ref('1')
    const Harness = defineComponent({
      setup() {
        useSatKeySearch(() => term.value)
        return () => h('div')
      },
    })
    mount(Harness)
    vi.advanceTimersByTime(500)
    await flushPromises()

    expect(getOptions().enabled.value).toBe(false)
  })

  it('enables the query and uses the trimmed term in the key once ≥ 2 chars are typed', async () => {
    const getOptions = captureOptions()
    const term = ref('')
    const Harness = defineComponent({
      setup() {
        useSatKeySearch(() => term.value)
        return () => h('div')
      },
    })
    mount(Harness)

    term.value = '  Servicio  '
    await nextTick()
    vi.advanceTimersByTime(500)
    await flushPromises()

    const opts = getOptions()
    expect(opts.enabled.value).toBe(true)
    expect(opts.queryKey.value).toEqual(['sat-keys', 'search', 'Servicio'])
  })

  it('forwards the AbortSignal to the queryFn (and from there to searchSatKeys)', async () => {
    const term = ref('12')
    const Harness = defineComponent({
      setup() {
        useSatKeySearch(() => term.value)
        return () => h('div')
      },
    })
    mount(Harness)
    vi.advanceTimersByTime(500)
    await flushPromises()

    const opts = useQueryMock.mock.calls[0]?.[0] as CapturedOptions
    const fakeSignal = new AbortController().signal
    await opts.queryFn({ signal: fakeSignal })

    expect(searchSatKeysMock).toHaveBeenCalledWith('12', { signal: fakeSignal })
  })

  it('debounces 300ms — typing within the window does not push a new debounced value', async () => {
    const getOptions = captureOptions()
    const term = ref('')
    const Harness = defineComponent({
      setup() {
        useSatKeySearch(() => term.value)
        return () => h('div')
      },
    })
    mount(Harness)

    term.value = 'a'
    await nextTick()
    vi.advanceTimersByTime(100)
    term.value = 'ab'
    await nextTick()
    vi.advanceTimersByTime(100)
    term.value = 'abc'
    await nextTick()
    vi.advanceTimersByTime(290) // still inside the 300ms window
    await flushPromises()

    // The debounced value should NOT have flushed yet → query still disabled.
    expect(getOptions().enabled.value).toBe(false)
  })

  it('flushed after 300ms: the final trimmed value is in the query key', async () => {
    const getOptions = captureOptions()
    const term = ref('')
    const Harness = defineComponent({
      setup() {
        useSatKeySearch(() => term.value)
        return () => h('div')
      },
    })
    mount(Harness)

    term.value = 'abc'
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(getOptions().enabled.value).toBe(true)
    expect(getOptions().queryKey.value).toEqual(['sat-keys', 'search', 'abc'])
  })
})
