import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import AssignSellerSlideover from '../AssignSellerSlideover.vue'

const assignSeller = vi.fn()
const pending = ref(false)
vi.mock('../../composables/useSellerAssignment', () => ({
  useSellerAssignment: () => ({ assignSeller, isPending: pending }),
}))
vi.mock('@/features/POS/users/api/user.api', () => ({
  usersApi: { listAssignable: vi.fn().mockResolvedValue([{ id: 'seller-1', name: 'Ana Pérez' }]) },
}))
const cleanup: Array<() => void> = []
beforeEach(() => {
  pending.value = false
  assignSeller.mockReset().mockResolvedValue(undefined)
})
afterEach(() => cleanup.splice(0).reverse().forEach(fn => fn()))
async function mountPicker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithUApp(AssignSellerSlideover, {
    props: { open: true, saleId: 'sale-1' },
    attachTo: document.body,
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] },
  })
  cleanup.push(() => { wrapper.vm.$.appContext.app.unmount(); client.clear() })
  await flushPromises()
  return wrapper
}

describe('AssignSellerSlideover installed control accessibility', () => {
  it('renders a native seller button and preserves selection and pending protection', async () => {
    const wrapper = await mountPicker()
    const row = document.querySelector<HTMLButtonElement>('[data-testid="seller-row-seller-1"]')!
    expect(row.tagName).toBe('BUTTON')
    expect(row.type).toBe('button')
    expect(row.textContent).toContain('Ana Pérez')
    row.focus()
    expect(document.activeElement).toBe(row)
    pending.value = true
    await flushPromises()
    expect(row.disabled).toBe(true)
    row.click()
    expect(assignSeller).not.toHaveBeenCalled()
    pending.value = false
    await flushPromises()
    row.click()
    await flushPromises()
    expect(assignSeller).toHaveBeenCalledExactlyOnceWith('seller-1')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('associates the dialog title and description with the visible header', async () => {
    await mountPicker()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent)
      .toBe('Asignar vendedor')
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent)
      .toBe('Selecciona un usuario activo del equipo')
  })

  it('names search and close controls without assigning a seller on dismissal', async () => {
    const wrapper = await mountPicker()
    const search = document.querySelector<HTMLInputElement>('input[aria-label="Buscar vendedor por nombre"]')
    expect(search).not.toBeNull()
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar asignación de vendedor"]')
    expect(close).not.toBeNull()
    close!.click()
    await flushPromises()
    expect(assignSeller).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})
