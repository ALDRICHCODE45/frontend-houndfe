import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationCustomerCard from '../QuotationCustomerCard.vue'
import type { QuotationCustomer } from '../../interfaces/quotation.types'

// EntityAvatar is a leaf component (it just renders initials + a color);
// we stub it so the test stays focused on QuotationCustomerCard's contract:
// - how it composes the avatar/name/email/phone layout
// - when it emits `change-customer`
// - how it gracefully handles missing phone/email/null customer
const EntityAvatarStub = {
  name: 'EntityAvatar',
  props: ['name', 'seed', 'size', 'showDot', 'dotClass'],
  template: '<span data-testid="customer-avatar-stub" :data-name="name" :data-seed="seed" :data-size="size" />',
}

function makeCustomer(overrides: Partial<QuotationCustomer> = {}): QuotationCustomer {
  return {
    id: 'cust-1',
    firstName: 'HomeLander',
    lastName: 'Perez',
    email: 'hole@gmail.com',
    phone: '+52 55 1834 2210',
    ...overrides,
  }
}

function mountCard(props: {
  customer: QuotationCustomer | null
  editable?: boolean
}) {
  return mount(QuotationCustomerCard, {
    props: { editable: true, ...props },
    global: {
      stubs: { EntityAvatar: EntityAvatarStub },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// T-UI-14 — REQ-UI-005 customer card. The new component MUST:
//   - accept `customer: QuotationCustomer | null` and `editable: boolean`
//   - emit `change-customer` when the outlined button is clicked
//   - render EntityAvatar with the customer name + id
//   - render name (bold), email (with icon), phone (with icon) when present
//   - gracefully handle null customer / missing phone / missing email
//   - only show the "Cambiar cliente" outlined button when editable=true
//   - carry the root testid `quotation-customer-card`

describe('QuotationCustomerCard — root contract', () => {
  it('renders the root container with testid "quotation-customer-card"', () => {
    const wrapper = mountCard({ customer: makeCustomer() })
    expect(wrapper.find('[data-testid="quotation-customer-card"]').exists()).toBe(true)
  })

  it('renders EntityAvatar with name and id (seed) when customer is set', () => {
    const wrapper = mountCard({ customer: makeCustomer({ id: 'cust-42', firstName: 'María', lastName: 'García' }) })
    const avatar = wrapper.find('[data-testid="customer-avatar-stub"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-name')).toBe('María García')
    expect(avatar.attributes('data-seed')).toBe('cust-42')
    expect(avatar.attributes('data-size')).toBe('lg')
  })

  it('renders the customer name in bold', () => {
    const wrapper = mountCard({ customer: makeCustomer({ firstName: 'HomeLander', lastName: 'Perez' }) })
    const name = wrapper.find('[data-testid="customer-name"]')
    expect(name.exists()).toBe(true)
    expect(name.text()).toBe('HomeLander Perez')
  })
})

describe('QuotationCustomerCard — contact rows', () => {
  it('renders the email row with the customer email', () => {
    const wrapper = mountCard({ customer: makeCustomer({ email: 'hole@gmail.com' }) })
    const email = wrapper.find('[data-testid="customer-email"]')
    expect(email.exists()).toBe(true)
    expect(email.text()).toContain('hole@gmail.com')
  })

  it('renders the phone row when phone is present', () => {
    const wrapper = mountCard({ customer: makeCustomer({ phone: '+52 55 1834 2210' }) })
    const phone = wrapper.find('[data-testid="customer-phone"]')
    expect(phone.exists()).toBe(true)
    expect(phone.text()).toContain('+52 55 1834 2210')
  })

  it('omits the phone row when phone is null (REQ-UI-005 customer without phone scenario)', () => {
    const wrapper = mountCard({ customer: makeCustomer({ phone: null }) })
    expect(wrapper.find('[data-testid="customer-phone"]').exists()).toBe(false)
  })

  it('omits the phone row when phone is the empty string', () => {
    const wrapper = mountCard({ customer: makeCustomer({ phone: '' }) })
    expect(wrapper.find('[data-testid="customer-phone"]').exists()).toBe(false)
  })

  it('omits the email row when email is null', () => {
    const wrapper = mountCard({ customer: makeCustomer({ email: null }) })
    expect(wrapper.find('[data-testid="customer-email"]').exists()).toBe(false)
  })
})

describe('QuotationCustomerCard — change-customer button', () => {
  it('shows the outlined "Cambiar cliente" button when editable=true', () => {
    const wrapper = mountCard({ customer: makeCustomer(), editable: true })
    const button = wrapper.find('[data-testid="change-customer-button"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('Cambiar cliente')
  })

  it('hides the button when editable=false (read-only view)', () => {
    const wrapper = mountCard({ customer: makeCustomer(), editable: false })
    expect(wrapper.find('[data-testid="change-customer-button"]').exists()).toBe(false)
  })

  it('emits "change-customer" when the button is clicked', async () => {
    const wrapper = mountCard({ customer: makeCustomer() })
    await wrapper.get('[data-testid="change-customer-button"]').trigger('click')
    expect(wrapper.emitted('change-customer')).toBeDefined()
    expect(wrapper.emitted('change-customer')).toHaveLength(1)
  })
})

describe('QuotationCustomerCard — null customer fallback', () => {
  it('renders gracefully when customer is null (no avatar, no contact rows)', () => {
    const wrapper = mountCard({ customer: null })
    expect(wrapper.find('[data-testid="quotation-customer-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="customer-avatar-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="customer-name"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="customer-email"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="customer-phone"]').exists()).toBe(false)
  })

  it('still shows the "Cambiar cliente" button when editable=true and customer is null', () => {
    const wrapper = mountCard({ customer: null, editable: true })
    expect(wrapper.find('[data-testid="change-customer-button"]').exists()).toBe(true)
  })
})
