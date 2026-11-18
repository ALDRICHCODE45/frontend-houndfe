import { beforeEach, describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleTimelineEvent } from '../../interfaces/sale.types'

const toastAdd = vi.fn()
vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return {
    ...actual,
    useToast: () => ({
      add: toastAdd,
      update: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      toasts: ref([]),
    }),
  }
})

beforeEach(() => {
  toastAdd.mockReset()
})

import SaleDetailHistoryCard from '../SaleDetailHistoryCard.vue'

const baseTimeline: SaleTimelineEvent[] = [
  { type: 'SALE_REGISTERED', at: '2026-05-06T14:41:00.000Z', actor: null, register: 'Principal' },
  { type: 'COMMENT', at: '2026-05-06T14:44:00.000Z', actor: { id: 'u-1', name: 'Ana' }, commentId: 'c-1', body: 'Test comment' },
]

describe('SaleDetailHistoryCard', () => {
  // REQ-LAYOUT-002 / REQ-LAYOUT-007: the wrapper composes a single section
  // titled "Historial" with the Timeline, then the CommentInput under a hairline.
  it('renders the Historial section with the Timeline and the CommentInput after it', () => {
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

    // T6c: the wrapper is the shared HfSectionCard titled "Historial".
    expect(wrapper.get('section.hf-section-card .hf-section-card__title').text()).toBe('Historial')

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

    expect(wrapper.get('section.hf-section-card .hf-section-card__title').text()).toBe('Historial')
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

  // ── sale-detail-redesign WU-E / T6c — the HistoryCard wrapper is the ONLY
  // section in the rendered DOM (the shared HfSectionCard, no native UCard).
  // Timeline body + composer both live inside it.
  it('renders exactly one section card with "Historial" heading (no nested timeline card)', () => {
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

    const sections = wrapper.findAll('section.hf-section-card')
    expect(sections).toHaveLength(1)
    expect(sections[0]!.get('.hf-section-card__title').text()).toBe('Historial')
    expect(wrapper.findAll('[data-slot="header"]')).toHaveLength(0)

    // Body still mounts timeline events; the composer sits inside the same section.
    expect(sections[0]!.findAll('[data-testid="timeline-event"]')).toHaveLength(2)
    expect(sections[0]!.find('[data-testid="sale-comment-input"]').exists()).toBe(true)
  })
})
