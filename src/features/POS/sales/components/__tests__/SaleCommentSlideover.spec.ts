import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCommentSlideover from '../SaleCommentSlideover.vue'

const stubs = {
  USlideover: {
    props: ['open'],
    template: '<div v-if="open"><slot name="content" /></div>',
  },
  Slideover: {
    props: ['open'],
    template: '<div v-if="open"><slot name="content" /></div>',
  },
  UButton: {
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  },
  Button: {
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  },
  UTextarea: {
    props: ['modelValue', 'autofocus'],
    emits: ['update:modelValue'],
    template:
      '<textarea ref="textarea" :value="modelValue" :autofocus="autofocus" data-testid="comment-body" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    methods: {
      focus() {
        ;((this as unknown as { $el: HTMLTextAreaElement }).$el).focus()
      },
    },
  },
  Textarea: {
    props: ['modelValue', 'autofocus'],
    emits: ['update:modelValue'],
    template:
      '<textarea ref="textarea" :value="modelValue" :autofocus="autofocus" data-testid="comment-body" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    methods: {
      focus() {
        ;((this as unknown as { $el: HTMLTextAreaElement }).$el).focus()
      },
    },
  },
}

describe('SaleCommentSlideover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('renders content when open=true and hides when open=false', () => {
    const opened = mount(SaleCommentSlideover, {
      props: { open: true },
      global: { stubs },
    })
    expect(opened.find('[data-testid="comment-form"]').exists()).toBe(true)

    const closed = mount(SaleCommentSlideover, {
      props: { open: false },
      global: { stubs },
    })
    expect(closed.find('[data-testid="comment-form"]').exists()).toBe(false)
  })

  it('renders UTextarea', () => {
    const wrapper = mount(SaleCommentSlideover, {
      props: { open: true },
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="comment-body"]').exists()).toBe(true)
  })

  it('emits submit with trimmed body when Guardar is clicked', async () => {
    const wrapper = mount(SaleCommentSlideover, {
      props: { open: true },
      global: { stubs },
    })

    await wrapper.get('[data-testid="comment-body"]').setValue('  hola  ')
    await wrapper.get('[data-testid="comment-submit"]').trigger('click')

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ body: 'hola' }])
  })

  it('does not emit submit for empty or whitespace body', async () => {
    const wrapper = mount(SaleCommentSlideover, {
      props: { open: true },
      global: { stubs },
    })

    await wrapper.get('[data-testid="comment-submit"]').trigger('click')
    await wrapper.get('[data-testid="comment-body"]').setValue('   ')
    await wrapper.get('[data-testid="comment-submit"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeFalsy()
  })

  it('emits update:open false on Cancelar', async () => {
    const wrapper = mount(SaleCommentSlideover, {
      props: { open: true },
      global: { stubs },
    })

    await wrapper.get('[data-testid="comment-cancel"]').trigger('click')
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('disables Guardar and shows loading when isPending=true', () => {
    const wrapper = mount(SaleCommentSlideover, {
      props: { open: true, isPending: true },
      global: { stubs },
    })

    const submit = wrapper.get('[data-testid="comment-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.attributes('data-loading')).toBe('true')
  })

  it('focuses textarea when opening', async () => {
    const wrapper = mount(SaleCommentSlideover, {
      props: { open: false },
      global: { stubs },
      attachTo: document.body,
    })

    await wrapper.setProps({ open: true })
    await Promise.resolve()

    expect(document.activeElement).toBe(wrapper.get('[data-testid="comment-body"]').element)
  })
})
