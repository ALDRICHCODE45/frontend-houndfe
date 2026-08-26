import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentMethodCardGrid from '../PaymentMethodCardGrid.vue'
import type { PaymentMethodTableRow } from '../../interfaces/payment-method.types'

const badgeStub = {
  props: ['tone', 'label', 'compact', 'ariaLabel', 'ariaPrefix'],
  template: '<span data-testid="status-badge" :data-tone="tone" :data-label="label" :aria-label="ariaLabel"><slot /></span>',
}

const iconStub = {
  props: ['name'],
  template: '<span :data-icon="name" />',
}

const stubs = {
  UBadge: badgeStub,
  Badge: badgeStub,
  StatusDotBadge: badgeStub,
  UIcon: iconStub,
  Icon: iconStub,
}

function makeRow(overrides: Partial<PaymentMethodTableRow> = {}): PaymentMethodTableRow {
  return {
    id: 'pm-1',
    tenantId: 'tenant-1',
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

function mountGrid(props: Record<string, unknown>) {
  return mount(PaymentMethodCardGrid, {
    props,
    global: { stubs },
  })
}

describe('PaymentMethodCardGrid (sdd custom-payment-methods S3B, REQ-PM-001/011)', () => {
  it('renders the loading skeleton when loading=true (REQ-PM-011)', () => {
    const wrapper = mountGrid({ paymentMethods: [], loading: true })
    expect(wrapper.find('[data-testid="card-grid-skeleton"]').exists()).toBe(true)
    // 8 skeleton cards per REQ-PM-011.
    const skeletons = wrapper.findAll('[data-testid="card-skeleton"]')
    expect(skeletons.length).toBe(8)
  })

  it('renders the empty state when paymentMethods is empty AND not loading', () => {
    const wrapper = mountGrid({ paymentMethods: [], loading: false })
    expect(wrapper.find('[data-testid="card-grid-empty"]').exists()).toBe(true)
  })

  it('renders one card per paymentMethod row', () => {
    const rows = [
      makeRow({ id: 'a', name: 'Mercado Pago', isActive: true }),
      makeRow({ id: 'b', name: 'SPEI', isActive: false }),
      makeRow({ id: 'c', name: 'Visa Débito', isActive: true }),
    ]
    const wrapper = mountGrid({ paymentMethods: rows, loading: false })
    expect(wrapper.findAll('[data-testid="payment-method-card"]')).toHaveLength(3)
  })

  it('emits card-click with the row when a card is clicked', async () => {
    const rows = [makeRow({ id: 'a', name: 'Mercado Pago' })]
    const wrapper = mountGrid({ paymentMethods: rows, loading: false })

    await wrapper.find('[data-testid="payment-method-card"]').trigger('click')

    const emitted = wrapper.emitted('card-click')
    expect(emitted).toBeTruthy()
    expect((emitted![0]![0] as PaymentMethodTableRow).id).toBe('a')
  })

  it('renders the Activo/Inactivo badge with the correct tone per row', () => {
    const rows = [
      makeRow({ id: 'a', isActive: true }),
      makeRow({ id: 'b', isActive: false }),
    ]
    const wrapper = mountGrid({ paymentMethods: rows, loading: false })
    const badges = wrapper.findAll('[data-testid="status-badge"]')
    expect(badges.length).toBe(2)
    // Each row gets exactly one badge; tone varies by isActive.
    // We assert via the data-label attribute.
    const labels = badges.map((b) => b.attributes('data-label'))
    expect(labels).toContain('Activo')
    expect(labels).toContain('Inactivo')
  })

  it('renders the subtitle when present', () => {
    const rows = [makeRow({ id: 'a', subtitle: 'Link de pago' })]
    const wrapper = mountGrid({ paymentMethods: rows, loading: false })
    expect(wrapper.html()).toContain('Link de pago')
  })

  it('renders a placeholder when subtitle is null', () => {
    const rows = [makeRow({ id: 'a', subtitle: null })]
    const wrapper = mountGrid({ paymentMethods: rows, loading: false })
    // Some form of "no subtitle" placeholder (em-dash, "—", or empty).
    expect(wrapper.find('[data-testid="card-subtitle-a"]').exists()).toBe(true)
  })

  it('shows the category label in Spanish', () => {
    const rows = [makeRow({ id: 'a', category: 'transfer' })]
    const wrapper = mountGrid({ paymentMethods: rows, loading: false })
    expect(wrapper.html()).toContain('Transferencia')
  })
})