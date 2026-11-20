/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention).
/**
 * CashClosingsList — «Cortes» inside Caja: paginated rows (folio, caja, cajero,
 * fecha, diferencia), register/cashier/date filters that reset the page, empty
 * and error states, and a row that opens the detail.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, toValue } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import { CLOSING, CLOSING_ITEM, cashError } from './closingFixtures'

let paramsSource
const list = {
  items: ref([]),
  total: ref(0),
  isLoading: ref(false),
  isError: ref(false),
  error: ref(null),
  refetch: vi.fn(),
}
vi.mock('../useCashClosing', () => ({
  useCashClosingsList: (params) => {
    paramsSource = params
    return list
  },
}))

// Any corte read from the list would go through these: the list must use none (§3.1).
const getClosing = vi.fn()
const listClosings = vi.fn()
vi.mock('../../api/cash.api', () => ({
  cashApi: { getClosing: (...a) => getClosing(...a), listClosings: (...a) => listClosings(...a) },
}))

import CashClosingsList from '../CashClosingsList.vue'

const ITEM = CLOSING_ITEM

/** Stand-ins for USelect / UInputDate so a spec can pick a value. */
const selectStub = {
  name: 'USelect',
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
    <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
  </select>`,
}
const inputDateStub = {
  name: 'UInputDate',
  props: ['modelValue', 'minValue', 'maxValue'],
  emits: ['update:modelValue'],
  template: `<input :value="modelValue ? modelValue.toString() : ''" @change="onChange($event.target.value)" />`,
  methods: {
    onChange(text) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
      this.$emit('update:modelValue', match ? { year: +match[1], month: +match[2], day: +match[3] } : null)
    },
  },
}

function mountList(props = {}) {
  return mountWithUApp(CashClosingsList, {
    global: {
      stubs: { USelect: selectStub, Select: selectStub, UInputDate: inputDateStub, InputDate: inputDateStub },
    },
    props: {
      registers: [{ id: 'r-1', name: 'Caja Mostrador 2' }],
      cashiers: [{ userId: 'c-1', displayName: 'Ana Cajera' }],
      pageSize: 10,
      ...props,
    },
  })
}

const params = () => toValue(paramsSource)

beforeEach(() => {
  list.items.value = [ITEM]
  list.total.value = 25
  list.isLoading.value = false
  list.isError.value = false
  list.error.value = null
  list.refetch.mockReset()
  getClosing.mockReset()
  listClosings.mockReset()
})

describe('CashClosingsList', () => {
  it('renders folio, caja, cajero, fecha and diferencia straight from the item (no corte reads)', async () => {
    const wrapper = mountList()
    await flushPromises()
    const text = wrapper.get('[data-testid="cash-closing-row"]').text()
    expect(text).toContain('CC-2f6d9c1e')
    expect(text).not.toContain(CLOSING.folio)
    expect(text).toContain('Caja Mostrador 2')
    expect(text).toContain('Ana Cajera')
    expect(text).toMatch(/5 nov/)
    expect(text).toMatch(/-\$5\.00 · faltante/)
    expect(wrapper.find('[aria-label="Cargando"]').exists()).toBe(false)
    expect(getClosing).not.toHaveBeenCalled()
  })

  it('uses the item names, not frozen snapshot names (current names, §3.1)', () => {
    list.items.value = [
      { ...ITEM, register: { id: 'r-9', name: 'Caja Renombrada' }, cashier: { userId: 'u-9', displayName: 'Ana B.' } },
    ]
    const text = mountList().get('[data-testid="cash-closing-row"]').text()
    expect(text).toContain('Caja Renombrada')
    expect(text).toContain('Ana B.')
  })

  it('shows «—» for a null difference, a missing register/cashier or a blank name', () => {
    list.items.value = [{ ...ITEM, register: null, cashier: { userId: 'u-1', displayName: '  ' }, differenceCents: null }]
    const cells = mountList()
      .get('[data-testid="cash-closing-row"]')
      .findAll('td')
      .map((cell) => cell.text())
    expect(cells[1]).toBe('—')
    expect(cells[2]).toBe('—')
    expect(cells[4]).toBe('—')
  })

  it('words the difference like the corte detail: sobrante and cuadra', () => {
    list.items.value = [
      { ...ITEM, id: 'a', differenceCents: 1250 },
      { ...ITEM, id: 'b', differenceCents: 0 },
    ]
    const rows = mountList().findAll('[data-testid="cash-closing-row"]')
    expect(rows[0].text()).toMatch(/\$12\.50 · sobrante/)
    expect(rows[1].text()).toMatch(/\$0\.00 · cuadra/)
  })

  it('has no per-row corte read path left (useCashClosingSummaries is gone)', async () => {
    const actual = await vi.importActual('../useCashClosing')
    expect(actual).not.toHaveProperty('useCashClosingSummaries')
  })

  it('starts on page 1 with the page size and no filters', () => {
    mountList()
    expect(params()).toEqual({ page: 1, limit: 10 })
  })

  it('pages forward and back', async () => {
    const wrapper = mountList()
    expect(wrapper.get('[data-testid="cash-closings-page"]').text()).toMatch(/Página 1 de 3/)
    expect(wrapper.get('[data-testid="cash-closings-prev"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="cash-closings-next"]').trigger('click')
    expect(params().page).toBe(2)
    await wrapper.get('[data-testid="cash-closings-prev"]').trigger('click')
    expect(params().page).toBe(1)
  })

  it('filters by register, cashier and dates, resetting to page 1', async () => {
    const wrapper = mountList()
    await wrapper.get('[data-testid="cash-closings-next"]').trigger('click')
    await wrapper.get('[data-testid="cash-closings-register"]').setValue('r-1')
    expect(params()).toEqual({ page: 1, limit: 10, registerId: 'r-1' })

    await wrapper.get('[data-testid="cash-closings-cashier"]').setValue('c-1')
    await wrapper.get('[data-testid="cash-closings-from"]').setValue('2026-11-01')
    await wrapper.get('[data-testid="cash-closings-to"]').setValue('2026-11-03')
    expect(params()).toEqual({
      page: 1,
      limit: 10,
      registerId: 'r-1',
      cashierUserId: 'c-1',
      from: new Date(2026, 10, 1).toISOString(),
      to: new Date(2026, 10, 4).toISOString(),
    })
  })

  it('«Todas» clears a filter (the sentinel never travels)', async () => {
    const wrapper = mountList()
    await wrapper.get('[data-testid="cash-closings-register"]').setValue('r-1')
    await wrapper.get('[data-testid="cash-closings-register"]').setValue('all')
    expect(params()).toEqual({ page: 1, limit: 10 })
  })

  it('hides the cashier filter when there is no cashier list', () => {
    expect(mountList({ cashiers: [] }).find('[data-testid="cash-closings-cashier"]').exists()).toBe(false)
  })

  it('opens the detail from the row (click and Enter)', async () => {
    const wrapper = mountList()
    await wrapper.get('[data-testid="cash-closing-row"]').trigger('click')
    await wrapper.get('[data-testid="cash-closing-row-open"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('open')).toEqual([[CLOSING.id], [CLOSING.id]])
  })

  it('shows the empty state, and a no-match state with filters', async () => {
    list.items.value = []
    list.total.value = 0
    let wrapper = mountList()
    expect(wrapper.text()).toMatch(/Todavía no hay cortes/)

    wrapper = mountList()
    await wrapper.get('[data-testid="cash-closings-register"]').setValue('r-1')
    expect(wrapper.text()).toMatch(/Ningún corte coincide/)
  })

  it('shows the error state with retry', async () => {
    list.isError.value = true
    list.error.value = cashError('LISTING_INVALID_ENUM_VALUE', {}, 400)
    const wrapper = mountList()
    expect(wrapper.text()).toMatch(/filtros no es válido/)
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(list.refetch).toHaveBeenCalled()
  })
})
