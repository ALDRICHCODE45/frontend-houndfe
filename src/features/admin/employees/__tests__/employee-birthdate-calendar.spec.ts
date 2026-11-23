import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import EmployeeEditSlideover from '../components/EmployeeEditSlideover.vue'
import type { Employee } from '../interfaces/employee.types'

const update = vi.hoisted(() => vi.fn())
vi.mock('../composables/useUpdateEmployee', () => ({ useUpdateEmployee: () => ({ mutateAsync: update, isPending: ref(false) }) }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => ({ currentTenantId: 'test-tenant' }) }))
vi.mock('../composables/useManagerResolution', () => ({ useManagerResolution: () => ({ managerMap: ref(new Map()) }) }))
vi.mock('../composables/useManagerPicker', () => ({ useManagerPicker: () => ({ search: ref(''), isOpen: ref(false), managers: ref([]), isLoading: ref(false) }) }))

let wrapper: VueWrapper | undefined
const employee: Employee = {
  id: 'employee-test', employeeNumber: 'EMP-002', fullName: 'Luis Andrade',
  email: null, status: 'ACTIVE', contractType: 'PERMANENT', workModality: 'ONSITE',
  currentPosition: null, currentDepartment: null, managerId: null,
  hireDate: '2020-03-15', terminationDate: null, photoFileId: null, cvFileId: null,
  dateOfBirth: '1988-09-22',
}

afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.clearAllMocks() })

beforeEach(async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  await router.push('/')
  await router.isReady()
  wrapper = mount(defineComponent({
    setup() {
      const open = ref(true)
      return () => h(UApp, null, { default: () => [
        h('button', { 'data-testid': 'reopen', onClick: () => { open.value = true } }, 'Reopen'),
        h(EmployeeEditSlideover, {
          employee, open: open.value, 'onUpdate:open': (value: boolean) => { open.value = value },
        }),
      ] })
    },
  }), { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
})

it('names the native manager trigger for its field', async () => {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Jefe directo"]')
  expect(trigger).not.toBeNull()
  expect(trigger?.textContent).toContain('Seleccionar jefe directo')
  // Installed ComboboxTrigger opens on click; real keyboard activation is browser-verified.
  trigger!.click()
  await flushPromises()
  expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  expect(update).not.toHaveBeenCalled()
})

it('allows a historical birthdate draft and cancels without an employee mutation', async () => {
  const trigger = document.querySelector<HTMLButtonElement>('[data-testid="date-field-popover"]')!
  expect(trigger.textContent).toContain('1988')
  trigger.click()
  await flushPromises()
  const day = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-slot="cellTrigger"]'))
    .find((element) => element.textContent?.trim() === '23')!
  expect(day).toBeTruthy()
  expect(day.getAttribute('aria-disabled')).not.toBe('true')
  day.click()
  await flushPromises()
  expect(trigger.textContent).toContain('23 de septiembre de 1988')
  // The slideover has no footer cancel button; it is dismissed with its close control.
  const close = document.querySelector<HTMLButtonElement>('button[aria-label="Close"], button[aria-label="Cerrar"]')!
  close.click()
  await flushPromises()
  expect(wrapper!.findComponent(EmployeeEditSlideover).emitted('update:open')).toContainEqual([false])
  expect(update).not.toHaveBeenCalled()
  expect(employee.dateOfBirth).toBe('1988-09-22')
  await wrapper!.get('[data-testid="reopen"]').trigger('click')
  await flushPromises()
  expect(document.querySelector('[data-testid="date-field-popover"]')?.textContent)
    .toContain('22 de septiembre de 1988')
  expect(update).not.toHaveBeenCalled()
})
