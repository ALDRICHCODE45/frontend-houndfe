import { describe, it, expect, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleTimelineEvent } from '../../interfaces/sale.types'

const toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAdd }))

import SaleDetailHistoryCard from '../SaleDetailHistoryCard.vue'

const baseTimeline: SaleTimelineEvent[] = [
  { type: 'SALE_REGISTERED', at: '2026-05-06T14:41:00.000Z', actor: null, register: 'Principal' },
  { type: 'COMMENT', at: '2026-05-06T14:44:00.000Z', actor: { id: 'u-1', name: 'Ana' }, commentId: 'c-1', body: 'Test comment' },
]

describe('SaleDetailHistoryCard', () => {
  // REQ-LAYOUT-002 / REQ-LAYOUT-007: the wrapper composes a single outer UCard
  // titled "HISTORIAL" with Timeline in body and CommentInput in footer.
  // The Timeline's own inner UCard (cosmetic, accepted per design D2) coexists.
  it('renders the outer HISTORIAL UCard with Timeline body and CommentInput footer', () => {
    const wrapper = mountWithUApp(SaleDetailHistoryCard, {
      props: {
        timeline: baseTimeline,
        currentUserId: 'u-1',
        commentsPending: false,
        onUpdateComment: vi.fn().mockResolvedValue(undefined),
        onDeleteComment: vi.fn().mockResolvedValue(undefined),
        onSubmitComment: vi.fn().mockResolvedValue(undefined),
      },
    })

    // The outer wrapper card carries the uppercase "HISTORIAL" title
    // (Timeline's inner card uses lowercase "Historial").
    const outerHeaders = wrapper.findAll('[data-slot="header"]')
    const outerCardTitle = outerHeaders.find((h) => h.text() === 'HISTORIAL')
    expect(outerCardTitle).toBeTruthy()

    // Timeline events render in the body (real SaleDetailTimeline)
    const events = wrapper.findAll('[data-testid="timeline-event"]')
    expect(events).toHaveLength(2)
    expect(wrapper.get('[data-testid="timeline-comment-body"]').text()).toContain('Test comment')

    // CommentInput renders in the outer card footer with its trigger
    expect(wrapper.get('[data-testid="sale-comment-input"]').text()).toContain('')
    expect(wrapper.get('[data-testid="comment-open"]').text()).toContain('Agregar comentario')
  })

  // REQ-LAYOUT-002 S2: empty timeline still renders card shell + composer.
  it('renders outer card shell and composer when timeline is empty', () => {
    const wrapper = mountWithUApp(SaleDetailHistoryCard, {
      props: {
        timeline: [],
        currentUserId: null,
        commentsPending: false,
        onSubmitComment: vi.fn().mockResolvedValue(undefined),
      },
    })

    const outerHeaders = wrapper.findAll('[data-slot="header"]')
    const outerCardTitle = outerHeaders.find((h) => h.text() === 'HISTORIAL')
    expect(outerCardTitle).toBeDefined()
    expect(wrapper.findAll('[data-testid="timeline-event"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="sale-comment-input"]').text()).toContain('')
  })

  // REQ-LAYOUT-007 S2: keyboard focus order body→footer.
  it('places the composer after the timeline in DOM order (body then footer)', () => {
    const wrapper = mountWithUApp(SaleDetailHistoryCard, {
      props: {
        timeline: baseTimeline,
        currentUserId: 'u-1',
        commentsPending: false,
        onUpdateComment: vi.fn().mockResolvedValue(undefined),
        onDeleteComment: vi.fn().mockResolvedValue(undefined),
        onSubmitComment: vi.fn().mockResolvedValue(undefined),
      },
    })

    const timeline = wrapper.get('[data-testid="timeline-event"]').element
    const composer = wrapper.get('[data-testid="sale-comment-input"]').element
    // timeline (body) must appear before composer (footer) in DOM order
    expect(timeline.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // HST-REQ-007: child components retain their testids.
  it('preserves child testids on Timeline and CommentInput (HST-REQ-007)', () => {
    const wrapper = mountWithUApp(SaleDetailHistoryCard, {
      props: {
        timeline: baseTimeline,
        currentUserId: 'u-1',
        commentsPending: false,
        onUpdateComment: vi.fn().mockResolvedValue(undefined),
        onDeleteComment: vi.fn().mockResolvedValue(undefined),
        onSubmitComment: vi.fn().mockResolvedValue(undefined),
      },
    })

    expect(wrapper.find('[data-testid="timeline-event"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sale-comment-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="comment-open"]').exists()).toBe(true)
  })

  // ── sale-detail-redesign WU-E — after dropping the internal UCard on
  // SaleDetailTimeline, the HistoryCard wrapper is the ONLY UCard in the
  // rendered DOM. Timeline body + composer footer both live inside it.
  it('renders exactly one UCard wrapper with "HISTORIAL" header (no nested timeline card)', () => {
    const wrapper = mountWithUApp(SaleDetailHistoryCard, {
      props: {
        timeline: baseTimeline,
        currentUserId: 'u-1',
        commentsPending: false,
        onUpdateComment: vi.fn().mockResolvedValue(undefined),
        onDeleteComment: vi.fn().mockResolvedValue(undefined),
        onSubmitComment: vi.fn().mockResolvedValue(undefined),
      },
    })

    // Exactly one UCard root (the wrapper).
    const roots = wrapper.findAll('[data-slot="root"]')
    expect(roots).toHaveLength(1)
    // Exactly one header slot, carrying the "HISTORIAL" title.
    const headers = wrapper.findAll('[data-slot="header"]')
    expect(headers).toHaveLength(1)
    expect(headers[0]?.text()).toBe('HISTORIAL')

    // Body still mounts timeline events; footer still mounts the composer.
    expect(wrapper.findAll('[data-testid="timeline-event"]')).toHaveLength(2)
    // wrapper.get() throws if missing; binding the result is enough to
    // assert the testid is present without a redundant .exists() call.
    const _composer = wrapper.get('[data-testid="sale-comment-input"]')
    void _composer
  })
})
