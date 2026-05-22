import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCommentInput from '../SaleCommentInput.vue'

const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

const SaleCommentSlideoverStub = {
  name: 'SaleCommentSlideover',
  props: ['open', 'isPending'],
  emits: ['update:open', 'submit'],
  template: '<div data-testid="sale-comment-slideover" :data-open="String(open)" :data-pending="String(isPending)" />',
}

const globalStubs = {
  UButton: {
    props: ['disabled', 'variant', 'color', 'icon'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" :data-variant="variant" :data-color="color" :data-icon="icon" @click="$emit(\'click\')"><slot /></button>',
  },
  Button: {
    props: ['disabled', 'variant', 'color', 'icon'],
    emits: ['click'],
    template:
      '<button :disabled="disabled" :data-variant="variant" :data-color="color" :data-icon="icon" @click="$emit(\'click\')"><slot /></button>',
  },
  SaleCommentSlideover: SaleCommentSlideoverStub,
}

describe('SaleCommentInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a single Agregar comentario trigger button with icon', () => {
    const wrapper = mount(SaleCommentInput, {
      props: { onSubmit: vi.fn().mockResolvedValue(undefined) },
      global: { stubs: globalStubs },
    })

    const button = wrapper.get('[data-testid="comment-open"]')
    expect(button.text()).toContain('Agregar comentario')
    expect(button.attributes('data-variant')).toBe('soft')
    expect(button.attributes('data-color')).toBe('primary')
    expect(button.attributes('data-icon')).toContain('message')
  })

  it('opens internal slideover when trigger is clicked', async () => {
    const wrapper = mount(SaleCommentInput, {
      props: { onSubmit: vi.fn().mockResolvedValue(undefined) },
      global: { stubs: globalStubs },
    })

    expect(wrapper.get('[data-testid="sale-comment-slideover"]').attributes('data-open')).toBe('false')
    await wrapper.get('[data-testid="comment-open"]').trigger('click')

    expect(wrapper.get('[data-testid="sale-comment-slideover"]').attributes('data-open')).toBe('true')
  })

  it('forwards slideover submit payload to onSubmit callback', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(SaleCommentInput, { props: { onSubmit }, global: { stubs: globalStubs } })

    await wrapper.getComponent(SaleCommentSlideoverStub).vm.$emit('submit', { body: 'test' })

    expect(onSubmit).toHaveBeenCalledWith({ body: 'test' })
  })

  it('preserves isPending and onSubmit prop contract', () => {
    const wrapper = mount(SaleCommentInput, {
      props: { onSubmit: vi.fn().mockResolvedValue(undefined), isPending: true },
      global: { stubs: globalStubs },
    })

    expect(wrapper.getComponent(SaleCommentSlideoverStub).props('isPending')).toBe(true)
  })
})
