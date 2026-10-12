/**
 * CashSaleSessionPicker — presentational binding control (T6 / S3).
 *
 * The eligibility, identity and paging RULES live in `useCashSaleSession` (see
 * its own spec); this component only renders the rows it is handed and emits the
 * user's explicit selection/page intent upward. Nothing is auto-selected.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CashSaleSessionPicker from '../CashSaleSessionPicker.vue'
import type { CashSession } from '@/features/POS/cash-register/interfaces/cash.types'

const OPEN_UUID = '11111111-1111-4111-8111-111111111111'
const OPEN_UUID_2 = '22222222-2222-4222-8222-222222222222'

function session(id: string): CashSession {
  return {
    id,
    tenantId: 'tenant-1',
    registerId: 'r-1',
    status: 'OPEN',
    cashierUserId: 'user-1',
    openingCents: 0,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: false,
  }
}

const selectStub = {
  props: ['modelValue', 'items', 'disabled', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<select data-testid="cash-session-select" :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="">Sin caja (legacy)</option><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
}

const buttonStub = {
  props: ['disabled'],
  emits: ['click'],
  template:
    '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

const formFieldStub = {
  props: ['label'],
  template: '<label><span>{{ label }}</span><slot /></label>',
}

const stubs = {
  UFormField: formFieldStub,
  FormField: formFieldStub,
  USelect: selectStub,
  Select: selectStub,
  UButton: buttonStub,
  Button: buttonStub,
}

function mountPicker(overrides: Record<string, unknown> = {}) {
  return mount(CashSaleSessionPicker, {
    props: {
      sessions: [session(OPEN_UUID)],
      selectedId: null,
      isSelectionEligible: false,
      isFetching: false,
      isError: false,
      page: 1,
      pageCount: 1,
      total: 1,
      ...overrides,
    },
    global: { stubs },
  })
}

describe('CashSaleSessionPicker', () => {
  it('renders one option per eligible session handed in', () => {
    const wrapper = mountPicker({ sessions: [session(OPEN_UUID), session(OPEN_UUID_2)] })

    const values = wrapper
      .get('[data-testid="cash-session-select"]')
      .findAll('option')
      .map((option) => option.attributes('value'))
    expect(values).toContain(OPEN_UUID)
    expect(values).toContain(OPEN_UUID_2)
  })

  it('never auto-selects: no value and no clear control when selectedId is null', () => {
    const wrapper = mountPicker()

    expect(
      (wrapper.get('[data-testid="cash-session-select"]').element as HTMLSelectElement).value,
    ).toBe('')
    expect(wrapper.find('[data-testid="cash-session-clear"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-stale"]').exists()).toBe(false)
  })

  it('emits the explicit selected UUID', async () => {
    const wrapper = mountPicker()
    await wrapper.get('[data-testid="cash-session-select"]').setValue(OPEN_UUID)

    const events = wrapper.emitted('update:selectedId') as string[][] | undefined
    expect(events?.[events.length - 1]?.[0]).toBe(OPEN_UUID)
  })

  it('clearing the selection emits null (restores the legacy unbound charge)', async () => {
    const wrapper = mountPicker({ selectedId: OPEN_UUID, isSelectionEligible: true })
    await wrapper.get('[data-testid="cash-session-clear"]').trigger('click')

    const events = wrapper.emitted('update:selectedId') as (string | null)[][] | undefined
    expect(events?.[events.length - 1]?.[0]).toBeNull()
  })

  it('warns when the explicit selection cannot be revalidated by the current rows', () => {
    const wrapper = mountPicker({ selectedId: OPEN_UUID, isSelectionEligible: false })

    expect(wrapper.get('[data-testid="cash-session-stale"]').text()).toContain(OPEN_UUID)
  })

  it('shows loading, error and empty states', () => {
    expect(
      mountPicker({ isFetching: true }).find('[data-testid="cash-session-loading"]').exists(),
    ).toBe(true)
    expect(mountPicker({ isError: true }).find('[data-testid="cash-session-error"]').exists()).toBe(
      true,
    )
    expect(mountPicker({ sessions: [] }).find('[data-testid="cash-session-empty"]').exists()).toBe(
      true,
    )
  })

  it('pages through the honest total and emits the requested page', async () => {
    const wrapper = mountPicker({ page: 1, pageCount: 2, total: 30 })

    expect(wrapper.get('[data-testid="cash-session-page"]').text()).toContain('30')
    expect(
      wrapper.get('[data-testid="cash-session-prev-page"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.get('[data-testid="cash-session-next-page"]').trigger('click')
    const events = wrapper.emitted('update:page') as number[][] | undefined
    expect(events?.[events.length - 1]?.[0]).toBe(2)
  })

  it('hides pagination when there is a single page', () => {
    const wrapper = mountPicker({ page: 1, pageCount: 1, total: 1 })

    expect(wrapper.find('[data-testid="cash-session-next-page"]').exists()).toBe(false)
  })
})
