import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useCatalogBranches } from '../useCatalogBranches'

const branch = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }

function mountHarness() {
  let catalog: ReturnType<typeof useCatalogBranches>
  const Harness = defineComponent({ setup: () => { catalog = useCatalogBranches(); return () => null } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return () => catalog!
}

describe('useCatalogBranches', () => {
  it('exposes loading, populated, empty, and recoverable server states with manual retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([branch]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const catalog = mountHarness()

    expect(catalog().state.value).toBe('loading')
    await flushPromises()
    expect(catalog().state.value).toBe('populated')
    expect(catalog().branches.value).toEqual([branch])
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('server')
    await catalog().retry()
    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('renders the empty state when no branches are published', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))
    const catalog = mountHarness()

    await flushPromises()
    expect(catalog().state.value).toBe('empty')
    expect(catalog().branches.value).toEqual([])
  })
})
