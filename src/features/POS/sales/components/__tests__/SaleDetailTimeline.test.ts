import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailTimeline from '../SaleDetailTimeline.vue'

const toastAdd = vi.fn()

vi.stubGlobal('useToast', () => ({ add: toastAdd }))

const globalStubs = {
  UCard: { template: '<div><slot /></div>' },
  UIcon: { props: ['name'], template: '<span :data-icon="name" data-testid="timeline-icon" />' },
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

describe('SaleDetailTimeline', () => {
  it('renders events in reverse order and payment labels from each event payload', () => {
    const wrapper = mount(SaleDetailTimeline, {
      global: { stubs: globalStubs },
      props: {
        timeline: [
          { type: 'SALE_REGISTERED', at: '2026-05-06T14:41:00.000Z', actor: null, register: 'Principal' },
          { type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:00.000Z', actor: null, register: 'Principal', method: 'CASH', amountCents: 5000, reference: null },
          { type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:30.000Z', actor: { id: 'u-2', name: 'Beto' }, register: 'Principal', method: 'CARD_DEBIT', amountCents: 10000, reference: 'T-1' },
          { type: 'PRODUCTS_DELIVERED', at: '2026-05-06T14:43:00.000Z', actor: null, register: 'Principal' },
        ],
      },
    })

    const rows = wrapper.findAll('[data-testid="timeline-event"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('Entrega de Productos')
    expect(rows[1]!.text()).toContain('Cobro de $100.00 en Tarjeta de Débito')
    expect(rows[2]!.text()).toContain('Cobro de $50.00 en Efectivo')
    expect(rows[3]!.text()).toContain('Venta Registrada')
  })

  it('renders actor name only when present for non-comment events', () => {
    const wrapper = mount(SaleDetailTimeline, {
      global: { stubs: globalStubs },
      props: {
        timeline: [
          { type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:00.000Z', actor: { id: 'u-1', name: 'Ana' }, register: 'Principal', method: 'CARD_CREDIT', amountCents: 50000, reference: null },
          { type: 'SALE_REGISTERED', at: '2026-05-06T14:41:00.000Z', actor: null, register: 'Principal' },
        ],
      },
    })

    const actors = wrapper.findAll('[data-testid="timeline-actor"]')
    expect(wrapper.text()).toContain('Ana')
    expect(actors).toHaveLength(1)
  })

  it('renders comment body, icon, and author', () => {
    const wrapper = mount(SaleDetailTimeline, {
      global: { stubs: globalStubs },
      props: {
        timeline: [
          {
            type: 'COMMENT',
            at: '2026-05-06T14:44:00.000Z',
            actor: { id: 'u-1', name: 'Ana' },
            commentId: 'comment-1',
            body: 'Cliente pidió factura',
          },
        ],
      },
    })

    expect(wrapper.get('[data-testid="timeline-comment-body"]').text()).toContain('Cliente pidió factura')
    expect(wrapper.text()).toContain('Ana')
    expect(wrapper.find('[data-testid="timeline-icon"]').exists()).toBe(true)
  })

  it('shows edit/delete only for comment author and supports edit/delete flows', async () => {
    const onUpdateComment = vi.fn().mockResolvedValue(undefined)
    const onDeleteComment = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(SaleDetailTimeline, {
      global: { stubs: globalStubs },
      props: {
        currentUserId: 'u-1',
        onUpdateComment,
        onDeleteComment,
        timeline: [
          {
            type: 'COMMENT',
            at: '2026-05-06T14:44:00.000Z',
            actor: { id: 'u-1', name: 'Ana' },
            commentId: 'comment-1',
            body: 'Texto original',
          },
          {
            type: 'COMMENT',
            at: '2026-05-06T14:45:00.000Z',
            actor: { id: 'u-2', name: 'Beto' },
            commentId: 'comment-2',
            body: 'Ajeno',
          },
        ],
      },
    })

    expect(wrapper.findAll('[data-testid="comment-edit-trigger"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="comment-delete-trigger"]')).toHaveLength(1)

    await wrapper.get('[data-testid="comment-edit-trigger"]').trigger('click')
    await wrapper.get('[data-testid="comment-edit-save"]').trigger('click')
    expect(onUpdateComment).toHaveBeenCalledWith('comment-1', { body: 'Texto original' })

    await wrapper.get('[data-testid="comment-delete-trigger"]').trigger('click')
    expect(onDeleteComment).toHaveBeenCalledWith('comment-1')
  })

  it('keeps edit form open when update fails', async () => {
    const wrapper = mount(SaleDetailTimeline, {
      global: { stubs: globalStubs },
      props: {
        currentUserId: 'u-1',
        onUpdateComment: vi.fn().mockRejectedValue(new Error('boom')),
        timeline: [
          {
            type: 'COMMENT',
            at: '2026-05-06T14:44:00.000Z',
            actor: { id: 'u-1', name: 'Ana' },
            commentId: 'comment-1',
            body: 'Texto original',
          },
        ],
      },
    })

    await wrapper.get('[data-testid="comment-edit-trigger"]').trigger('click')
    await wrapper.get('[data-testid="comment-edit-save"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.find('[data-testid="comment-edit-form"]').exists()).toBe(true)
  })
})
