// useCatalogSettingsQuery.spec.ts — REAL-RUNTIME contract (WU2C remediation,
// REQ-6): a mounted component harness backed by a real QueryClient +
// VueQueryPlugin; ONLY the http transport is mocked. Proves observer-level
// behavior the old useQuery mocks could not: an empty tenant id disables the
// query (no GET), the caller `enabled` is a conjunction leg, a tenant A→B
// switch never exposes A data while B is pending and settles to B only, and a
// 404 becomes an error state with no synthetic data.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http } from '@/core/shared/api/http'
import { useCatalogSettingsQuery } from '../useCatalogSettingsQuery'
import type { CatalogSettingsResponseDto } from '../../interfaces/catalog-settings.types'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), patch: vi.fn() } }))

/** Distinguishable tenant payloads: A is published, B is not. */
function settingsFor(catalogPublished: boolean): CatalogSettingsResponseDto {
  return {
    catalogPublished,
    effectivePublication: catalogPublished,
    priceContexts: [{ priceListId: 'pl_a', name: 'Retail', isCatalogDefault: true }],
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    warnings: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolveIt) => (resolve = resolveIt))
  return { promise, resolve }
}

function mountQuery(tenantId: Ref<string>, enabled?: Ref<boolean>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  let result!: ReturnType<typeof useCatalogSettingsQuery>
  const Harness = defineComponent({
    setup() {
      result = useCatalogSettingsQuery(
        () => tenantId.value,
        enabled ? { enabled } : undefined,
      )
      return () => null
    },
  })
  mount(Harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } })
  return result
}

describe('useCatalogSettingsQuery (runtime, sdd online-catalog-backoffice WU2C, REQ-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('an empty tenant id disables the query — no GET fires until a tenant arrives', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: settingsFor(true) })
    const tenantId = ref('')
    const result = mountQuery(tenantId)

    await flushPromises()
    expect(http.get).not.toHaveBeenCalled()
    expect(result.settings.value).toBeUndefined()

    tenantId.value = 'tenant-A'
    await flushPromises()
    expect(vi.mocked(http.get).mock.calls[0]?.[0]).toBe('/tenants/tenant-A/catalog-settings')
  })

  it('caller enabled=false blocks the query even with a non-empty tenant (conjunction)', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: settingsFor(true) })
    const enabled = ref(false)
    mountQuery(ref('tenant-A'), enabled)

    await flushPromises()
    expect(http.get).not.toHaveBeenCalled()

    enabled.value = true
    await flushPromises()
    expect(http.get).toHaveBeenCalledTimes(1)
  })

  it('tenant A→B exposes NO A data while B is pending, then settles to B only', async () => {
    const a = deferred<{ data: CatalogSettingsResponseDto }>()
    const b = deferred<{ data: CatalogSettingsResponseDto }>()
    vi.mocked(http.get).mockImplementation((url: string) =>
      url.endsWith('/tenant-A/catalog-settings') ? a.promise : b.promise,
    )
    const tenantId = ref('tenant-A')
    const result = mountQuery(tenantId)

    a.resolve({ data: settingsFor(true) })
    await flushPromises()
    expect(result.settings.value?.catalogPublished).toBe(true)

    tenantId.value = 'tenant-B'
    await flushPromises()
    expect(result.settings.value).toBeUndefined()

    b.resolve({ data: settingsFor(false) })
    await flushPromises()
    expect(result.settings.value?.catalogPublished).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('a 404 becomes an error state — no synthetic settings data', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('Request failed with status code 404'))
    const result = mountQuery(ref('tenant-404'))

    await flushPromises()
    expect(result.isError.value).toBe(true)
    expect(result.error.value).toBeInstanceOf(Error)
    expect(result.settings.value).toBeUndefined()
  })
})
