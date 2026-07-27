import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ConfirmModal, { type ConfirmModalItem } from '../ConfirmModal.vue'

// Nuxt UI's UModal pulls in #imports (useAppConfig / useLocale) that aren't
// wired in jsdom tests. Stubbing it via global.stubs DOES NOT take effect
// because the component is auto-imported. We instead vi.mock the module so
// the real Modal.vue never runs and our template branch logic is exercised
// against a controlled stub that just renders the #body and #footer slots.

vi.mock('@nuxt/ui/runtime/components/Modal.vue', () => ({
  default: {
    name: 'UModal',
    props: ['open', 'title', 'dismissible', 'close'],
    emits: ['update:open'],
    template: `
      <div data-testid="u-modal" :data-open="String(open)">
        <slot name="body" />
        <slot name="footer" />
      </div>
    `,
  },
}))

vi.mock('@nuxt/ui/runtime/components/Button.vue', () => ({
  default: {
    name: 'UButton',
    props: ['label', 'color', 'variant', 'loading', 'disabled'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
}))

function mountModal(props: Record<string, unknown> = {}) {
  return mount(ConfirmModal, {
    props: { open: true, ...props },
  })
}

// ── BD-REQ-004: ConfirmModal with Item List ───────────────────────────────────
//
// The new `items` prop is purely ADDITIVE: the existing `description` branch
// stays untouched so the 26 existing callers stay green. When `items` is
// present (length > 0), the modal renders a scrollable ordered list of
// titles INSTEAD of the description paragraph.

describe('ConfirmModal (sdd-10 promotions-batch-delete — items prop)', () => {
  // (a) Description-only path is the legacy behavior and must NOT regress.
  it('renders the description as a <p> when no items prop is provided', async () => {
    const wrapper = mountModal({ description: '¿Quieres finalizar esta promo?' })
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-description"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-description"]').text()).toBe(
      '¿Quieres finalizar esta promo?',
    )
    expect(wrapper.find('[data-testid="confirm-items-list"]').exists()).toBe(false)
  })

  it('renders the description as a <p> when items prop is provided but empty', async () => {
    // An empty array is treated as "no items" — falls back to description.
    const wrapper = mountModal({
      description: 'Default description text',
      items: [],
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-description"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-items-list"]').exists()).toBe(false)
  })

  // (b) Items branch: ordered list with each title visible.
  it('renders an ordered <ul> with each item title when items prop is provided', async () => {
    const items: ConfirmModalItem[] = [
      { id: 'a', title: 'Promo A' },
      { id: 'b', title: 'Promo B' },
      { id: 'c', title: 'Promo C' },
    ]

    const wrapper = mountModal({
      description: 'Default description text',
      title: 'Eliminar promociones',
      items,
    })
    await flushPromises()

    const list = wrapper.find('[data-testid="confirm-items-list"]')
    expect(list.exists()).toBe(true)

    const titles = wrapper.findAll('[data-testid="confirm-item-title"]')
    expect(titles).toHaveLength(3)
    expect(titles.map((t) => t.text())).toEqual(['Promo A', 'Promo B', 'Promo C'])
  })

  // (c) When items present, the description paragraph MUST be suppressed —
  // showing both is visually noisy and contradicts the design.
  it('suppresses the description <p> when items prop is present and non-empty', async () => {
    const wrapper = mountModal({
      description: 'Should NOT appear',
      items: [
        { id: 'a', title: 'Promo A' },
        { id: 'b', title: 'Promo B' },
      ],
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="confirm-description"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="confirm-items-list"]').exists()).toBe(true)
    // Defense-in-depth: the suppressed description text does not appear anywhere.
    expect(wrapper.text()).not.toContain('Should NOT appear')
  })

  it('renders an optional status badge per item when status is provided', async () => {
    const wrapper = mountModal({
      description: 'Default description text',
      items: [
        { id: 'a', title: 'Promo Active', status: 'ACTIVE' },
        { id: 'b', title: 'Promo Ended', status: 'ENDED' },
      ],
    })
    await flushPromises()

    const badges = wrapper.findAll('[data-testid="confirm-item-status"]')
    expect(badges).toHaveLength(2)
    expect(badges.map((b) => b.text())).toEqual(['ACTIVE', 'ENDED'])
  })

  it('omits the status badge when item.status is absent', async () => {
    const wrapper = mountModal({
      description: 'Default description text',
      items: [{ id: 'a', title: 'Promo A' }],
    })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="confirm-item-status"]')).toHaveLength(0)
  })

  // ── Back-compat: description stays required, all existing behavior preserved
  it('still renders the confirm / cancel footer buttons when items are present', async () => {
    const wrapper = mountModal({
      description: 'Default description text',
      confirmLabel: 'Eliminar seleccionadas',
      cancelLabel: 'Cancelar',
      items: [{ id: 'a', title: 'Promo A' }],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Eliminar seleccionadas')
    expect(wrapper.text()).toContain('Cancelar')
  })
})