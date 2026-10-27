import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, reactive, shallowRef } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { useEditorialState } from '../useEditorialState'

const { getState } = vi.hoisted(() => ({ getState: vi.fn() }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' },
  currentTenant: { id: 't1' } as { id: string } | null,
  permissionsLoaded: true, permissionCodes: ['read:ProductEditorialDraft'] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('../../api/product-editorial.api', async (original) => ({
  ...await original<typeof import('../../api/product-editorial.api')>(), editorialApi: { getState },
}))
const productId = shallowRef('p1')
const doc = { commercialTitle: 'Previous private content', description: null,
  familyCode: null, mediaRefs: ['a', 'b'], values: [] }
const stored = { cycle: 1, draft: { revision: 1, basePublishedRevision: null, document: doc }, published: null }
let result: ReturnType<typeof useEditorialState>
let client: QueryClient
let wrapper: ReturnType<typeof mount>
function render() {
  wrapper = mount(defineComponent({
    setup() {
      result = useEditorialState(productId)
      return { label: computed(() => result.state.value ? 'PRIVATE CONTENT' : 'NO CONTENT') }
    },
    template: '<p>{{ label }}</p>',
  }), { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
}
async function settle() { await flushPromises(); await new Promise((resolve) => setTimeout(resolve, 10)); await flushPromises() }
beforeEach(() => {
  client = new QueryClient()
  getState.mockReset()
  productId.value = 'p1'
  Object.assign(auth, { isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' },
    permissionsLoaded: true, permissionCodes: ['read:ProductEditorialDraft'] })
})
afterEach(() => { wrapper?.unmount(); client.clear() })

describe('editorial reader context isolation', () => {
  it.each(['user', 'tenant', 'product'] as const)('discards previous %s context, even a late response', async (change) => {
    let resolveOld!: (state: unknown) => void
    let resolveNew!: (state: unknown) => void
    getState.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveNew = resolve }))
    render()
    await settle()
    if (change === 'user') auth.user = { id: 'u2' }
    if (change === 'tenant') auth.currentTenant = { id: 't2' }
    if (change === 'product') productId.value = 'p2'
    expect(result.state.value).toBeNull()
    await settle()
    resolveOld(stored)
    await settle()
    expect(result.state.value).toBeNull()
    expect(wrapper.text()).toBe('NO CONTENT')
    resolveNew({ cycle: null, draft: null, published: null })
    await settle()
    expect(result.state.value?.draft).toBeNull()
    expect(getState).toHaveBeenCalledTimes(2)
    expect(getState).toHaveBeenLastCalledWith(change === 'product' ? 'p2' : 'p1')
    const keys = client.getQueryCache().getAll().map((query) => query.queryKey)
    expect(JSON.stringify(keys)).not.toContain('synthetic-token')
    expect(keys.some((key) => key[1] === (change === 'tenant' ? 't2' : 't1'))).toBe(true)
  })

  it.each(['logout', 'tenant', 'hydration', 'grant', 'switching'] as const)('clears already loaded state on %s loss, including manual refresh', async (change) => {
    getState.mockResolvedValue(stored)
    render()
    await settle()
    expect(result.state.value?.draft?.document).toEqual(doc)
    if (change === 'switching') auth.authPhase = 'selecting-tenant'
    if (change === 'logout') auth.isAuthenticated = false
    if (change === 'tenant') auth.currentTenant = null
    if (change === 'hydration') auth.permissionsLoaded = false
    if (change === 'grant') auth.permissionCodes = ['update:ProductEditorialDraft']
    expect(result.state.value).toBeNull()
    await result.refresh()
    await settle()
    expect(wrapper.text()).toBe('NO CONTENT')
    expect(getState).toHaveBeenCalledTimes(1)
  })

  it('remounts without showing old session cache and preserves every media ref in data', async () => {
    getState.mockResolvedValueOnce(stored).mockReturnValueOnce(new Promise(() => {}))
    render()
    await settle()
    const draft = result.sections.value[0]?.decoded
    expect(draft?.readable && draft.document.mediaRefs).toEqual(['a', 'b'])
    wrapper.unmount()
    render()
    expect(result.state.value).toBeNull()
    expect(wrapper.text()).toBe('NO CONTENT')
    await settle()
    expect(getState).toHaveBeenCalledTimes(2)
  })

  it('does not resurrect old state when exact access is revoked then restored', async () => {
    getState.mockResolvedValueOnce(stored).mockReturnValueOnce(new Promise(() => {}))
    render()
    await settle()
    auth.permissionCodes = []
    expect(result.state.value).toBeNull()
    auth.permissionCodes = ['read:ProductEditorialDraft']
    expect(result.state.value).toBeNull()
    await settle()
    expect(getState).toHaveBeenCalledTimes(2)
    expect(result.state.value).toBeNull()
  })

  it('rejects malformed state metadata without exposing payloads and never retries', async () => {
    getState.mockResolvedValue({ cycle: 'private-error-data', draft: null, published: null })
    render()
    await settle()
    expect(result.state.value).toBeNull()
    expect(result.errorMessage.value).toContain('No se pudo consultar')
    expect(result.errorMessage.value).not.toContain('private-error-data')
    expect(getState).toHaveBeenCalledTimes(1)
  })
})
