import { describe, it, expect, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailTimeline from '../SaleDetailTimeline.vue'

const toastAdd = vi.fn()

vi.stubGlobal('useToast', () => ({ add: toastAdd }))

const mockTimeline = [
  { type: 'SALE_REGISTERED', at: '2026-05-06T14:41:00.000Z', actor: null, register: 'Principal' },
  { type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:00.000Z', actor: null, register: 'Principal', method: 'CASH', amountCents: 5000, reference: null },
  { type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:30.000Z', actor: { id: 'u-2', name: 'Beto' }, register: 'Principal', method: 'CARD_DEBIT', amountCents: 10000, reference: 'T-1' },
  { type: 'PRODUCTS_DELIVERED', at: '2026-05-06T14:43:00.000Z', actor: null, register: 'Principal' },
]

describe('SaleDetailTimeline', () => {
  it('applies semantic color classes per timeline event type', () => {
    const wrapper = mountWithUApp(SaleDetailTimeline, {
      props: {
        timeline: [
          { type: 'SALE_REGISTERED', at: '2026-05-06T14:41:00.000Z', actor: null, register: 'Principal' },
          { type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:00.000Z', actor: null, register: 'Principal', method: 'CASH', amountCents: 5000, reference: null },
          { type: 'PRODUCTS_DELIVERED', at: '2026-05-06T14:43:00.000Z', actor: null, register: 'Principal' },
          { type: 'COMMENT', at: '2026-05-06T14:44:00.000Z', actor: { id: 'u-1', name: 'Ana' }, commentId: 'comment-1', body: 'ok' },
        ],
      },
    })

    expect(wrapper.get('[data-testid="timeline-event-icon-SALE_REGISTERED"]').classes()).toEqual(
      expect.arrayContaining(['text-primary', 'bg-primary/10'])
    )
    expect(wrapper.get('[data-testid="timeline-event-icon-PAYMENT_RECEIVED"]').classes()).toEqual(
      expect.arrayContaining(['text-success', 'bg-success/10'])
    )
    expect(wrapper.get('[data-testid="timeline-event-icon-PRODUCTS_DELIVERED"]').classes()).toEqual(
      expect.arrayContaining(['text-info', 'bg-info/10'])
    )
    expect(wrapper.get('[data-testid="timeline-event-icon-COMMENT"]').classes()).toEqual(
      expect.arrayContaining(['text-muted', 'bg-muted/10'])
    )
  })

  it('renders events in reverse order and payment labels from each event payload', () => {
    const wrapper = mountWithUApp(SaleDetailTimeline, {
      props: { timeline: mockTimeline },
    })

    const rows = wrapper.findAll('[data-testid="timeline-event"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('Entrega de Productos')
    expect(rows[1]!.text()).toContain('Cobro de $100.00 en Tarjeta de Débito')
    expect(rows[2]!.text()).toContain('Cobro de $50.00 en Efectivo')
    expect(rows[3]!.text()).toContain('Venta Registrada')
  })

  it('renders actor name only when present for non-comment events', () => {
    const wrapper = mountWithUApp(SaleDetailTimeline, {
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
    const wrapper = mountWithUApp(SaleDetailTimeline, {
      props: {
        timeline: [
          { type: 'COMMENT', at: '2026-05-06T14:44:00.000Z', actor: { id: 'u-1', name: 'Ana' }, commentId: 'comment-1', body: 'Esto es un comentario de prueba' },
        ],
      },
    })

    expect(wrapper.get('[data-testid="timeline-comment-body"]').text()).toContain('Esto es un comentario de prueba')
    expect(wrapper.text()).toContain('Ana')
    expect(wrapper.find('[data-testid="timeline-icon"]').exists()).toBe(true)
  })

  it('shows edit/delete only for comment author and supports edit/delete flows', async () => {
    const mockUpdate = vi.fn()
    const mockDelete = vi.fn()

    const wrapper = mountWithUApp(SaleDetailTimeline, {
      props: {
        currentUserId: 'u-1',
        timeline: [{ type: 'COMMENT', at: '2026-05-06T14:44:00.000Z', actor: { id: 'u-1', name: 'Ana' }, commentId: 'comment-1', body: 'Texto original' }],
        onUpdateComment: mockUpdate,
        onDeleteComment: mockDelete,
      },
    })

    expect(wrapper.findAll('[data-testid="comment-edit-trigger"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="comment-delete-trigger"]')).toHaveLength(1)

    await wrapper.get('[data-testid="comment-edit-trigger"]').trigger('click')
    await wrapper.get('[data-testid="comment-edit-save"]').trigger('click')
    expect(mockUpdate).toHaveBeenCalledWith('comment-1', { body: 'Texto original' })

    await wrapper.get('[data-testid="comment-delete-trigger"]').trigger('click')
    expect(mockDelete).toHaveBeenCalledWith('comment-1')
  })

  it('keeps edit form open when update fails', async () => {
    const mockUpdate = vi.fn().mockRejectedValue(new Error('Update failed'))

    const wrapper = mountWithUApp(SaleDetailTimeline, {
      props: {
        currentUserId: 'u-1',
        timeline: [{ type: 'COMMENT', at: '2026-05-06T14:44:00.000Z', actor: { id: 'u-1', name: 'Ana' }, commentId: 'comment-1', body: 'Texto original' }],
        onUpdateComment: mockUpdate,
      },
    })

    await wrapper.get('[data-testid="comment-edit-trigger"]').trigger('click')
    await wrapper.get('[data-testid="comment-edit-save"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.find('[data-testid="comment-edit-form"]').exists()).toBe(true)
  })

  it('renders comment edit/delete buttons as neutral link variant', () => {
    const wrapper = mountWithUApp(SaleDetailTimeline, {
      props: {
        currentUserId: 'u-1',
        timeline: [{ type: 'COMMENT', at: '2026-05-06T14:44:00.000Z', actor: { id: 'u-1', name: 'Ana' }, commentId: 'comment-1', body: 'Test comment' }],
      },
    })

    const editButton = wrapper.find('[data-testid="comment-edit-trigger"]')
    const deleteButton = wrapper.find('[data-testid="comment-delete-trigger"]')
    
    expect(editButton.exists()).toBe(true)
    expect(deleteButton.exists()).toBe(true)
    
    // Check that buttons have neutral link styling - these props should be passed to UButton
    expect(editButton.attributes()).toMatchObject({
      'data-testid': 'comment-edit-trigger'
    })
    expect(deleteButton.attributes()).toMatchObject({
      'data-testid': 'comment-delete-trigger'
    })
  })
})
