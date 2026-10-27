import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ProductEditorialView from '../ProductEditorialView.vue'
import { EditorialApiError } from '../../api/product-editorial.api'

const { getState } = vi.hoisted(() => ({ getState: vi.fn() }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u1' }, currentTenant: { id: 't1' },
  permissionsLoaded: true, permissionCodes: ['read:ProductEditorialDraft'] })
const route = reactive({ params: { id: 'p1' } })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../../api/product-editorial.api', async (original) => ({
  ...await original<typeof import('../../api/product-editorial.api')>(), editorialApi: { getState },
}))
const document = { commercialTitle: 'Título editorial', description: 'Descripción editorial',
  familyCode: null, mediaRefs: ['private-1', 'private-2'], values: [] }
let wrapper: ReturnType<typeof mount>
let client: QueryClient
function render() {
  client = new QueryClient()
  wrapper = mount(ProductEditorialView, { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
  return wrapper
}
async function settle() { await flushPromises(); await new Promise((resolve) => setTimeout(resolve, 10)); await flushPromises() }

beforeEach(() => {
  getState.mockReset()
  Object.assign(auth, { isAuthenticated: true, user: { id: 'u1' }, currentTenant: { id: 't1' },
    permissionsLoaded: true, permissionCodes: ['read:ProductEditorialDraft'] })
  route.params.id = 'p1'
})
afterEach(() => { wrapper?.unmount(); client?.clear() })

describe('editorial read-only route view', () => {
  it.each([
    [{ cycle: null, draft: null, published: null }, 'Todavía no hay contenido editorial'],
    [{ cycle: 1, draft: null, published: { revision: 3, document } }, 'Sin borrador'],
    [{ cycle: 1, draft: { revision: 2, basePublishedRevision: null, document }, published: null }, 'Título editorial'],
    [{ cycle: 1, draft: { revision: 2, basePublishedRevision: null, document: { secret: 'DO NOT DISPLAY' } }, published: { revision: 1, document } }, 'No se puede interpretar este documento'],
  ])('presents stored state without editable controls', async (state, text) => {
    getState.mockResolvedValue(state)
    render()
    await settle()
    expect(wrapper.text()).toContain(text)
    expect(wrapper.text()).not.toContain('DO NOT DISPLAY')
    expect(wrapper.text()).not.toContain('[object Object]')
    expect(wrapper.findAll('input, textarea, form, img')).toHaveLength(0)
    expect(wrapper.text()).toContain('La edición todavía no está disponible')
    expect(wrapper.findAll('button')).toHaveLength(1)
  })

  it('keeps oversized history and all media references without fetching media', async () => {
    const title = 'x'.repeat(201)
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 1, basePublishedRevision: null,
      document: { ...document, commercialTitle: title, description: 'y'.repeat(20001),
        mediaRefs: Array.from({ length: 21 }, (_, i) => `private-${i}`) } }, published: null })
    render()
    await settle()
    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain('21 referencias de medios conservadas')
    expect(wrapper.text()).toContain('y'.repeat(20001))
    expect(wrapper.find('details').exists()).toBe(true)
  })

  it('shows loading, refreshes only explicitly, and safely reports a 403', async () => {
    let resolve!: (state: unknown) => void
    getState.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    render()
    expect(wrapper.text()).toContain('Cargando contenido editorial')
    resolve({ cycle: null, draft: null, published: null })
    await settle()
    getState.mockRejectedValueOnce(new EditorialApiError(403, { statusCode: 403, error: 'FORBIDDEN' }))
    await wrapper.get('button').trigger('click')
    await settle()
    expect(getState).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[role="alert"]').text()).toContain('No tienes acceso')
    expect(wrapper.text()).not.toContain('Todavía no hay contenido')
  })

  it('hides previous identity data immediately and makes no unauthorized request', async () => {
    getState.mockResolvedValue({ cycle: 1, draft: { revision: 1, basePublishedRevision: null, document }, published: null })
    render()
    await settle()
    expect(wrapper.text()).toContain('Título editorial')
    auth.permissionCodes = ['manage:all']
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Título editorial')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(getState).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('No tienes acceso')
  })

  it('does not render unsafe errors or retry failed reads', async () => {
    getState.mockRejectedValue(new Error('<script>private backend details</script>'))
    render()
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo consultar')
    expect(wrapper.text()).not.toContain('private backend details')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(getState).toHaveBeenCalledTimes(1)
  })

  it('keeps an unreadable published document distinct from an absent one', async () => {
    getState.mockResolvedValue({ cycle: 1, draft: null,
      published: { revision: 2, document: null } })
    render()
    await settle()
    expect(wrapper.text()).toContain('No se puede interpretar este documento')
    expect(wrapper.text()).toContain('Revisión 2')
    expect(wrapper.text()).not.toContain('Sin versión publicada')
  })

  it('does not read while context or permission hydration is incomplete', async () => {
    auth.permissionsLoaded = false
    render()
    await settle()
    expect(getState).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Título editorial')
  })
})
