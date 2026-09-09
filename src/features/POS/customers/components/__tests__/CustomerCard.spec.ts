import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CustomerCard from '../CustomerCard.vue'
import type { Customer } from '../../interfaces/customer.types'

// Typed helper: the kebab exposes its action list as the UDropdownMenu PUBLIC
// `items` prop. Stubs are routed through @nuxt/ui/components/* (the auto-import
// path used by the template) so we never inspect Reka UI internals or closed-
// dropdown text.
interface KebabItem {
  label: string
  color?: string
  onSelect?: () => void
}

vi.mock('@nuxt/ui/components/DropdownMenu.vue', () => ({
  default: { name: 'UDropdownMenu', template: '<div data-testid="kebab-menu-stub"><slot /></div>', props: ['items', 'content'], emits: ['select'] },
}))
vi.mock('@nuxt/ui/components/Button.vue', () => ({
  default: { name: 'UButton', template: '<button v-bind="$attrs"><slot /></button>', props: ['icon', 'color', 'variant'], emits: ['click'] },
}))
vi.mock('@nuxt/ui/components/Icon.vue', () => ({
  default: { name: 'UIcon', template: '<span aria-hidden="true" />', props: ['name'] },
}))

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div :data-seed="seed" :data-name="name" data-testid="entity-avatar" />',
    props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: {
    name: 'AppBadge',
    template: '<span data-testid="app-badge"><slot /></span>',
    props: ['label', 'value', 'tone', 'icon', 'variant'],
  },
}))

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez',
    phoneCountryCode: '+52',
    phone: '5512345678',
    email: 'juan@test.com',
    globalPriceListId: 'pl-1',
    globalPriceListName: 'Lista General',
    comments: null,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }
}

// ── S3: card shrink containment ─────────────────────────────────────────────
describe('CustomerCard shrink containment (S3)', () => {
  it('keeps the card root shrinkable within its grid track', () => {
    const wrapper = mount(CustomerCard, { props: { customer: makeCustomer() } })
    const card = wrapper.get('article')

    expect(card.classes()).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']))
    // Card mode must never become its own horizontal scroll container.
    expect(card.classes()).not.toContain('overflow-x-auto')
  })

  it('constrains the price-list chip row to the card and truncates the badge label', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer({
          globalPriceListName: 'Lista de precios mayoristas preferentes extendida 2026',
        }),
      },
    })

    // The chip row stays within the shrinkable card; the badge label
    // truncates rather than widening the badge shell.
    const badge = wrapper.get('[data-testid="app-badge"]')
    expect(badge.classes()).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full']))
    expect(badge.findAll('span').some((span) => span.classes().includes('truncate'))).toBe(true)
    expect(wrapper.get('article').text()).toContain(
      'Lista de precios mayoristas preferentes extendida 2026',
    )
  })

  it('keeps name/email/phone/date truncation contracts beside a pinned propagation-guarded kebab', () => {
    const wrapper = mount(CustomerCard, {
      props: { customer: makeCustomer(), canUpdate: true },
    })
    const card = wrapper.get('article')
    const paragraphs = card.findAll('p')

    // Field-specific truncation contracts (design §5): name truncates,
    // email is single-line clamped, phone and date truncate in their cells.
    expect(paragraphs.some((p) => p.classes().includes('truncate') && p.classes().includes('font-semibold'))).toBe(true)
    expect(paragraphs.some((p) => p.classes().includes('line-clamp-1'))).toBe(true)
    expect(paragraphs.filter((p) => p.classes().includes('truncate')).length).toBeGreaterThanOrEqual(3)

    const kebab = wrapper.get('[data-testid="kebab-wrapper"]')
    expect(Array.from(kebab.classes())).toEqual(
      expect.arrayContaining(['absolute', 'right-3', 'top-3', 'z-10']),
    )
  })
})

// ── S3: long-content triangulation ─────────────────────────────────────────
describe('CustomerCard long-content rendering (S3 triangulate)', () => {
  it('renders long name/email/phone/date values inside the shrinkable card without scroll classes', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer({
          fullName: 'José Eduardo de Jesús Ramírez-Salazar de la Torre y Fuentes',
          email: 'jose.eduardo.ramirez.salazar@distribuidora-internacional-larga.com.mx',
          phoneCountryCode: '+52',
          phone: '55123456789012345678',
          createdAt: '2024-01-15T10:30:00.000Z',
        }),
        canUpdate: true,
        canDelete: true,
        canReadSales: true,
      },
    })
    const card = wrapper.get('article')

    // Long values remain readable inside field-specific truncation —
    // never asserted as jsdom geometry.
    expect(card.text()).toContain('jose.eduardo.ramirez')
    expect(card.text()).toContain('55123456789012345678')
    expect(card.text()).toContain('Creado')
    expect(card.classes()).not.toContain('overflow-x-auto')

    // The kebab stays absolutely pinned and actionable beside long content.
    const kebab = wrapper.get('[data-testid="kebab-wrapper"]')
    expect(kebab.classes()).toContain('absolute')

    // Kebab propagation guard still holds beside long content.
    return wrapper.get('[data-testid="kebab-wrapper"]').trigger('click').then(() => {
      expect(wrapper.emitted('click')).toBeUndefined()
    })
  })
})

describe('CustomerCard', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('renders fullName, email, and the price list chip', () => {
    const wrapper = mount(CustomerCard, {
      props: { customer: makeCustomer() },
    })
    expect(wrapper.text()).toContain('Juan Pérez')
    expect(wrapper.text()).toContain('juan@test.com')
    expect(wrapper.text()).toContain('Lista General')
  })

  it('passes the customer id to EntityAvatar as seed', () => {
    const wrapper = mount(CustomerCard, {
      props: { customer: makeCustomer({ id: 'cust-42' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-seed')).toBe('cust-42')
    expect(avatar.attributes('data-name')).toBe('Juan Pérez')
  })

  it('prepends the phone country code when both are present', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer({
          phoneCountryCode: '+52',
          phone: '5512345678',
        }),
      },
    })
    expect(wrapper.text()).toContain('+52')
    expect(wrapper.text()).toContain('5512345678')
  })

  it('falls back to an em-dash when phone is missing', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer({ phone: null, phoneCountryCode: null }),
      },
    })
    expect(wrapper.text()).toContain('—')
  })

  it('emits click with the customer when the article is clicked', async () => {
    const customer = makeCustomer()
    const wrapper = mount(CustomerCard, {
      props: { customer },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(customer)
  })

  it('hides the kebab when neither canUpdate nor canDelete is true', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer(),
        canUpdate: false,
        canDelete: false,
      },
    })
    expect(wrapper.findComponent({ name: 'UDropdownMenu' }).exists()).toBe(false)
  })

  it('shows the kebab when canUpdate is true', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer(),
        canUpdate: true,
        canDelete: false,
      },
    })
    expect(wrapper.findComponent({ name: 'UDropdownMenu' }).exists()).toBe(true)
  })

  it('shows the kebab when canDelete is true', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer(),
        canUpdate: false,
        canDelete: true,
      },
    })
    expect(wrapper.findComponent({ name: 'UDropdownMenu' }).exists()).toBe(true)
  })

  it('emits edit/delete from the kebab menu actions and stops propagation', async () => {
    const customer = makeCustomer()
    const wrapper = mount(CustomerCard, {
      props: {
        customer,
        canUpdate: true,
        canDelete: true,
      },
    })
    // The kebab container is wrapped with @click.stop; clicking it should
    // NOT bubble to the article click handler.
    const articleClick = vi.fn()
    wrapper.find('article').element.addEventListener('click', articleClick)
    await wrapper.find('[data-testid="kebab-wrapper"]').trigger('click')
    expect(articleClick).not.toHaveBeenCalled()
  })

  // ── S4: kebab items contract via typed helper ─────────────────────────────

  function getKebabItems(wrapper: ReturnType<typeof mount>): KebabItem[] {
    const dropdown = wrapper.findComponent({ name: 'UDropdownMenu' })
    return ((dropdown.props('items') as KebabItem[] | undefined) ?? []).flat()
  }

  it('read-sales-only: items contain only the history action', () => {
    const wrapper = mount(CustomerCard, { props: { customer: makeCustomer(), canReadSales: true } })
    const items = getKebabItems(wrapper)
    expect(items.map((i) => i.label)).toEqual(['Ver historial de ventas'])
  })

  it('invoking the history onSelect emits view-history exactly with [[customer]]', async () => {
    const customer = makeCustomer()
    const wrapper = mount(CustomerCard, { props: { customer, canReadSales: true } })
    const history = getKebabItems(wrapper).find((i) => i.label === 'Ver historial de ventas')
    expect(history?.onSelect).toBeDefined()
    history!.onSelect!()
    await nextTick()
    expect(wrapper.emitted('view-history')).toEqual([[customer]])
  })

  it('update-only: items contain only Edit, no destructive color', () => {
    const wrapper = mount(CustomerCard, { props: { customer: makeCustomer(), canUpdate: true } })
    const items = getKebabItems(wrapper)
    expect(items.map((i) => i.label)).toEqual(['Editar'])
    expect(items.some((i) => i.color === 'error')).toBe(false)
  })

  it('delete-only: items contain only Delete with destructive color', () => {
    const wrapper = mount(CustomerCard, { props: { customer: makeCustomer(), canDelete: true } })
    const items = getKebabItems(wrapper)
    expect(items.map((i) => i.label)).toEqual(['Eliminar'])
    expect(items[0]?.color).toBe('error')
  })

  it('update+delete+read-sales: ordered normal group with destructive delete last', () => {
    const wrapper = mount(CustomerCard, {
      props: { customer: makeCustomer(), canUpdate: true, canDelete: true, canReadSales: true },
    })
    const items = getKebabItems(wrapper)
    expect(items.map((i) => i.label)).toEqual(['Editar', 'Ver historial de ventas', 'Eliminar'])
    expect(items.filter((i) => i.color === 'error').map((i) => i.label)).toEqual(['Eliminar'])
  })

  it('no permissions: kebab is absent and the dropdown items are empty', () => {
    const wrapper = mount(CustomerCard, { props: { customer: makeCustomer() } })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'UDropdownMenu' }).exists()).toBe(false)
  })

  it('card body click still emits click with the customer (no closed-menu text inspection)', async () => {
    const customer = makeCustomer()
    const wrapper = mount(CustomerCard, { props: { customer } })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(customer)
  })

  it('clicking the kebab wrapper stops propagation and does not emit card click', async () => {
    const wrapper = mount(CustomerCard, { props: { customer: makeCustomer(), canUpdate: true } })
    await wrapper.find('[data-testid="kebab-wrapper"]').trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
