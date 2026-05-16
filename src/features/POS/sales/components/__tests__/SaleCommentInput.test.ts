import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCommentInput from '../SaleCommentInput.vue'

const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

const globalStubs = {
  UButton: {
    props: ['disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  UTextarea: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}

describe('SaleCommentInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expands input, cancels, and clears body', async () => {
    const wrapper = mount(SaleCommentInput, {
      props: { onSubmit: vi.fn().mockResolvedValue(undefined) },
      global: { stubs: globalStubs },
    })

    await wrapper.get('[data-testid="comment-open"]').trigger('click')
    await wrapper.get('[data-testid="comment-body"]').setValue('hola')
    await wrapper.get('[data-testid="comment-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="comment-form"]').exists()).toBe(false)

    await wrapper.get('[data-testid="comment-open"]').trigger('click')
    expect((wrapper.get('[data-testid="comment-body"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('disables submit for empty and whitespace-only body', async () => {
    const wrapper = mount(SaleCommentInput, {
      props: { onSubmit: vi.fn().mockResolvedValue(undefined) },
      global: { stubs: globalStubs },
    })

    await wrapper.get('[data-testid="comment-open"]').trigger('click')
    const submit = wrapper.get('[data-testid="comment-submit"]')

    expect(submit.attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="comment-body"]').setValue('   ')
    expect(submit.attributes('disabled')).toBeDefined()
  })

  it('collapses and clears on successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(SaleCommentInput, { props: { onSubmit }, global: { stubs: globalStubs } })

    await wrapper.get('[data-testid="comment-open"]').trigger('click')
    await wrapper.get('[data-testid="comment-body"]').setValue(' comentario ')
    await wrapper.get('[data-testid="comment-submit"]').trigger('click')

    expect(onSubmit).toHaveBeenCalledWith({ body: 'comentario' })
    expect(wrapper.find('[data-testid="comment-form"]').exists()).toBe(false)
  })

  it('keeps form open and shows toast on submit error', async () => {
    const wrapper = mount(SaleCommentInput, {
      props: { onSubmit: vi.fn().mockRejectedValue(new Error('boom')) },
      global: { stubs: globalStubs },
    })

    await wrapper.get('[data-testid="comment-open"]').trigger('click')
    await wrapper.get('[data-testid="comment-body"]').setValue('hola')
    await wrapper.get('[data-testid="comment-submit"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.find('[data-testid="comment-form"]').exists()).toBe(true)
    expect((wrapper.get('[data-testid="comment-body"]').element as HTMLTextAreaElement).value).toBe('hola')
  })
})
