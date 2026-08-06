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

// T-UI-17/18/19 — REQ-UI-006 expiry shortcut chips. The picker renders
// four shortcut chips below the date input — "7 días", "15 días", "30 días",
// "Sin expiración". Selecting a chip computes `expiresAt = now + N days`
// and emits `update:expiresAt`. The chip whose value matches the current
// `expiresAt` is highlighted as active; "Sin expiración" matches when
// `expiresAt` is null. The chips are HIDDEN in readonly mode.
describe('QuotationExpiryPicker — shortcut chips (T-UI-17/18/19 / REQ-UI-006)', () => {
  it('renders the chip container with testid "expiry-chips"', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.find('[data-testid="expiry-chips"]').exists()).toBe(true)
  })

  it('renders the four shortcut chips (7 días, 15 días, 30 días, Sin expiración)', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.find('[data-testid="expiry-chip-7"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="expiry-chip-15"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="expiry-chip-30"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="expiry-chip-none"]').exists()).toBe(true)
  })

  it('hides the chips when readonly is true (SENT/EXPIRED/CANCELLED)', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: true })
    expect(wrapper.find('[data-testid="expiry-chips"]').exists()).toBe(false)
  })

  it('emits ISO timestamp at +7 days when the "7 días" chip is clicked', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    try {
      const wrapper = mountPicker({ expiresAt: null, readonly: false })
      await wrapper.get('[data-testid="expiry-chip-7"]').trigger('click')
      const emitted = wrapper.emitted('update:expiresAt')
      expect(emitted).toBeDefined()
      // Anchor at midnight UTC of the same day so the result matches
      // exactly (the chips normalize to T00:00:00.000Z like the picker).
      const value = emitted![0]![0] as string
      expect(new Date(value).toISOString()).toBe('2026-08-08T00:00:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits ISO timestamp at +15 days when the "15 días" chip is clicked', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    try {
      const wrapper = mountPicker({ expiresAt: null, readonly: false })
      await wrapper.get('[data-testid="expiry-chip-15"]').trigger('click')
      const value = wrapper.emitted('update:expiresAt')![0]![0] as string
      expect(new Date(value).toISOString()).toBe('2026-08-16T00:00:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits ISO timestamp at +30 days when the "30 días" chip is clicked', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    try {
      const wrapper = mountPicker({ expiresAt: null, readonly: false })
      await wrapper.get('[data-testid="expiry-chip-30"]').trigger('click')
      const value = wrapper.emitted('update:expiresAt')![0]![0] as string
      expect(new Date(value).toISOString()).toBe('2026-08-31T00:00:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits null when the "Sin expiración" chip is clicked', async () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T00:00:00.000Z',
      readonly: false,
    })
    await wrapper.get('[data-testid="expiry-chip-none"]').trigger('click')
    expect(wrapper.emitted('update:expiresAt')![0]![0]).toBeNull()
  })

  it('marks the active chip based on the current expiresAt value', () => {
    // expiresAt is +15 days from anchor → the 15 chip is active.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    try {
      const wrapper = mountPicker({
        expiresAt: '2026-08-16T00:00:00.000Z',
        readonly: false,
      })
      expect(wrapper.get('[data-testid="expiry-chip-15"]').attributes('data-active')).toBe('true')
      expect(wrapper.get('[data-testid="expiry-chip-7"]').attributes('data-active')).toBe('false')
      expect(wrapper.get('[data-testid="expiry-chip-30"]').attributes('data-active')).toBe('false')
      expect(wrapper.get('[data-testid="expiry-chip-none"]').attributes('data-active')).toBe('false')
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks the "Sin expiración" chip as active when expiresAt is null', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.get('[data-testid="expiry-chip-none"]').attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="expiry-chip-7"]').attributes('data-active')).toBe('false')
  })

  it('falls back to no active chip when expiresAt does not match any shortcut', () => {
    // Random date that doesn't fall on day 7, 15, or 30 from "now"
    const wrapper = mountPicker({
      expiresAt: '2026-12-25T00:00:00.000Z',
      readonly: false,
    })
    expect(wrapper.get('[data-testid="expiry-chip-7"]').attributes('data-active')).toBe('false')
    expect(wrapper.get('[data-testid="expiry-chip-15"]').attributes('data-active')).toBe('false')
    expect(wrapper.get('[data-testid="expiry-chip-30"]').attributes('data-active')).toBe('false')
    expect(wrapper.get('[data-testid="expiry-chip-none"]').attributes('data-active')).toBe('false')
  })
})
