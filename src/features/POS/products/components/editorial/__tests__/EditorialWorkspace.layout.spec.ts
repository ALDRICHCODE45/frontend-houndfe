import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import { read, update, state, success, vocabularyEnvelope } from '../../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
let wrapper: ReturnType<typeof mount>

beforeEach(() => {
  vi.resetAllMocks()
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary')
    ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state())))
})
afterEach(() => { wrapper?.unmount(); document.body.replaceChildren() })

describe('editorial workspace presentation boundary', () => {
  it('preserves the standalone main heading, with the form and no second surface for history', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1' } })
    await flushPromises()
    expect(wrapper.element.tagName).toBe('MAIN')
    expect(wrapper.get('h1').text()).toBe('Contenido')
    expect(wrapper.get('#editorial-form').isVisible()).toBe(true)
    expect(wrapper.find('.editorial-state').exists()).toBe(false)
    expect(http.get).toHaveBeenCalledTimes(3)
  })

  it('embeds as a labelled section rather than adding a nested main landmark', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
    await flushPromises()
    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.get('#editorial-workspace-title').element.tagName).toBe('H2')
    expect(wrapper.get('#editorial-workspace-title').text()).toBe('Contenido')
    expect(wrapper.attributes('aria-labelledby')).toBe('editorial-workspace-title')
  })

  it('has no Revisar section: one flow, one form', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
    await flushPromises()
    expect(wrapper.findAll('form')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Revisar')
    expect(wrapper.findComponent({ name: 'EditorialPublication' }).exists()).toBe(false)
  })

  it('opening and closing the history keeps the raw controls and sends no request', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
    await flushPromises()
    const title = wrapper.get('#editorial-title').element
    await wrapper.get('#editorial-title').setValue('  Mi borrador 😀  ')
    await wrapper.get('[data-testid="open-history"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 60))
    document.querySelector<HTMLButtonElement>('[aria-label="Cerrar historial"]')!.click()
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(wrapper.get('#editorial-title').element).toBe(title)
    expect((title as HTMLInputElement).value).toBe('  Mi borrador 😀  ')
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })
})
