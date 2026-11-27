import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerMobileCard from '../CustomerMobileCard.vue'
import type { CustomerListingRow } from '../../interfaces/customer-listing.types'

const customer: CustomerListingRow = {
  id: 'cust-secret-id',
  firstName: 'Juan',
  lastName: 'Pérez',
  fullName: 'Juan Pérez',
  businessName: null,
  phoneCountryCode: '+52',
  phone: '5512345678',
  email: 'juan@test.com',
  globalPriceListId: 'pl-1',
  globalPriceListName: 'Lista General',
  rfc: null,
  fiscalRegime: null,
  isTrusted: false,
  createdAt: '2024-01-15T00:00:00.000Z',
  primaryAddress: null,
  activePetsCount: 0,
  petSpecies: [],
  matchedPetName: null,
}
const withMetrics = (metrics: Partial<NonNullable<CustomerListingRow['metrics']>> = {}): CustomerListingRow => ({
  ...customer,
  metrics: {
    openDebtCents: 128400,
    overdueDebtCents: 50000,
    overdueCount: 1,
    oldestOverdueDueDate: '2026-11-20',
    salesCount: 23,
    totalSoldCents: 1846050,
    averageTicketCents: 80263,
    lastPurchaseAt: '2026-11-22T18:00:00.000Z',
    ...metrics,
  },
})
const actions = [
  { key: 'edit', label: 'Editar' },
  { key: 'delete', label: 'Eliminar…', destructive: true },
]

function mountCard(props: Record<string, unknown> = {}) {
  return mount(CustomerMobileCard, { props: { customer, actions, openable: true, ...props } })
}

describe('CustomerMobileCard', () => {
  it('shows the name as the primary text, the phone as the secondary line and never the id', () => {
    const wrapper = mountCard()
    expect(wrapper.get('.hf-row-primary').text()).toBe('Juan Pérez')
    expect(wrapper.get('.hf-row-secondary').text()).toBe('+52 55 1234 5678')
    expect(wrapper.text()).not.toContain('cust-secret-id')
  })

  it('shows the price list in the footer and no money without metrics (no read:Sale)', () => {
    const wrapper = mountCard()
    expect(wrapper.get('.customer-card-footer').text()).toContain('Lista General')
    expect(wrapper.find('[data-testid="customer-card-debt"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="customer-card-last-purchase"]').exists()).toBe(false)
    const bare = mountCard({ customer: { ...customer, phone: null, globalPriceListName: null } })
    expect(bare.find('.hf-row-secondary').exists()).toBe(false)
  })

  it('shows the debt with the «Vencida» badge, since when, and the last purchase', () => {
    const wrapper = mountCard({ customer: withMetrics() })
    expect(wrapper.get('[data-testid="customer-card-debt"]').text()).toContain('$1,284.00')
    expect(wrapper.get('[data-testid="customer-card-overdue"]').text()).toContain('Vencida')
    expect(wrapper.get('[data-testid="customer-card-overdue-since"]').text()).toBe('Vencido desde 20/11/2026')
    expect(wrapper.get('[data-testid="customer-card-last-purchase"]').text()).toMatch(/^Última compra 22 nov 2026$/)
  })

  it('shows no debt line without debt, and «Sin compras» when the customer never bought', () => {
    const wrapper = mountCard({
      customer: withMetrics({ openDebtCents: 0, overdueDebtCents: 0, overdueCount: 0, oldestOverdueDueDate: null, lastPurchaseAt: null }),
    })
    expect(wrapper.find('[data-testid="customer-card-debt"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="customer-card-overdue"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="customer-card-last-purchase"]').text()).toBe('Sin compras')
  })

  it('shows debt without the badge when nothing is overdue', () => {
    const wrapper = mountCard({ customer: withMetrics({ overdueCount: 0, overdueDebtCents: 0, oldestOverdueDueDate: null }) })
    expect(wrapper.get('[data-testid="customer-card-debt"]').text()).toContain('$1,284.00')
    expect(wrapper.find('[data-testid="customer-card-overdue"]').exists()).toBe(false)
  })

  it('uses a neutral initials avatar, not a per-person color', () => {
    const wrapper = mountCard()
    expect(wrapper.getComponent({ name: 'EntityAvatar' }).text()).toBe('JP')
  })

  it('names the row in the ⋮ trigger and forwards the chosen action with the customer', async () => {
    const wrapper = mountCard()
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe('Acciones de Juan Pérez')
    wrapper.getComponent({ name: 'RowActionsMenu' }).vm.$emit('select', 'edit')
    expect(wrapper.emitted('action')![0]).toEqual(['edit', customer])
  })

  it('opens from the whole card or the name button, but not from the menu', async () => {
    const wrapper = mountCard()
    await wrapper.get('article').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('is read-only without openable: plain-text name and no click-through', async () => {
    const wrapper = mountCard({ openable: false })
    expect(wrapper.find('button.hf-row-primary').exists()).toBe(false)
    await wrapper.get('article').trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('renders no ⋮ when the role has no actions', () => {
    const wrapper = mountCard({ actions: [] })
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
  })

  // Handoff 27 §4: a customer found only through a pet says so.
  it('shows «<pet> (mascota de <cliente>)» when the search matched a pet, and nothing otherwise', () => {
    const matched = mountCard({ customer: { ...customer, matchedPetName: 'Bruno' } })
    expect(matched.get('[data-testid="customer-pet-match"]').text()).toBe('Bruno (mascota de Juan Pérez)')
    expect(matched.get('.hf-row-primary').text()).toBe('Juan Pérez')
    expect(mountCard().find('[data-testid="customer-pet-match"]').exists()).toBe(false)
  })
})
