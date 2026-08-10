import { describe, it, expect, vi, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import QuotationCard from '../QuotationCard.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

/**
 * QuotationCard — mobile card used by QuotationsListView's `#mobile-card`
 * slot. Contract (mirrors SaleCard):
 *   - renders truncated id, customer name, formatted total, expiry date
 *   - lazy EXPIRED status when SENT + past expiresAt (statusToTone/Label on
 *     the EFFECTIVE status)
 *   - "Eliminar" dropdown item only when canDelete && (DRAFT | CANCELLED)
 *   - emits `navigate` from "Ver detalle" and `delete` from "Eliminar"
 *   - main card area is a RouterLink to /pos/cotizaciones/:id
 */

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to" data-testid="quotation-card-link"><slot /></a>',
}

const StatusDotBadgeStub = {
  props: ['label', 'tone', 'compact'],
  template: '<span :data-tone="tone">{{ label }}</span>',
}

const UDropdownMenuStub = {
  name: 'UDropdownMenu',
  props: ['items'],
  template: `
    <div data-testid="dropdown-stub">
      <slot />
      <div v-for="(group, gi) in items" :key="gi">
        <button
          v-for="(item, ii) in group"
          :key="ii"
          :data-testid="item['data-testid'] || ('dropdown-item-' + gi + '-' + ii)"
          @click="item.onSelect && item.onSelect()"
        >{{ item.label }}</button>
      </div>
    </div>
  `,
}

const DropdownMenuStub = {
  name: 'DropdownMenu',
  props: ['items'],
  template: `
    <div data-testid="dropdown-stub">
      <slot />
      <div v-for="(group, gi) in items" :key="gi">
        <button
          v-for="(item, ii) in group"
          :key="ii"
          :data-testid="item['data-testid'] || ('dropdown-item-' + gi + '-' + ii)"
          @click="item.onSelect && item.onSelect()"
        >{{ item.label }}</button>
      </div>
    </div>
  `,
}

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'qtn-1',
    customerId: 'cust-1',
    customer: {
      id: 'cust-1',
      firstName: 'María',
      lastName: 'Pérez',
      email: 'maria@example.com',
    },
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
    ...overrides,
  }
}

function mountCard(quotation: QuotationResponseDto, canDelete = false) {
  return shallowMount(QuotationCard, {
    props: { quotation, canDelete },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        RouterLink: RouterLinkStub,
        StatusDotBadge: StatusDotBadgeStub,
        UDropdownMenu: UDropdownMenuStub,
        DropdownMenu: DropdownMenuStub,
        UButton: { template: '<button><slot /></button>' },
        Button: { template: '<button><slot /></button>' },
      },
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('QuotationCard', () => {
  it('renders the root testid', () => {
    const wrapper = mountCard(makeQuotation())
    expect(wrapper.find('[data-testid="quotation-card"]').exists()).toBe(true)
  })

  it('renders customer name and formatted total', () => {
    const wrapper = mountCard(makeQuotation({ totalCents: 120000 }))
    expect(wrapper.text()).toContain('María Pérez')
    expect(wrapper.text()).toContain('$1,200.00')
  })

  it('shows "Sin cliente" when customer is null', () => {
    const wrapper = mountCard(makeQuotation({ customer: null, customerId: null }))
    expect(wrapper.text()).toContain('Sin cliente')
  })

  it('truncates the id to 8 chars with an ellipsis when longer', () => {
    const wrapper = mountCard(makeQuotation({ id: 'qtn-abcdef-1234567890' }))
    expect(wrapper.text()).toContain('qtn-abcd…')
    expect(wrapper.text()).not.toContain('qtn-abcdef-1234567890')
  })

  it('keeps short ids as-is', () => {
    const wrapper = mountCard(makeQuotation({ id: 'qtn-1' }))
    expect(wrapper.text()).toContain('qtn-1')
  })

  it('renders the expiry date row and an em dash when expiresAt is null', () => {
    const wrapper = mountCard(makeQuotation({ expiresAt: null }))
    expect(wrapper.text()).toContain('Expira:')
    expect(wrapper.text()).toContain('—')
  })

  it('links the card to the quotation detail route', () => {
    const wrapper = mountCard(makeQuotation({ id: 'qtn-abc-123' }))
    const link = wrapper.get('[data-testid="quotation-card-link"]')
    expect(link.attributes('href')).toBe('/pos/cotizaciones/qtn-abc-123')
  })

  it('renders the DRAFT status label via StatusDotBadge', () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }))
    expect(wrapper.text()).toContain('Borrador')
    expect(wrapper.find('[data-tone="info"]').exists()).toBe(true)
  })

  it('renders effective EXPIRED status when SENT and expiresAt is in the past', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))
    const wrapper = mountCard(
      makeQuotation({ status: 'SENT', expiresAt: '2026-08-01T00:00:00.000Z' }),
    )
    expect(wrapper.text()).toContain('Expirada')
    expect(wrapper.find('[data-tone="warning"]').exists()).toBe(true)
  })

  it('keeps SENT status when expiresAt is still in the future', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    const wrapper = mountCard(
      makeQuotation({ status: 'SENT', expiresAt: '2026-09-30T12:00:00.000Z' }),
    )
    expect(wrapper.text()).toContain('Enviada')
    expect(wrapper.text()).not.toContain('Expirada')
  })

  it('renders the delete action when canDelete and status is DRAFT', () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), true)
    expect(wrapper.find('[data-testid="quotation-card-delete"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Eliminar')
  })

  it('does NOT render the delete action when status is SENT', () => {
    const wrapper = mountCard(makeQuotation({ status: 'SENT' }), true)
    expect(wrapper.find('[data-testid="quotation-card-delete"]').exists()).toBe(false)
  })

  it('does NOT render the delete action when canDelete is false', () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), false)
    expect(wrapper.find('[data-testid="quotation-card-delete"]').exists()).toBe(false)
  })

  it('renders the delete action when canDelete and status is CANCELLED', () => {
    const wrapper = mountCard(makeQuotation({ status: 'CANCELLED' }), true)
    expect(wrapper.find('[data-testid="quotation-card-delete"]').exists()).toBe(true)
  })

  it('emits navigate when "Ver detalle" is selected', async () => {
    const wrapper = mountCard(makeQuotation())
    const detailButton = wrapper
      .findAll('[data-testid="dropdown-stub"] button')
      .find((b) => b.text() === 'Ver detalle')!
    await detailButton.trigger('click')
    expect(wrapper.emitted('navigate')).toHaveLength(1)
  })

  it('emits delete when "Eliminar" is selected', async () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), true)
    await wrapper.get('[data-testid="quotation-card-delete"]').trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })
})
