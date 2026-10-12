/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashRegistersPanel: loading/error/empty states, permission-gated actions and
// the create/activate contracts.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashRegistersPanel from '../CashRegistersPanel.vue'

const REGISTERS = [
  { id: 'r-1', name: 'Caja principal', isActive: true, createdAt: '2026-10-01T00:00:00.000Z' },
  { id: 'r-2', name: 'Caja secundaria', isActive: false, createdAt: '2026-10-02T00:00:00.000Z' },
]

describe('CashRegistersPanel', () => {
  it('renders the loading state', () => {
    const wrapper = mountWithUApp(CashRegistersPanel, { props: { registers: [], loading: true } })
    expect(wrapper.find('[data-testid="cash-registers-loading"]').exists()).toBe(true)
  })

  it('renders the error state with its message', () => {
    const wrapper = mountWithUApp(CashRegistersPanel, {
      props: { registers: [], error: true, errorMessage: 'Falla de red' },
    })
    expect(wrapper.get('[data-testid="cash-registers-error"]').text()).toContain('Falla de red')
  })

  it('renders the empty state when there are no registers', () => {
    const wrapper = mountWithUApp(CashRegistersPanel, { props: { registers: [] } })
    expect(wrapper.find('[data-testid="cash-registers-empty"]').exists()).toBe(true)
  })

  it('lists registers with their active state', () => {
    const wrapper = mountWithUApp(CashRegistersPanel, { props: { registers: REGISTERS } })
    expect(wrapper.find('[data-testid="cash-register-item-r-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-register-active-state"]').text()).toContain('Activa')
    expect(wrapper.find('[data-testid="cash-register-item-r-2"]').text()).toContain('Inactiva')
  })

  it('offers "Abrir caja" only with the open permission, and never for an inactive register', async () => {
    const forbidden = mountWithUApp(CashRegistersPanel, { props: { registers: REGISTERS } })
    expect(forbidden.find('[data-testid="cash-register-open-r-1"]').exists()).toBe(false)

    const allowed = mountWithUApp(CashRegistersPanel, {
      props: { registers: REGISTERS, canOpen: true },
    })
    const activeButton = allowed.get('[data-testid="cash-register-open-r-1"]')
    expect(activeButton.attributes('disabled')).toBeUndefined()
    expect(
      allowed.get('[data-testid="cash-register-open-r-2"]').attributes('disabled'),
    ).toBeDefined()

    await activeButton.trigger('click')
    expect(allowed.emitted('select')).toEqual([['r-1']])
  })

  it('emits the inverted isActive when toggling, only with the update permission', async () => {
    const readOnly = mountWithUApp(CashRegistersPanel, { props: { registers: REGISTERS } })
    expect(readOnly.find('[data-testid="cash-register-toggle-r-1"]').exists()).toBe(false)

    const wrapper = mountWithUApp(CashRegistersPanel, {
      props: { registers: REGISTERS, canUpdate: true },
    })
    await wrapper.get('[data-testid="cash-register-toggle-r-1"]').trigger('click')
    await wrapper.get('[data-testid="cash-register-toggle-r-2"]').trigger('click')

    expect(wrapper.emitted('update')).toEqual([
      ['r-1', { isActive: false }],
      ['r-2', { isActive: true }],
    ])
  })

  it('requires a non-empty name before creating', async () => {
    const wrapper = mountWithUApp(CashRegistersPanel, {
      props: { registers: [], canCreate: true },
    })
    await wrapper.get('[data-testid="cash-register-create-form"]').trigger('submit')
    expect(wrapper.emitted('create')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-register-form-error"]').exists()).toBe(true)

    await wrapper.get('[data-testid="cash-register-name-input"]').setValue('  Caja nueva  ')
    await wrapper.get('[data-testid="cash-register-create-form"]').trigger('submit')
    expect(wrapper.emitted('create')).toEqual([['Caja nueva']])
  })

  it('shows the access copy instead of the create form without create permission', () => {
    const wrapper = mountWithUApp(CashRegistersPanel, { props: { registers: REGISTERS } })
    expect(wrapper.find('[data-testid="cash-register-create-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-registers-create-forbidden"]').exists()).toBe(true)
  })
})
