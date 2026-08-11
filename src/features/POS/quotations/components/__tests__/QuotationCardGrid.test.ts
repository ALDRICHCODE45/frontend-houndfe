import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationCardGrid from '../QuotationCardGrid.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

const sampleQuotation: QuotationResponseDto = {
  id: 'qtn-1',
  customerId: 'cust-1',
  customer: { id: 'cust-1', firstName: 'A', lastName: 'B', email: 'a@b' },
  globalPriceListId: null,
  priceListExplicitlySet: false,
  status: 'DRAFT',
  expiresAt: '2026-09-01T00:00:00.000Z',
  cancelReason: null,
  canceledAt: null,
  subtotalCents: 10000,
  discountCents: 0,
  totalCents: 10000,
  taxRate: null,
  taxCents: null,
  customerNotes: null,
  manuallyEnded: false,
  items: [],
  appliedPromotions: [],
  vetoedPromotionIds: [],
  optedInManualPromotionIds: [],
  effectiveStatus: 'DRAFT',
  sellerUserId: '',
  seller: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const QuotationCardStub = {
  name: 'QuotationCard',
  props: ['quotation', 'canDelete'],
  emits: ['click', 'navigate', 'delete'],
  template: '<article data-testid="quotation-card-stub" :data-qid="quotation.id" @click="$emit(\'click\', quotation)" @navigate="$emit(\'navigate\')" @delete="$emit(\'delete\')">{{ quotation.id }}</article>',
}

function mountGrid(props: Record<string, unknown> = {}) {
  return mount(QuotationCardGrid, {
    props: { quotations: [sampleQuotation], ...props },
    global: { stubs: { QuotationCard: QuotationCardStub } },
  })
}

describe('QuotationCardGrid — Employee ladder (REQ-19)', () => {
  it('renders the Employee ladder grid classes on the card container', () => {
    const wrapper = mountGrid()
    const grid = wrapper.find('[data-testid="quotation-cards-grid"]')
    expect(grid.exists()).toBe(true)
    expect(grid.classes()).toEqual(
      expect.arrayContaining([
        'grid',
        'gap-3',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-5',
        '2xl:grid-cols-7',
      ]),
    )
  })

  it('renders one QuotationCard per row', () => {
    const wrapper = mountGrid({
      quotations: [sampleQuotation, { ...sampleQuotation, id: 'qtn-2' }],
    })
    expect(wrapper.findAll('[data-testid="quotation-card-stub"]')).toHaveLength(2)
  })

  it('forwards card click events as card-click with the quotation', async () => {
    const wrapper = mountGrid({ quotations: [sampleQuotation] })
    await wrapper.get('[data-testid="quotation-card-stub"]').trigger('click')
    const events = wrapper.emitted('card-click')
    expect(events).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([sampleQuotation])
  })

  it('forwards the delete event from each card as grid delete', async () => {
    const wrapper = mountGrid({ quotations: [sampleQuotation], canDelete: true })
    // Find the stubbed QuotationCard component and emit on it.
    const card = wrapper.findComponent({ name: 'QuotationCard' })
    expect(card.exists()).toBe(true)
    card.vm.$emit('delete', sampleQuotation)
    await wrapper.vm.$nextTick()
    const events = wrapper.emitted('delete')
    expect(events).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([sampleQuotation])
  })

  it('forwards the navigate event from each card', async () => {
    const wrapper = mountGrid({ quotations: [sampleQuotation] })
    const card = wrapper.findComponent({ name: 'QuotationCard' })
    expect(card.exists()).toBe(true)
    card.vm.$emit('navigate')
    await wrapper.vm.$nextTick()
    const events = wrapper.emitted('navigate')
    expect(events).toBeDefined()
  })

  it('renders 8 pulse skeletons with border-default + bg-elevated when loading', () => {
    const wrapper = mountGrid({ quotations: [], loading: true })
    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons).toHaveLength(8)
    expect(skeletons[0]!.classes()).toEqual(
      expect.arrayContaining(['border-default', 'bg-elevated']),
    )
  })

  it('renders the empty state with i-lucide-file-text icon when there are no quotations', () => {
    const wrapper = mountGrid({
      quotations: [],
      loading: false,
      empty: 'No hay cotizaciones',
    })
    expect(wrapper.text()).toContain('No hay cotizaciones')
    expect(wrapper.find('[data-testid="quotation-card-stub"]').exists()).toBe(false)
    // Empty icon is the i-lucide-file-text glyph rendered by Nuxt UI's UIcon.
    const emptyContainer = wrapper.find('[data-testid="quotation-cards-empty"]')
    expect(emptyContainer.exists()).toBe(true)
    expect(emptyContainer.find('svg').exists()).toBe(true)
  })
})
