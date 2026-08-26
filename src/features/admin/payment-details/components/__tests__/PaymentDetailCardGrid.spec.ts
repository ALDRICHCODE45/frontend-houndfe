// @ts-nocheck — test-only mount with the shared UApp wrapper; assertions use
// data-testid and text content rather than deep type contracts.
import { describe, it, expect, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import PaymentDetailCardGrid from '../PaymentDetailCardGrid.vue'
import type { PaymentDetailTableRow } from '../../interfaces/payment-detail.types'

// Mock shared primitives so the grid renders under jsdom.
vi.mock('@/core/shared/components/StatusDotBadge.vue', () => ({
  default: {
    name: 'StatusDotBadge',
    props: ['label', 'tone', 'compact'],
    template: '<span :data-testid="`status-badge-${label}`" data-tone="tone">{{ label }}</span>',
  },
}))

function makeRow(overrides: Partial<PaymentDetailTableRow> = {}): PaymentDetailTableRow {
  return {
    id: 'pd-1',
    tenantId: 'tenant-1',
    bankName: 'BBVA',
    beneficiary: 'Acme SA',
    clabe: '012180001234567890',
    accountNumber: '1234567890',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('PaymentDetailCardGrid (sdd payment-details-admin S3, REQ-PD-001)', () => {
  it('renders 8 skeleton cards while loading (REQ-PD-001)', () => {
    const wrapper = mountWithUApp(PaymentDetailCardGrid, {
      props: { paymentDetails: [], loading: true },
    })
    expect(wrapper.find('[data-testid="card-grid-skeleton"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="card-skeleton"]')).toHaveLength(8)
  })

  it('does NOT render the skeleton block when not loading', () => {
    const wrapper = mountWithUApp(PaymentDetailCardGrid, {
      props: { paymentDetails: [], loading: false },
    })
    expect(wrapper.find('[data-testid="card-grid-skeleton"]').exists()).toBe(false)
  })

  it('renders the empty block when there are no accounts', () => {
    const wrapper = mountWithUApp(PaymentDetailCardGrid, {
      props: { paymentDetails: [], loading: false, empty: 'No hay cuentas bancarias' },
    })
    expect(wrapper.find('[data-testid="card-grid-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="card-grid-empty"]').text()).toContain(
      'No hay cuentas bancarias',
    )
  })

  it('renders a card per row with bankName, beneficiary, CLABE, and accountNumber', () => {
    const rows = [
      makeRow({
        id: 'pd-1',
        bankName: 'BBVA',
        beneficiary: 'Acme SA',
        clabe: '012180001234567890',
        accountNumber: '1234567890',
        isActive: true,
      }),
      makeRow({
        id: 'pd-2',
        bankName: 'Banorte',
        beneficiary: 'Banorte SA',
        clabe: '012180001234567891',
        accountNumber: '0987654321',
        isActive: false,
      }),
    ]

    const wrapper = mountWithUApp(PaymentDetailCardGrid, {
      props: { paymentDetails: rows, loading: false },
    })

    expect(wrapper.findAll('[data-testid="payment-detail-card"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('BBVA')
    expect(wrapper.text()).toContain('Acme SA')
    expect(wrapper.text()).toContain('012180001234567890')
    expect(wrapper.text()).toContain('1234567890')
    expect(wrapper.text()).toContain('Banorte')
  })

  it('renders an Activa badge for active rows and Inactiva for inactive rows', () => {
    const rows = [
      makeRow({ id: 'pd-1', isActive: true }),
      makeRow({ id: 'pd-2', isActive: false }),
    ]
    const wrapper = mountWithUApp(PaymentDetailCardGrid, {
      props: { paymentDetails: rows, loading: false },
    })
    expect(wrapper.find('[data-testid="status-badge-Activa"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="status-badge-Inactiva"]').exists()).toBe(true)
  })

  it('emits card-click with the exact row payload when a card is clicked', async () => {
    const row = makeRow({ id: 'pd-42', bankName: 'BBVA', beneficiary: 'Acme SA', isActive: true })
    const wrapper = mountWithUApp(PaymentDetailCardGrid, {
      props: { paymentDetails: [row], loading: false },
    })

    await wrapper.find('[data-testid="payment-detail-card"]').trigger('click')

    const events = wrapper.emitted('card-click')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]![0]).toEqual(row)
  })

  it('does NOT render any isActive / tenantId controls in cards (REQ-PD-003)', () => {
    const row = makeRow({ id: 'pd-1', isActive: true })
    const wrapper = mountWithUApp(PaymentDetailCardGrid, {
      props: { paymentDetails: [row], loading: false },
    })
    // The card has no toggle / no checkbox / no form control.
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
  })
})
