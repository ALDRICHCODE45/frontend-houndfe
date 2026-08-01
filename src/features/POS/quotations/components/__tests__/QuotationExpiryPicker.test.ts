import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationExpiryPicker from '../QuotationExpiryPicker.vue'

// The picker renders a native <input type="date"> in DRAFT mode so the user
// can type or pick a date. We don't need to stub Nuxt UI here — the
// component is plain HTML + a UButton.
//
// In the read-only branch (status != DRAFT) the input must not render; the
// component is a pure display surface.

beforeEach(() => {
  // No mocks — presentational.
})

function mountPicker(props: { expiresAt: string | null; readonly: boolean }) {
  return mount(QuotationExpiryPicker, { props })
}

describe('QuotationExpiryPicker — display', () => {
  it('renders "Sin expiración" when expiresAt is null', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.text()).toMatch(/sin expiraci[oó]n/i)
  })

  it('renders the formatted current expiry date when expiresAt is set', () => {
    // The component slices to the YYYY-MM-DD portion to feed a native date
    // input; we use a noon-UTC ISO string so the slice survives TZ shifts.
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })
    // Spanish long-month format includes "septiembre" (or the abbreviated
    // "sept." depending on the platform) — match by year+day only.
    expect(wrapper.text()).toContain('2026')
    expect(wrapper.text()).toMatch(/15/)
  })

  it('renders the date input seeded with the ISO date (YYYY-MM-DD)', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })
    const input = wrapper.find('[data-testid="expiry-date-input"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('2026-09-15')
  })
})

describe('QuotationExpiryPicker — DRAFT (editable)', () => {
  it('renders the date input when readonly is false', () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    expect(wrapper.find('[data-testid="expiry-date-input"]').exists()).toBe(true)
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

  it('emits update:expiresAt with the new ISO timestamp when the date changes', async () => {
    const wrapper = mountPicker({ expiresAt: null, readonly: false })
    const input = wrapper.find('[data-testid="expiry-date-input"]')

    await input.setValue('2026-10-01')
    const emitted = wrapper.emitted('update:expiresAt')
    expect(emitted).toBeDefined()
    expect(emitted![0]![0]).toBe('2026-10-01T00:00:00.000Z')
  })

  it('emits update:expiresAt with null when the user clears the date input', async () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })
    const input = wrapper.find('[data-testid="expiry-date-input"]')

    await input.setValue('')
    const emitted = wrapper.emitted('update:expiresAt')
    expect(emitted).toBeDefined()
    expect(emitted![0]![0]).toBeNull()
  })

  it('emits update:expiresAt with null when the "Quitar expiración" button is clicked', async () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: false,
    })

    await wrapper.get('[data-testid="expiry-clear-button"]').trigger('click')
    const emitted = wrapper.emitted('update:expiresAt')
    expect(emitted).toBeDefined()
    expect(emitted![0]![0]).toBeNull()
  })
})

describe('QuotationExpiryPicker — readonly', () => {
  it('hides the date input when readonly is true', () => {
    const wrapper = mountPicker({
      expiresAt: '2026-09-15T12:00:00.000Z',
      readonly: true,
    })
    expect(wrapper.find('[data-testid="expiry-date-input"]').exists()).toBe(false)
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
