import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DueDateEditModal from '../DueDateEditModal.vue'

const mocks = vi.hoisted(() => ({
  setDueDateMock: vi.fn(),
}))

vi.mock('@/features/POS/sales/composables/useSaleDueDate', async () => {
  const { ref } = await import('vue')
  return {
    useSaleDueDate: () => ({
      setDueDate: mocks.setDueDateMock,
      isPending: ref(false),
      lastError: ref(null),
    }),
  }
})

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const modalStub = { template: '<div><slot name="body" /><slot name="footer" /></div>' }
const inputStub = {
  props: ['modelValue', 'type', 'min', 'disabled'],
  emits: ['update:modelValue'],
  template: `<input
    :value="modelValue"
    :type="type"
    :min="min"
    :disabled="disabled"
    @input="$emit('update:modelValue', $event.target.value)"
  />`,
}
const buttonStub = {
  props: ['label', 'disabled', 'loading'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
}
const formFieldStub = {
  props: ['label'],
  template: '<label>{{ label }}<slot /></label>',
}

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UFormField: formFieldStub,
  FormField: formFieldStub,
  UInput: inputStub,
  Input: inputStub,
  UButton: buttonStub,
  Button: buttonStub,
}

function mountModal(currentDueDate: string | null = null) {
  return mount(DueDateEditModal, {
    props: { open: true, saleId: 'sale-1', currentDueDate },
    global: { stubs },
  })
}

describe('DueDateEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setDueDateMock.mockResolvedValue(undefined)
  })

  it('prefills the input with currentDueDate (YYYY-MM-DD)', () => {
    const wrapper = mountModal('2026-06-15T00:00:00.000Z')
    const input = wrapper.get('[data-testid="due-date-input"]').element as HTMLInputElement
    expect(input.value).toBe('2026-06-15')
  })

  it('prefills empty when currentDueDate is null', () => {
    const wrapper = mountModal(null)
    const input = wrapper.get('[data-testid="due-date-input"]').element as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('disables Guardar when input is empty', () => {
    const wrapper = mountModal(null)
    const save = wrapper.get('[data-testid="due-date-save"]')
    expect((save.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Guardar when input is in the past', async () => {
    const wrapper = mountModal(null)
    await wrapper.get('[data-testid="due-date-input"]').setValue('2020-01-01')
    const save = wrapper.get('[data-testid="due-date-save"]')
    expect((save.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking Guardar calls setDueDate with the chosen date and emits close', async () => {
    const wrapper = mountModal(null)
    // Pick a date far in the future to be safe across clocks
    await wrapper.get('[data-testid="due-date-input"]').setValue('2099-12-31')
    await wrapper.get('[data-testid="due-date-save"]').trigger('click')
    await flushPromises()

    expect(mocks.setDueDateMock).toHaveBeenCalledWith('2099-12-31')
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('Limpiar fecha button is visible when currentDueDate is set and clears via null', async () => {
    const wrapper = mountModal('2026-06-15T00:00:00.000Z')
    const clear = wrapper.get('[data-testid="due-date-clear"]')
    await clear.trigger('click')
    await flushPromises()

    expect(mocks.setDueDateMock).toHaveBeenCalledWith(null)
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('Limpiar fecha is hidden when there is no current due date', () => {
    const wrapper = mountModal(null)
    expect(wrapper.find('[data-testid="due-date-clear"]').exists()).toBe(false)
  })
})
