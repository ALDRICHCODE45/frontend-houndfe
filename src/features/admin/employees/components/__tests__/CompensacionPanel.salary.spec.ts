/**
 * T22/S18 — The salary amount is typed as text and read with the one money
 * rule: `70,55` is never 7055 pesos, and the backend receives exact cents.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { Employee } from '../../interfaces/employee.types'

const { addSalaryChange } = vi.hoisted(() => ({ addSalaryChange: vi.fn(() => Promise.resolve()) }))

vi.mock('../../composables/useCompensacion', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useEmployeeSalaryHistory: () => ({ data: ref([]), isLoading: ref(false), isError: ref(false), refetch: vi.fn() }),
  useEmployeePositionHistory: () => ({ data: ref([]), isLoading: ref(false), isError: ref(false), refetch: vi.fn() }),
  useAddSalaryChange: () => ({ mutateAsync: addSalaryChange, isPending: ref(false) }),
  useAddPositionChange: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
}))

import CompensacionPanel from '../CompensacionPanel.vue'

const employee: Employee = {
  id: 'emp-uuid-1',
  employeeNumber: 'EMP-001',
  fullName: 'Ana García',
  email: 'ana@test.com',
  status: 'ACTIVE',
  contractType: 'PERMANENT',
  workModality: 'REMOTE',
  currentPosition: 'Gerente de tienda',
  currentDepartment: 'Operaciones',
  managerId: null,
  hireDate: '2023-01-15',
  terminationDate: null,
  photoFileId: null,
  cvFileId: null,
}

const DateFieldStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input data-testid="salary-date" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

function setValue(selector: string, value: string) {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
  if (!element) throw new Error(`Missing ${selector}`)
  element.value = value
  element.dispatchEvent(new Event('input'))
}

async function fillAndSubmit(amount: string) {
  const wrapper = mountWithUApp(CompensacionPanel, {
    props: { employee, canReadSalary: true, canCreateSalary: true, canUpdate: true },
    attachTo: document.body,
    global: { stubs: { DateFieldPopover: DateFieldStub } },
  })
  const open = wrapper.findAll('button').find((button) => button.text().includes('Nuevo ajuste'))
  await open!.trigger('click')
  await settle()
  setValue('#salary-amount', amount)
  document.querySelector<HTMLInputElement>('#salary-amount')!.dispatchEvent(new Event('blur'))
  setValue('[data-testid="salary-date"]', '2026-06-01')
  setValue('#add-salary-change-form textarea', 'Aumento anual')
  await settle()
  document.querySelector<HTMLFormElement>('#add-salary-change-form')!.dispatchEvent(new Event('submit'))
  await settle()
  return wrapper
}

afterEach(() => {
  addSalaryChange.mockClear()
  document.body.innerHTML = ''
})

describe('CompensacionPanel salary amount', () => {
  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
    ['45000', 4500000],
  ])('sends %j as %i cents', async (amount, cents) => {
    await fillAndSubmit(amount)
    expect(addSalaryChange).toHaveBeenCalledWith({
      amountCents: cents,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Aumento anual',
    })
  })

  it('does not send an amount that does not parse', async () => {
    await fillAndSubmit('1,23,4')
    expect(document.body.textContent).toContain('Escribe el monto con punto para los centavos, por ejemplo 70.55.')
    expect(addSalaryChange).not.toHaveBeenCalled()
  })
})
