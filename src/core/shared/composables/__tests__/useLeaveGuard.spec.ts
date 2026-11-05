import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

const confirm = vi.hoisted(() => vi.fn<(options: unknown) => Promise<boolean>>())
vi.mock('../useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
import { LEAVE_COPY, useLeaveGuard } from '../useLeaveGuard'

const dirty = shallowRef(false)
const Editor = defineComponent({ props: { description: { type: String, default: undefined } }, setup(props) {
  useLeaveGuard(dirty, props.description ? { description: props.description } : undefined)
  return {}
}, template: '<p>Editor</p>' })
let wrapper: ReturnType<typeof mount> | undefined
async function render(description?: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/edit', component: Editor, props: { description } }, { path: '/away', component: { template: '<p>Away</p>' } }] })
  await router.push('/edit'); await router.isReady()
  wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router] } }); await flushPromises()
  return router
}
function unload() { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented }
afterEach(() => { wrapper?.unmount(); wrapper = undefined; dirty.value = false; confirm.mockReset(); vi.restoreAllMocks() })

describe('useLeaveGuard', () => {
  it('lets a clean editor leave without asking', async () => {
    const router = await render()
    await router.push('/away')
    expect(router.currentRoute.value.path).toBe('/away')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('asks with the default copy while dirty, stays on cancel and leaves on confirm', async () => {
    const router = await render()
    dirty.value = true
    confirm.mockResolvedValueOnce(false)
    await router.push('/away')
    expect(router.currentRoute.value.path).toBe('/edit')
    expect(confirm).toHaveBeenCalledWith({ title: '¿Salir sin guardar?', description: 'Tienes cambios sin guardar. Si sales ahora, se pierden.', confirmLabel: 'Salir sin guardar', cancelLabel: 'Seguir editando', tone: 'danger' })
    expect(LEAVE_COPY.title).toBe('¿Salir sin guardar?')
    confirm.mockResolvedValueOnce(true)
    await router.push('/away')
    expect(router.currentRoute.value.path).toBe('/away')
  })

  it('takes the feature description over the default', async () => {
    const router = await render('Tienes cambios sin guardar en el contenido.')
    dirty.value = true
    confirm.mockResolvedValueOnce(false)
    await router.push('/away')
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Salir sin guardar?', description: 'Tienes cambios sin guardar en el contenido.' }))
  })

  it('holds the browser prompt only while dirty and removes it on unmount', async () => {
    const add = vi.spyOn(window, 'addEventListener'); const remove = vi.spyOn(window, 'removeEventListener')
    await render()
    expect(unload()).toBe(false)
    dirty.value = true
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(unload()).toBe(true)
    dirty.value = false
    expect(unload()).toBe(false)
    dirty.value = true
    wrapper!.unmount(); wrapper = undefined
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(unload()).toBe(false)
  })

  it('works without a router: only the browser prompt is held', () => {
    wrapper = mount(Editor)
    dirty.value = true
    expect(unload()).toBe(true)
  })
})
