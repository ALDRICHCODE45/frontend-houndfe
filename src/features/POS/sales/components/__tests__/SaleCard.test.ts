import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCard from '../SaleCard.vue'
import type { ConfirmedSaleRow } from '../../interfaces/sale.types'

const sale: ConfirmedSaleRow = {
  id: 'sale-1',
  folio: 'A-202605-000015',
  status: 'CONFIRMED',
  paymentStatus: 'PARTIAL',
  deliveryStatus: 'PENDING',
  totalCents: 120000,
  debtCents: 5000,
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: '2026-06-01T10:00:00.000Z',
  customer: { id: 'customer-1', name: 'Acme SA' },
  cashier: { id: 'cashier-1', name: 'Cajero' },
  seller: null,
  paymentMethods: ['CASH'],
}

function mountCard(overrides: Partial<ConfirmedSaleRow> = {}) {
  return mount(SaleCard, {
    props: { sale: { ...sale, ...overrides } },
    global: {
      stubs: {
        EntityAvatar: {
          props: ['name', 'seed', 'showDot', 'size'],
          template: '<div data-testid="entity-avatar" :data-seed="seed" :data-show-dot="String(showDot)" :data-size="size" />',
        },
        StatusDotBadge: {
          props: ['label', 'tone', 'compact'],
          template: '<span :data-tone="tone" :data-label="label">{{ label }}</span>',
        },
      },
    },
  })
}

describe('SaleCard — EmployeeCard pattern (REQ-13)', () => {
  it('renders an article root with border-default and bg-default surface', () => {
    const wrapper = mountCard()
    // wrapper.get throws if no article is found, so its presence is implicit.
    const article = wrapper.get('article')
    expect(article.classes()).toEqual(expect.arrayContaining(['border-default', 'bg-default']))
  })

  it('does NOT use bg-coco-neutral-* tokens on the article root', () => {
    const wrapper = mountCard()
    const article = wrapper.get('article')
    const classList = article.classes().join(' ')
    expect(classList).not.toContain('bg-coco-neutral')
    expect(classList).not.toContain('border-coco-neutral')
  })

  it('does NOT wrap content in a RouterLink', () => {
    const wrapper = mountCard()
    // No anchor element with href pointing at /pos/ventas/* should exist.
    const anchorHrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '')
    const detailAnchor = anchorHrefs.find((href) => href.includes('/pos/ventas/'))
    expect(detailAnchor).toBeUndefined()
  })

  it('emits click with the sale when the card is clicked', async () => {
    const wrapper = mountCard()
    await wrapper.get('article').trigger('click')
    const events = wrapper.emitted('click')
    expect(events).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([sale])
  })

  it('renders EntityAvatar seeded with the sale id and shows the status dot when CONFIRMED', () => {
    const wrapper = mountCard({ status: 'CONFIRMED' })
    const avatar = wrapper.get('[data-testid="entity-avatar"]')
    expect(avatar.attributes('data-seed')).toBe('sale-1')
    expect(avatar.attributes('data-show-dot')).toBe('true')
  })

  it('does not show the avatar status dot when the sale is not CONFIRMED', () => {
    const wrapper = mountCard({ status: 'DRAFT' })
    const avatar = wrapper.get('[data-testid="entity-avatar"]')
    expect(avatar.attributes('data-show-dot')).toBe('false')
  })

  it('renders both StatusDotBadges (sale status + delivery status)', () => {
    const wrapper = mountCard()
    const badges = wrapper.findAll('[data-tone]')
    const tones = badges.map((b) => b.attributes('data-tone'))
    expect(tones).toEqual(expect.arrayContaining(['success', 'error']))
  })

  it('renders exactly two StatusDotBadges in the chip row (no extra debt chip)', () => {
    // Triangulation: the chip row carries exactly sale.status + deliveryStatus.
    // Debt surfaces in its own row below the 2-col grid (per REQ-13).
    const wrapper = mountCard()
    const badges = wrapper.findAll('[data-tone]')
    expect(badges).toHaveLength(2)
  })

  it('renders the 2-col body labels (Total, Fecha, Cliente, Método)', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Total')
    expect(wrapper.text()).toContain('Fecha')
    expect(wrapper.text()).toContain('Cliente')
    expect(wrapper.text()).toContain('Método')
  })

  it('applies hover transition classes to the article (EmployeeCard visual parity)', () => {
    const wrapper = mountCard()
    const article = wrapper.get('article')
    expect(article.classes()).toEqual(
      expect.arrayContaining(['hover:border-primary/30', 'hover:shadow-md', 'cursor-pointer']),
    )
  })

  it('keeps sale-card-debt testid when debtCents > 0', () => {
    const wrapper = mountCard({ debtCents: 5000 })
    expect(wrapper.find('[data-testid="sale-card-debt"]').exists()).toBe(true)
  })

  it('keeps sale-card-due-date testid when both debt and dueDate exist', () => {
    const wrapper = mountCard({ debtCents: 5000, dueDate: '2026-06-01T10:00:00.000Z' })
    expect(wrapper.find('[data-testid="sale-card-debt"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sale-card-due-date"]').exists()).toBe(true)
  })

  it('hides the debt row when debtCents is 0', () => {
    const wrapper = mountCard({ debtCents: 0 })
    expect(wrapper.find('[data-testid="sale-card-debt"]').exists()).toBe(false)
  })

  it('shows the folio number on the card', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('#15')
  })

  it('shows the customer name', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('Acme SA')
  })

  it('shows Público en General when customer is null', () => {
    const wrapper = mountCard({ customer: null })
    expect(wrapper.text()).toContain('Público en General')
  })

  it('renders the formatted total amount', () => {
    const wrapper = mountCard({ totalCents: 120000 })
    expect(wrapper.text()).toContain('$1,200.00')
  })

  it('renders the formatted due date when dueDate is set', () => {
    const wrapper = mountCard({ dueDate: '2026-06-01T10:00:00.000Z' })
    expect(wrapper.text()).toContain('01/06/2026')
  })
})
