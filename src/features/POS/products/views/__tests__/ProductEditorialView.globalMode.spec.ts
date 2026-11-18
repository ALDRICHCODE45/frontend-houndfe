// ProductEditorialView.globalMode.spec.ts — T12 close (backlog-closeout T3/S1): the route's own
// «Volver» and product title for every admitted actor. Global mode (Super Admin, no tenant) never
// sends the user to a tenant route, and a failed name lookup never breaks the editor. The FE sends
// no tenant header or param in any mode: the backend resolves the tenant from the token (S66).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ProductEditorialView from '../ProductEditorialView.vue'
import EditorialWorkspace from '../../components/editorial/EditorialWorkspace.vue'
import { success, vocabularyEnvelope, read, update } from '../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({
  isSuperAdmin: false as boolean,
  isAuthenticated: true,
  authPhase: 'authenticated',
  user: { id: 'u' },
  currentTenant: { id: 't' } as { id: string } | null,
  permissionsLoaded: true,
  permissionCodes: [read, update] as string[],
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const routerPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'p1' } }), useRouter: () => ({ push: routerPush }) }))
const productGetById = vi.hoisted(() => vi.fn())
vi.mock('../../api/product.api', () => ({ productApi: { getById: productGetById } }))

type Actor = { isSuperAdmin: boolean; currentTenant: { id: string } | null; permissionCodes: string[] }
const ACTORS: Record<'superadminGlobal' | 'superadminTenant' | 'manageAll' | 'editorialOnly', Actor> = {
  superadminGlobal: { isSuperAdmin: true, currentTenant: null, permissionCodes: [] },
  superadminTenant: { isSuperAdmin: true, currentTenant: { id: 't' }, permissionCodes: [] },
  manageAll: { isSuperAdmin: false, currentTenant: { id: 't' }, permissionCodes: ['manage:all'] },
  editorialOnly: { isSuperAdmin: false, currentTenant: { id: 't' }, permissionCodes: [read, update] },
}
const GLOBAL_SAFE_PLACE = '/admin/tenants'

let wrapper: ReturnType<typeof mount>
const render = async () => { wrapper = mount(ProductEditorialView); await flushPromises() }
const backButton = () => wrapper.get('button.guided-back')

/** Every header name and URL/param the editorial view sent: none may name a tenant. */
function sentTenantTraces(): string[] {
  const traces: string[] = []
  for (const call of [...http.get.mock.calls, ...http.post.mock.calls, ...http.put.mock.calls]) {
    const url = String(call[0])
    if (/tenant/i.test(url)) traces.push(url)
    for (const arg of call.slice(1)) {
      const config = arg as { headers?: Record<string, unknown>; params?: Record<string, unknown> } | undefined
      for (const key of Object.keys(config?.headers ?? {})) if (/tenant/i.test(key)) traces.push(key)
      for (const key of Object.keys(config?.params ?? {})) if (/tenant/i.test(key)) traces.push(key)
    }
  }
  return traces
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(auth, { ...ACTORS.editorialOnly, permissionsLoaded: true })
  productGetById.mockResolvedValue({ name: 'Collar ajustable' })
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary')
    ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success()))
})
afterEach(() => wrapper?.unmount())

describe('«Volver» per admitted actor', () => {
  it('Super Admin in global mode goes back to the global tenants page, never a tenant route', async () => {
    Object.assign(auth, ACTORS.superadminGlobal)
    await render()
    await backButton().trigger('click')
    expect(routerPush).toHaveBeenCalledWith(GLOBAL_SAFE_PLACE)
    expect(routerPush).not.toHaveBeenCalledWith(expect.stringMatching(/^\/pos\//))
    expect(backButton().attributes('aria-label')).toBe('Volver a sucursales')
  })

  it.each(['superadminTenant', 'manageAll', 'editorialOnly'] as const)('%s with a tenant goes back to the product', async actor => {
    Object.assign(auth, ACTORS[actor])
    await render()
    await backButton().trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/products/p1')
    expect(backButton().attributes('aria-label')).toBe('Volver al producto')
  })

  it('switching to global mode while open re-targets «Volver» at once', async () => {
    Object.assign(auth, ACTORS.superadminTenant)
    await render()
    auth.currentTenant = null
    await flushPromises()
    await backButton().trigger('click')
    expect(routerPush).toHaveBeenCalledWith(GLOBAL_SAFE_PLACE)
  })

  it('manage:all without a tenant is not global mode: no Super Admin claim, no global target', async () => {
    Object.assign(auth, { isSuperAdmin: false, currentTenant: null, permissionCodes: ['manage:all'] })
    await render()
    await backButton().trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/products/p1')
  })
})

describe('product title', () => {
  it.each(['superadminGlobal', 'superadminTenant', 'manageAll'] as const)('%s reads the name through GET /products/:id with no tenant in the request', async actor => {
    Object.assign(auth, ACTORS[actor])
    await render()
    expect(productGetById).toHaveBeenCalledExactlyOnceWith('p1')
    expect(wrapper.get('h1').text()).toBe('Collar ajustable')
    expect(sentTenantTraces()).toEqual([])
  })

  // Live run 1 (2026-11-18): editorial-only has no read:Product by design, so GET /products/:id is a
  // 403. The editorial payload carries no product name, so the title is «Producto» with no lookup.
  it('editorial-only (no read:Product) never asks GET /products/:id and titles «Producto»', async () => {
    Object.assign(auth, ACTORS.editorialOnly)
    await render()
    expect(productGetById).not.toHaveBeenCalled()
    expect(wrapper.get('h1').text()).toBe('Producto')
    expect(wrapper.find('[data-testid="editorial-title-skeleton"]').exists()).toBe(false)
    expect(wrapper.findComponent(EditorialWorkspace).exists()).toBe(true)
    expect(sentTenantTraces()).toEqual([])
  })

  it('editorial grants plus read:Product read the name', async () => {
    Object.assign(auth, { ...ACTORS.editorialOnly, permissionCodes: [read, update, 'read:Product'] })
    await render()
    expect(productGetById).toHaveBeenCalledExactlyOnceWith('p1')
    expect(wrapper.get('h1').text()).toBe('Collar ajustable')
  })

  it('waits for permissions before deciding, then reads the name once they allow it', async () => {
    Object.assign(auth, { ...ACTORS.manageAll, permissionsLoaded: false, permissionCodes: [] })
    await render()
    expect(productGetById).not.toHaveBeenCalled()
    Object.assign(auth, { permissionsLoaded: true, permissionCodes: ['manage:all'] })
    await flushPromises()
    expect(productGetById).toHaveBeenCalledExactlyOnceWith('p1')
    expect(wrapper.get('h1').text()).toBe('Collar ajustable')
  })

  it.each([
    ['403', { response: { status: 403 } }],
    ['404', { response: { status: 404 } }],
    ['500', { response: { status: 500 } }],
    ['network', new Error('offline')],
    ['non-object', null],
  ])('global mode: a %s failure falls back quietly to «Producto» and keeps the editor', async (_label, failure) => {
    Object.assign(auth, ACTORS.superadminGlobal)
    productGetById.mockRejectedValue(failure)
    await render()
    expect(wrapper.get('h1').text()).toBe('Producto')
    expect(wrapper.findComponent(EditorialWorkspace).exists()).toBe(true)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No encontramos el producto')
  })

  it('global mode: an unnamed product is «Producto», not an empty title', async () => {
    Object.assign(auth, ACTORS.superadminGlobal)
    productGetById.mockResolvedValue({ name: '' })
    await render()
    expect(wrapper.get('h1').text()).toBe('Producto')
  })

  it('with a tenant, a 404 stays the missing-product state with a way back to the products list', async () => {
    Object.assign(auth, ACTORS.superadminTenant)
    productGetById.mockRejectedValue({ response: { status: 404 } })
    await render()
    expect(wrapper.text()).toContain('No encontramos el producto')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/products')
  })
})

describe('workspace exit', () => {
  it('global mode: the workspace «back» also lands on the global tenants page', async () => {
    Object.assign(auth, ACTORS.superadminGlobal)
    await render()
    wrapper.findComponent(EditorialWorkspace).vm.$emit('back')
    expect(wrapper.findComponent(EditorialWorkspace).props('backLabel')).toBe('Volver a sucursales')
    expect(routerPush).toHaveBeenCalledWith(GLOBAL_SAFE_PLACE)
  })

  it('with a tenant: the workspace «back» goes to the products list', async () => {
    await render()
    wrapper.findComponent(EditorialWorkspace).vm.$emit('back')
    expect(wrapper.findComponent(EditorialWorkspace).props('backLabel')).toBe('Volver a productos')
    expect(routerPush).toHaveBeenCalledWith('/pos/products')
  })
})
