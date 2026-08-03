import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationExpiryPicker from '../QuotationExpiryPicker.vue'

// DateFieldPopover wraps UPopover + UCalendar — in jsdom there's no
// layout engine, so we stub it and test the contract:
//   - The modelValue prop is forwarded correctly (date-only slice).
//   - The update:modelValue event is mapped to update:expiresAt with
//     the full midnight-UTC ISO.
//   - Read-only mode hides the picker and clear button.
//   - The clear button emits null.

const DateFieldPopoverStub = {
  name: 'DateFieldPopover',
  props: {
    modelValue: { type: [String, Object], default: null },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    minIso: { type: [String, Object], default: null },
    testid: { type: String, default: 'date-field-popover' },
  },
  emits: ['update:modelValue'],
  template: `
    <button
      :data-testid="testid"
      @click="$emit('update:modelValue', '2026-12-25')"
    >{{ modelValue || placeholder }}</button>
  `,
}

beforeEach(() => {
  vi.clearAllMocks()
})

function mountPicker(props: { expiresAt: string | null; readonly: boolean }) {
  return mount(QuotationExpiryPicker, {
    props,
    global: {
      stubs: { DateFieldPopover: DateFieldPopoverStub },
    },
  })
}

describe('QuotationExpiryPicker — display', () => {
  it('renders "Sin expiración" when expiresAt is null', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.text()).toMatch(/sin expiraci[oó]n/i)
  })

  it('renders the formatted current expiry date when expiresAt is set', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })
    expect(wrapper.text()).toContain('2026')
    expect(wrapper.text()).toMatch(/15/)
  })

  it('forwards the date-only slice to DateFieldPopover', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })
    const popover = wrapper.findComponent(DateFieldPopoverStub)
    expect(popover.props('modelValue')).toBe('2026-09-15')
  })
})

describe('QuotationExpiryPicker — DRAFT (editable)', () => {
  it('renders the DateFieldPopover when readonly is false', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.find('[data-testid="expiry-date-field"]').exists()).toBe(true)
  })

  it('renders the "Quitar expiración" button when expiresAt is set', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })
    expect(wrapper.find('[data-testid="expiry-clear-button"]').exists()).toBe(true)
  })

  it('hides the "Quitar expiración" button when expiresAt is null', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.find('[data-testid="expiry-clear-button"]').exists()).toBe(false)
  })

  it('emits full ISO timestamp when DateFieldPopover updates', async () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    const popover = wrapper.find('[data-testid="expiry-date-field"]')
    await popover.trigger('click')

    const emitted = wrapper.emitted('update:expiresAt')
    expect(emitted).toBeDefined()
    expect(emitted![0]![0]).toBe('2026-12-25T00:00:00.000Z')
  })

  it('emits null when DateFieldPopover emits null', async () => {
    // Override the stub to emit null on click
    const wrapper = mount(QuotationExpiryPicker, {
      props: { expiresAt: '2026-09-15T12:00:00.000Z', readonly: false },
      global: {
        stubs: {
          DateFieldPopover: {
            ...DateFieldPopoverStub,
            template: `<button data-testid="expiry-date-field" @click="$emit('update:modelValue', null)">clear</button>`,
          },
        },
      },
    })
    const popover = wrapper.find('[data-testid="expiry-date-field"]')
    await popover.trigger('click')

    expect(wrapper.emitted('update:expiresAt')![0]![0]).toBeNull()
  })

  it('emits null when "Quitar expiración" is clicked', async () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })
    await wrapper.get('[data-testid="expiry-clear-button"]').trigger('click')
    expect(wrapper.emitted('update:expiresAt')![0]![0]).toBeNull()
  })
})

describe('QuotationExpiryPicker — readonly', () => {
  it('hides the DateFieldPopover when readonly is true', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: true,
    })
    expect(wrapper.find('[data-testid="expiry-date-field"]').exists()).toBe(false)
  })

  it('hides the "Quitar expiración" button when readonly is true', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: true,
    })
    expect(wrapper.find('[data-testid="expiry-clear-button"]').exists()).toBe(false)
  })

  it('still displays the formatted date when readonly and expiresAt is set', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: true,
    })
    expect(wrapper.text()).toContain('2026')
  })

  it('still displays "Sin expiración" when readonly and expiresAt is null', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: true })
    expect(wrapper.text()).toMatch(/sin expiraci[oó]n/i)
  })
})
