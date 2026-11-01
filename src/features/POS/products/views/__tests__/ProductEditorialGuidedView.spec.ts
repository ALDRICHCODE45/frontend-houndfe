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
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'p1' } }) }))
let wrapper: ReturnType<typeof mount>
const button = (text: string) => wrapper.findAll('button').find(item => item.text() === text)!
async function render() {
  wrapper = mount(ProductEditorialView, { attachTo: window.document.body })
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  auth.permissionCodes = [read, update]
  auth.isSuperAdmin = false
  auth.currentTenant = { id: 't' }
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary')
    ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success()))
})
afterEach(() => wrapper?.unmount())

describe('guided standalone editorial workspace', () => {
  it('navigates freely with one mounted owner and retains raw controls without requests or saves', async () => {
    await render()
    expect(wrapper.findAll('main')).toHaveLength(1)
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAllComponents(EditorialWorkspace)).toHaveLength(1)
    expect(button('Contenido').attributes('aria-current')).toBe('page')
    const input = wrapper.get('#editorial-title').element
    await wrapper.get('#editorial-title').setValue('  local 😀  ')
    await button('Revisar').trigger('click')
    expect(wrapper.get('form').isVisible()).toBe(false)
    expect(wrapper.get('[aria-labelledby="publication-title"]').isVisible()).toBe(true)
    expect(button('Revisar').attributes('aria-current')).toBe('page')
    await button('Contenido').trigger('click')
    expect(wrapper.get('#editorial-title').element).toBe(input)
    expect((input as HTMLInputElement).value).toBe('  local 😀  ')
    expect(wrapper.get('form').isVisible()).toBe(true)
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(http.get.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['/products/p1/editorial', '/products/p1/editorial/context', '/catalog-editorial/vocabulary']))
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })
  it('separates local buffer, consulted revisions and historical acknowledgement in the private summary', async () => {
    http.put.mockResolvedValue(success(state({ ...document(), commercialTitle: 'ACK ONLY' }, 99)))
    await render()
    const summary = () => wrapper.get('[aria-label="Resumen editorial privado"]')
    expect(summary().text()).toContain(' exact ')
    expect(summary().text()).toContain('Borrador guardadoRevisión consultada 3')
    expect(summary().text()).toContain('Sin versión publicada')
    await wrapper.get('#editorial-title').setValue('LOCAL ONLY')
    expect(summary().text()).toContain('Cambios locales sin guardar')
    expect(summary().text()).not.toContain('LOCAL ONLY')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    await button('Revisar').trigger('click')
    expect(summary().text()).toContain('Acuse histórico; no es el estado actual')
    expect(summary().text()).toContain('Revisión consultada 3')
    expect(summary().text()).not.toContain('ACK ONLY')
    expect(wrapper.text()).toContain('Publicación pendiente de habilitación del backend')
  })
  it('keeps validation visible when saving from review without losing the invalid input', async () => {
    await render()
    await wrapper.get('#editorial-title').setValue('x'.repeat(201))
    await button('Revisar').trigger('click')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    const alert = wrapper.findAll('[role="alert"]').find(item => item.text().includes('TITLE_LIMIT'))!
    expect(alert.isVisible()).toBe(true)
    await button('Contenido').trigger('click')
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('x'.repeat(201))
    expect(http.put).not.toHaveBeenCalled()
  })
  it('keeps conflict and refresh/discard choices visible across both sections', async () => {
    http.put.mockRejectedValue(failure(409, 'CONFLICT'))
    await render()
    await wrapper.get('#editorial-title').setValue('LOCAL')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    await button('Revisar').trigger('click')
    expect(wrapper.findAll('p').find(item => item.text().includes('No se reenvía automáticamente'))!.isVisible()).toBe(true)
    await wrapper.get('[data-testid="refresh-discard"]').trigger('click')
    await button('Contenido').trigger('click')
    expect(wrapper.get('[aria-labelledby="discard-title"]').isVisible()).toBe(true)
    await wrapper.get('[data-testid="cancel-discard"]').trigger('click')
    expect((wrapper.get('#editorial-title').element as HTMLInputElement).value).toBe('LOCAL')
    expect(http.get).toHaveBeenCalledTimes(3)
  })
  it('keeps global admin access without a tenant or operational Product permissions', async () => {
    auth.isSuperAdmin = true
    auth.currentTenant = null
    auth.permissionCodes = []
    await render()
    expect(wrapper.get('form').isVisible()).toBe(true)
    await button('Revisar').trigger('click')
    expect(wrapper.get('[aria-label="Resumen editorial privado"]').isVisible()).toBe(true)
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(http.post).not.toHaveBeenCalled()
  })
  it('shows read-only history in Content and clears summary content on revoked editorial access', async () => {
    auth.permissionCodes = [read]
    await render()
    expect(wrapper.get('#editorial-draft').element.closest('section')!.parentElement!.style.display).not.toBe('none')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('[aria-label="Resumen editorial privado"]').text()).toContain(' exact ')
    auth.permissionCodes = []; await flushPromises()
    expect(wrapper.find('[aria-label="Resumen editorial privado"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(' exact ')
    expect(http.get).toHaveBeenCalledTimes(3)
  })
})
