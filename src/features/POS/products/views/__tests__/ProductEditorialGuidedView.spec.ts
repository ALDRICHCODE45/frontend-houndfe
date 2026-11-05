import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ProductEditorialView from '../ProductEditorialView.vue'
import EditorialWorkspace from '../../components/editorial/EditorialWorkspace.vue'
import { document, state, success, vocabularyEnvelope, read, update, failure } from '../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isSuperAdmin: false, isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' } as { id: string } | null, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const routerPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'p1' } }), useRouter: () => ({ push: routerPush }) }))
const productGetById = vi.hoisted(() => vi.fn())
vi.mock('../../api/product.api', () => ({ productApi: { getById: productGetById } }))
let wrapper: ReturnType<typeof mount>
async function render() {
  wrapper = mount(ProductEditorialView, { attachTo: window.document.body })
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  productGetById.mockResolvedValue({ name: 'Collar ajustable' })
  auth.permissionCodes = [read, update]
  auth.isSuperAdmin = false
  auth.currentTenant = { id: 't' }
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary')
    ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success()))
})
afterEach(() => wrapper?.unmount())

describe('guided standalone editorial workspace', () => {
  it('has one mounted owner and no Contenido/Revisar pair, and edits send no request', async () => {
    await render()
    expect(wrapper.findAll('main')).toHaveLength(1)
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAllComponents(EditorialWorkspace)).toHaveLength(1)
    // The only navigation is the index of the section cards.
    expect(wrapper.findAll('nav').map(item => item.attributes('aria-label'))).toEqual(['Secciones del contenido'])
    expect(wrapper.findAll('button').some(item => ['Contenido', 'Revisar'].includes(item.text()))).toBe(false)
    await wrapper.get('#editorial-title').setValue('  local 😀  ')
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('  local 😀  ')
    expect(wrapper.get('form').isVisible()).toBe(true)
    expect(http.get).toHaveBeenCalledTimes(4) // the coherent read and its readiness (T23)
    expect(http.get.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['/products/p1/editorial', '/products/p1/editorial/context', '/catalog-editorial/vocabulary']))
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })
  it('has no private summary aside: the save bar is the only place that says what is saved', async () => {
    http.put.mockResolvedValue(success(state({ ...document(), commercialTitle: 'ACK ONLY' }, 99)))
    await render()
    expect(wrapper.find('[aria-label="Resumen editorial privado"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Resumen editorial|Acuse histórico|Revisión consultada/)
    await wrapper.get('#editorial-title').setValue('LOCAL ONLY')
    expect(wrapper.get('.hf-save-bar__status').text()).toBe('1 cambio sin guardar')
    http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
      : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state({ ...document(), commercialTitle: 'LOCAL ONLY' }, 4))))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('.hf-save-bar__status').text()).toMatch(/^Guardado/)
    expect(wrapper.text()).not.toContain('ACK ONLY')
  })
  it('keeps validation next to the title without losing the invalid input', async () => {
    await render()
    await wrapper.get('#editorial-title').setValue('x'.repeat(201))
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('#editorial-title-message').text()).toBe('El título es demasiado largo. El máximo es 200 caracteres.')
    expect(wrapper.get('#editorial-title').attributes('aria-invalid')).toBe('true')
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('x'.repeat(201))
    expect(http.put).not.toHaveBeenCalled()
  })
  it('keeps the conflict and its choices above the form, in plain words', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await wrapper.get('#editorial-title').setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[data-testid="reconciliation"]').text()).toContain('Alguien más guardó cambios. Carga la versión más reciente para continuar.')
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    expect(wrapper.get('[aria-labelledby="discard-title"]').isVisible()).toBe(true)
    await wrapper.get('[data-testid="cancel-discard"]').trigger('click')
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('LOCAL')
    expect(http.get).toHaveBeenCalledTimes(4) // the coherent read and its readiness (T23)
  })
  it('keeps global admin access without a tenant or operational Product permissions', async () => {
    auth.isSuperAdmin = true
    auth.currentTenant = null
    auth.permissionCodes = []
    await render()
    expect(wrapper.get('form').isVisible()).toBe(true)
    expect(http.get).toHaveBeenCalledTimes(4) // the coherent read and its readiness (T23)
    expect(http.post).not.toHaveBeenCalled()
  })
  it('shows the saved content to a read-only user and clears it on revoked editorial access', async () => {
    auth.permissionCodes = [read]
    await render()
    expect(wrapper.get('[data-field="title"]').text()).toBe('exact')
    expect(wrapper.find('form').exists()).toBe(false)
    auth.permissionCodes = []; await flushPromises()
    expect(wrapper.find('[data-field="title"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('exact')
    expect(http.get).toHaveBeenCalledTimes(4) // the coherent read and its readiness (T23)
  })
})

describe('guided editorial view — review round 1', () => {
  it('names the product and offers a back control instead of a generic page title', async () => {
    await render()
    expect(wrapper.get('h1').text()).toBe('Collar ajustable')
    expect(wrapper.text()).not.toContain('Espacio editorial')
    await wrapper.get('button[aria-label="Volver al producto"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/products/p1')
  })

  it('does not stack a second page title over the workspace heading', async () => {
    await render()
    const h2s = wrapper.findAll('h2').map(item => item.text())
    expect(h2s.filter(text => text === 'Contenido')).toHaveLength(1)
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
  })
})

describe('guided editorial view — review round 2', () => {
  const readsFailing = (status: number, error: string) =>
    http.get.mockImplementation((url: string) => url.includes('vocabulary')
      ? Promise.resolve({ ...success(), data: vocabularyEnvelope() })
      : url.endsWith('/context') ? Promise.resolve({ status: 200, data: { variants: [] } }) : Promise.reject(failure(status, error)))

  it('not found: an empty state with one way back, no refresh beside it and no error design', async () => {
    readsFailing(404, 'NOT_FOUND')
    await render()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('No encontramos el contenido editorial')
    expect(wrapper.find('[data-kind="error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="refresh-retain"]').exists()).toBe(false)
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/products')
  })

  it('failed read: Reintentar is the only retry, the header offers no second "Consultar"', async () => {
    readsFailing(500, 'INTERNAL')
    await render()
    const error = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(error.get('[data-testid="empty-state-action"]').text()).toContain('Reintentar')
    expect(wrapper.find('[data-testid="refresh-retain"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Consultar y cargar borrador')
  })

  it('shows no developer cycle line, and the workspace heading is the calm «Contenido» under the product title', async () => {
    await render()
    expect(wrapper.text()).not.toContain('Ciclo editorial')
    const heading = wrapper.get('#editorial-workspace-title')
    expect(heading.element.tagName).toBe('H2')
    expect(heading.text()).toBe('Contenido')
    expect(wrapper.find('[data-testid="refresh-retain"]').exists()).toBe(false)
  })

  it('aligns with the page column instead of centering a capped box', () => {
    const view = readFileSync(resolve(__dirname, '../ProductEditorialView.vue'), 'utf8')
    const workspace = readFileSync(resolve(__dirname, '../../components/editorial/EditorialWorkspace.vue'), 'utf8')
    expect(view.match(/\.guided-workspace\s*\{[^}]*\}/)![0]).not.toMatch(/margin:\s*0 auto|max-width/)
    expect(workspace.match(/\.editorial-workspace\s*\{[^}]*\}/)![0]).not.toMatch(/margin:\s*0 auto|max-width/)
  })
})
