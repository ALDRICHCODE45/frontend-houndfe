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
  it('preserves the standalone main heading and both existing surfaces by default', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1' } })
    await flushPromises()
    expect(wrapper.element.tagName).toBe('MAIN')
    expect(wrapper.get('h1').text()).toBe('Contenido editorial')
    expect(wrapper.get('#editorial-form').isVisible()).toBe(true)
    expect(wrapper.get('.editorial-state').isVisible()).toBe(true)
    expect(http.get).toHaveBeenCalledTimes(3)
  })

  it('embeds as a labelled section rather than adding a nested main landmark', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
    await flushPromises()
    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.get('#editorial-workspace-title').element.tagName).toBe('H2')
    expect(wrapper.attributes('aria-labelledby')).toBe('editorial-workspace-title')
  })

  it('switches content and review without replacing raw editing controls or sending requests', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true, activeSection: 'content' } })
    await flushPromises()
    const title = wrapper.get('#editorial-title').element
    await wrapper.get('#editorial-title').setValue('  Mi borrador 😀  ')
    expect(wrapper.get('#editorial-form').isVisible()).toBe(true)
    expect(wrapper.get('.editorial-state').isVisible()).toBe(false)
    await wrapper.setProps({ activeSection: 'review' })
    expect(wrapper.get('#editorial-form').attributes('style')).toContain('display: none')
    expect(wrapper.get('#editorial-form').isVisible()).toBe(false)
    expect(wrapper.get('.editorial-state').isVisible()).toBe(true)
    await wrapper.setProps({ activeSection: 'content' })
    expect(wrapper.get('#editorial-title').element).toBe(title)
    expect((title as HTMLInputElement).value).toBe('  Mi borrador 😀  ')
    expect(http.get).toHaveBeenCalledTimes(3)
    expect(http.put).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })
})
