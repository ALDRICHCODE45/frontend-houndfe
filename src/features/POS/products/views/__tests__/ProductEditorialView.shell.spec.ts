// ProductEditorialView.shell.spec.ts — the route's own header around the shared
// EditorialWorkspace: the product name while it loads, a missing product and a
// failed name lookup. The workspace's states are its own specs.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ProductEditorialView from '../ProductEditorialView.vue'
import EditorialWorkspace from '../../components/editorial/EditorialWorkspace.vue'
import { success, vocabularyEnvelope, read, update } from '../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const routerPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'p1' } }), useRouter: () => ({ push: routerPush }) }))
const productGetById = vi.hoisted(() => vi.fn())
vi.mock('../../api/product.api', () => ({ productApi: { getById: productGetById } }))

let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.resetAllMocks()
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary')
    ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success()))
})
afterEach(() => wrapper?.unmount())

describe('ProductEditorialView shell', () => {
  it('names the product in the title once it is read', async () => {
    productGetById.mockResolvedValue({ name: 'Collar ajustable' })
    wrapper = mount(ProductEditorialView)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Collar ajustable')
    expect(wrapper.find('[data-testid="editorial-title-skeleton"]').exists()).toBe(false)
  })

  it('holds the title place with a skeleton while the name loads, never a stand-in «Producto»', async () => {
    productGetById.mockReturnValue(new Promise(() => {}))
    wrapper = mount(ProductEditorialView)
    await flushPromises()

    const title = wrapper.get('h1')
    expect(title.text()).toBe('')
    expect(title.attributes('aria-busy')).toBe('true')
    expect(title.find('[data-testid="editorial-title-skeleton"]').classes()).toContain('hf-skeleton')
  })

  it('a missing product is an empty state with a way back, not the workspace saying there is no access', async () => {
    productGetById.mockRejectedValue({ response: { status: 404 } })
    wrapper = mount(ProductEditorialView)
    await flushPromises()

    const state = wrapper.get('.hf-empty-state')
    expect(state.text()).toContain('No encontramos el producto')
    expect(wrapper.findComponent(EditorialWorkspace).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No tienes acceso')
    await state.get('[data-testid="empty-state-action"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/products')
  })

  it('any other failed name lookup keeps the workspace under a generic title', async () => {
    productGetById.mockRejectedValue({ response: { status: 500 } })
    wrapper = mount(ProductEditorialView)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Producto')
    expect(wrapper.findComponent(EditorialWorkspace).exists()).toBe(true)
  })
})
