import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationCard from '../QuotationCard.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

/**
 * Dropdown helper — UDropdownMenu is auto-registered by @nuxt/ui at the Vite
 * level and can't be stubbed through vue-test-utils. Instead we mount the
 * card into `document.body`, click the real trigger button, and read the
 * rendered menu items out of the portal that Reka UI mounts to <body>.
 */
async function openDropdown(wrapper: ReturnType<typeof mount>): Promise<string[]> {
  const trigger = wrapper.get('[id^="reka-dropdown-menu-trigger"]')
  await trigger.trigger('click')
  await wrapper.vm.$nextTick()
  // Reka UI mounts the menu content asynchronously; a single tick isn't enough.
  await new Promise((r) => setTimeout(r, 50))
  const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
  return items.map((el) => (el.textContent ?? '').trim())
}

/**
 * QuotationCard — REQ-18 (EmployeeCard layout + click emit).
 *
 * Contract:
 *   - Renders an `<article data-testid="quotation-card">` styled like EmployeeCard
 *     (`border-default` / `bg-default`).
 *   - EntityAvatar (seed=quotation.id) shows the status dot when DRAFT/SENT.
 *   - Customer + truncated id + status chip + dashed divider + 2-col body
 *     (Total / Expira).
 *   - Emits `click` with the quotation; keeps `navigate` and `delete` events.
 *   - Dropdown gated on DRAFT/CANCELLED + canDelete. `@click.stop` on the
 *     dropdown wrapper so it does NOT propagate into card navigation.
 *   - The legacy `quotation-card-link` RouterLink wrapper is gone.
 */

const StatusDotBadgeStub = {
  props: ['label', 'tone', 'compact'],
  template: '<span :data-tone="tone">{{ label }}</span>',
}

const EntityAvatarStub = {
  props: ['name', 'seed', 'showDot', 'size'],
  template: '<div data-testid="entity-avatar" :data-seed="seed" :data-show-dot="String(showDot)" :data-size="size" />',
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

function mountCard(
  quotation: QuotationResponseDto,
  canDelete = false,
  extraOpts: Record<string, unknown> = {},
) {
  return mount(QuotationCard, {
    props: { quotation, canDelete },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        StatusDotBadge: StatusDotBadgeStub,
        EntityAvatar: EntityAvatarStub,
        UButton: { template: '<button @click.stop><slot /></button>' },
        Button: { template: '<button @click.stop><slot /></button>' },
      },
    },
    ...extraOpts,
  } as Parameters<typeof mount>[1])
}

afterEach(() => {
  vi.useRealTimers()
})

describe('QuotationCard — EmployeeCard pattern (REQ-18)', () => {
  it('renders the root testid on an article element', () => {
    const wrapper = mountCard(makeQuotation())
    const article = wrapper.find('article[data-testid="quotation-card"]')
    expect(article.exists()).toBe(true)
  })

  it('renders the article root with border-default and bg-default surface', () => {
    const wrapper = mountCard(makeQuotation())
    const article = wrapper.get('article[data-testid="quotation-card"]')
    expect(article.classes()).toEqual(
      expect.arrayContaining(['border-default', 'bg-default']),
    )
  })

  it('does NOT use bg-coco-neutral-* tokens on the article root', () => {
    const wrapper = mountCard(makeQuotation())
    const article = wrapper.get('article[data-testid="quotation-card"]')
    const classList = article.classes().join(' ')
    expect(classList).not.toContain('bg-coco-neutral')
  })

  it('does NOT render a RouterLink with the legacy quotation-card-link testid', () => {
    const wrapper = mountCard(makeQuotation())
    expect(wrapper.find('[data-testid="quotation-card-link"]').exists()).toBe(false)
  })

  it('emits click with the quotation when the card is clicked', async () => {
    const q = makeQuotation()
    const wrapper = mountCard(q)
    await wrapper.get('article[data-testid="quotation-card"]').trigger('click')
    const events = wrapper.emitted('click')
    expect(events).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([q])
  })

  it('renders EntityAvatar seeded with the quotation id and shows the dot when DRAFT', () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }))
    const avatar = wrapper.get('[data-testid="entity-avatar"]')
    expect(avatar.attributes('data-seed')).toBe('qtn-1')
    expect(avatar.attributes('data-show-dot')).toBe('true')
  })

  it('shows the avatar dot when status is SENT', () => {
    const wrapper = mountCard(makeQuotation({ status: 'SENT' }))
    const avatar = wrapper.get('[data-testid="entity-avatar"]')
    expect(avatar.attributes('data-show-dot')).toBe('true')
  })

  it('hides the avatar dot when status is EXPIRED', () => {
    const wrapper = mountCard(makeQuotation({ status: 'EXPIRED' }))
    const avatar = wrapper.get('[data-testid="entity-avatar"]')
    expect(avatar.attributes('data-show-dot')).toBe('false')
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

  it('renders an em dash when expiresAt is null', () => {
    const wrapper = mountCard(makeQuotation({ expiresAt: null }))
    expect(wrapper.text()).toContain('Expira')
    expect(wrapper.text()).toContain('—')
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

  it('does NOT emit click when the dropdown wrapper is interacted with (REQ-17 click.stop)', async () => {
    // The dropdown wrapper has @click.stop, so a click inside it should NOT
    // bubble to the article's click handler. This is the user-visible
    // behavior: opening the dropdown does not navigate to the detail page.
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), true)
    // Click the absolute-positioned div that wraps the dropdown trigger.
    const wrapperEl = wrapper.findAll('div').find((d) =>
      d.classes().includes('absolute') && d.classes().includes('right-3'),
    )
    expect(wrapperEl).toBeDefined()
    await wrapperEl!.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('renders the 2-col body labels (Total, Expira)', () => {
    const wrapper = mountCard(makeQuotation())
    expect(wrapper.text()).toContain('Total')
    expect(wrapper.text()).toContain('Expira')
  })

  it('always renders the actions wrapper (navigation "Ver detalle" is unconditional)', () => {
    // The actions wrapper hosts the dropdown trigger — it carries the
    // "Ver detalle" navigation item unconditionally, plus "Eliminar"
    // only when status is DRAFT/CANCELLED AND canDelete is true.
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), true)
    const actionsWrapper = wrapper.findAll('div').find((d) =>
      d.classes().includes('absolute') && d.classes().includes('right-3'),
    )
    expect(actionsWrapper).toBeDefined()
  })

  it('renders the actions wrapper even when canDelete is false (Ver detalle only)', () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), false)
    const actionsWrapper = wrapper.findAll('div').find((d) =>
      d.classes().includes('absolute') && d.classes().includes('right-3'),
    )
    expect(actionsWrapper).toBeDefined()
  })

  it('exposes "Ver detalle" and "Eliminar" when status is DRAFT and canDelete is true', async () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), true, {
      attachTo: document.body,
    })
    try {
      const items = await openDropdown(wrapper)
      expect(items).toContain('Ver detalle')
      expect(items).toContain('Eliminar')
    } finally {
      wrapper.unmount()
    }
  })

  it('hides "Eliminar" when status is SENT even with canDelete=true (REQ-13 status gate)', async () => {
    const wrapper = mountCard(makeQuotation({ status: 'SENT' }), true, {
      attachTo: document.body,
    })
    try {
      const items = await openDropdown(wrapper)
      expect(items).toContain('Ver detalle')
      expect(items).not.toContain('Eliminar')
    } finally {
      wrapper.unmount()
    }
  })

  it('hides "Eliminar" when canDelete is false on DRAFT (CASL gate)', async () => {
    const wrapper = mountCard(makeQuotation({ status: 'DRAFT' }), false, {
      attachTo: document.body,
    })
    try {
      const items = await openDropdown(wrapper)
      expect(items).toContain('Ver detalle')
      expect(items).not.toContain('Eliminar')
    } finally {
      wrapper.unmount()
    }
  })

  it('exposes "Eliminar" again on CANCELLED + canDelete (REQ-13 status gate)', async () => {
    const wrapper = mountCard(makeQuotation({ status: 'CANCELLED' }), true, {
      attachTo: document.body,
    })
    try {
      const items = await openDropdown(wrapper)
      expect(items).toContain('Eliminar')
    } finally {
      wrapper.unmount()
    }
  })

  it('emits delete when "Eliminar" is clicked through the real dropdown (REQ-13)', async () => {
    const q = makeQuotation({ status: 'DRAFT' })
    const wrapper = mountCard(q, true, {
      attachTo: document.body,
    })
    try {
      await openDropdown(wrapper)
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
      const eliminar = items.find((el) => el.textContent?.trim() === 'Eliminar')
      expect(eliminar).toBeDefined()
      ;(eliminar as HTMLElement).click()
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('delete')).toHaveLength(1)
      expect(wrapper.emitted('delete')![0]).toEqual([q])
    } finally {
      wrapper.unmount()
    }
  })

  it('emits navigate when "Ver detalle" is clicked through the real dropdown', async () => {
    const wrapper = mountCard(makeQuotation(), false, { attachTo: document.body })
    try {
      await openDropdown(wrapper)
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
      const verDetalle = items.find((el) => el.textContent?.trim() === 'Ver detalle')
      expect(verDetalle).toBeDefined()
      ;(verDetalle as HTMLElement).click()
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('navigate')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })
})
