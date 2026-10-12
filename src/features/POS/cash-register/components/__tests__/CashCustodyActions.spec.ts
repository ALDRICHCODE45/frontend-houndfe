/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashCustodyActions: explicit FLOAT/WITHDRAWAL, recipient selector vs validated
// UUID fallback, same-person WITHDRAWAL block, and drawer release ordering.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashCustodyActions from '../CashCustodyActions.vue'

const UUID = '66666666-6666-4666-8666-666666666666'

function mountActions(props = {}) {
  return mountWithUApp(CashCustodyActions, {
    props: {
      sessionId: 's-1',
      canDeclareHandover: true,
      canReleaseDrawer: true,
      currentUserId: 'cashier-1',
      ...props,
    },
  })
}

describe('CashCustodyActions · custody declaration', () => {
  it('asks for a session before declaring custody', () => {
    const wrapper = mountWithUApp(CashCustodyActions, {
      props: { canDeclareHandover: true, canReleaseDrawer: true },
    })
    expect(wrapper.find('[data-testid="cash-custody-actions-no-session"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-handover-form"]').exists()).toBe(false)
  })

  it('shows the access copy without create:CashHandover', () => {
    const wrapper = mountWithUApp(CashCustodyActions, {
      props: { sessionId: 's-1', canDeclareHandover: false, canReleaseDrawer: false },
    })
    expect(wrapper.find('[data-testid="cash-handover-forbidden"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-handover-form"]').exists()).toBe(false)
  })

  it('requires a validated recipient UUID when the user list is not entitled', async () => {
    const wrapper = mountActions({ selectorEntitled: false })

    await wrapper.get('[data-testid="cash-handover-recipient-uuid"]').setValue('not-a-uuid')
    await wrapper.get('[data-testid="cash-handover-amount"]').setValue('100.00')
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(wrapper.emitted('declare')).toBeUndefined()
    expect(wrapper.get('[data-testid="cash-custody-actions-local-error"]').text()).toMatch(/UUID/i)

    await wrapper.get('[data-testid="cash-handover-recipient-uuid"]').setValue(UUID)
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(wrapper.emitted('declare')).toEqual([
      [{ handoverKind: 'FLOAT', recipientUserId: UUID, declaredCents: 10000 }],
    ])
  })

  it('explains the explicit UUID fallback copy', () => {
    const wrapper = mountActions({ selectorEntitled: false })
    expect(wrapper.get('[data-testid="cash-handover-recipient-copy"]').text()).toMatch(
      /no tienes permiso para listar/i,
    )
  })

  it('uses the existing assignable-users selector when entitled', () => {
    const wrapper = mountActions({
      selectorEntitled: true,
      assignableUsers: [{ id: 'user-9', name: 'Ana' }],
    })
    expect(wrapper.find('[data-testid="cash-handover-recipient-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-handover-recipient-uuid"]').exists()).toBe(false)
  })

  it('blocks a same-person WITHDRAWAL but allows a same-person FLOAT', async () => {
    const SELF = '00000000-0000-4000-8000-0000000000c1'
    const wrapper = mountActions({ selectorEntitled: false, currentUserId: SELF })

    await wrapper.get('[data-testid="cash-handover-kind-withdrawal"]').setValue()
    await wrapper.get('[data-testid="cash-handover-recipient-uuid"]').setValue(SELF)
    await wrapper.get('[data-testid="cash-handover-amount"]').setValue('100.00')
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')

    expect(wrapper.emitted('declare')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-handover-self-withdrawal"]').exists()).toBe(true)

    // The same person may retain their own FLOAT: the receipt is still explicit.
    await wrapper.get('[data-testid="cash-handover-kind-float"]').setValue()
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(wrapper.emitted('declare')?.[0]?.[0]?.handoverKind).toBe('FLOAT')
  })

  it('states that a declared FLOAT needs an explicit receipt', () => {
    const wrapper = mountActions({ selectorEntitled: false })
    expect(wrapper.get('[data-testid="cash-handover-float-copy"]').text()).toMatch(
      /recepción explícita/i,
    )
  })

  it('rejects a zero declared amount', async () => {
    const wrapper = mountActions({ selectorEntitled: false })
    await wrapper.get('[data-testid="cash-handover-recipient-uuid"]').setValue(UUID)
    await wrapper.get('[data-testid="cash-handover-amount"]').setValue('0')
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')

    expect(wrapper.emitted('declare')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-custody-actions-local-error"]').exists()).toBe(true)
  })
})

describe('CashCustodyActions · drawer release', () => {
  it('blocks the release while any handover is still unreceived', async () => {
    const wrapper = mountActions({ pendingReceiveCount: 2 })
    expect(wrapper.get('[data-testid="cash-drawer-release-blocked"]').text()).toMatch(
      /sin recibir/i,
    )
    expect(wrapper.get('[data-testid="cash-drawer-release"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="cash-drawer-release"]').trigger('click')
    expect(wrapper.emitted('release')).toBeUndefined()
  })

  it('releases the drawer once nothing is pending', async () => {
    const wrapper = mountActions({ pendingReceiveCount: 0 })
    await wrapper.get('[data-testid="cash-drawer-release"]').trigger('click')
    expect(wrapper.emitted('release')).toEqual([[]])
  })

  it('does not offer a second release and never requires receipt permission', () => {
    const wrapper = mountActions({ drawerReleased: true, canReleaseDrawer: false })
    expect(wrapper.find('[data-testid="cash-drawer-released"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-drawer-release"]').attributes('disabled')).toBeDefined()
  })
})

describe('CashCustodyActions · declared money is entered in pesos', () => {
  it('converts declared pesos to exact integer cents in the emitted body', async () => {
    for (const [input, cents] of [
      ['350.25', 35025],
      ['0.01', 1],
    ]) {
      const wrapper = mountActions({ selectorEntitled: false })
      await wrapper.get('[data-testid="cash-handover-recipient-uuid"]').setValue(UUID)
      await wrapper.get('[data-testid="cash-handover-amount"]').setValue(input)
      await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
      expect(wrapper.emitted('declare')?.[0]?.[0]?.declaredCents).toBe(cents)
    }
  })

  it('never declares more than the counted cash available, one cent over', async () => {
    const exact = mountActions({ selectorEntitled: false, countedCashCents: 35000 })
    expect(exact.text()).toMatch(/350[.,]00/)
    await exact.get('[data-testid="cash-handover-recipient-uuid"]').setValue(UUID)
    await exact.get('[data-testid="cash-handover-amount"]').setValue('350.00')
    await exact.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(exact.emitted('declare')?.[0]?.[0]?.declaredCents).toBe(35000)

    const over = mountActions({ selectorEntitled: false, countedCashCents: 35000 })
    await over.get('[data-testid="cash-handover-recipient-uuid"]').setValue(UUID)
    await over.get('[data-testid="cash-handover-amount"]').setValue('350.01')
    await over.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(over.emitted('declare')).toBeUndefined()
    expect(over.find('[data-testid="cash-custody-actions-local-error"]').exists()).toBe(true)
  })

  it('rejects missing, over-precision, exponent, negative and overflow declarations without emitting', async () => {
    for (const value of ['', '100.999', '1e2', '-1', '21474836.48']) {
      const wrapper = mountActions({ selectorEntitled: false })
      await wrapper.get('[data-testid="cash-handover-recipient-uuid"]').setValue(UUID)
      await wrapper.get('[data-testid="cash-handover-amount"]').setValue(value)
      await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
      expect(wrapper.emitted('declare')).toBeUndefined()
      expect(wrapper.find('[data-testid="cash-custody-actions-local-error"]').exists()).toBe(true)
    }
  })

  it('does not ask for centavos in the declaration entry', () => {
    const wrapper = mountActions({ selectorEntitled: false })
    expect(wrapper.text()).not.toMatch(/centavos/i)
    expect(wrapper.get('[data-testid="cash-handover-amount"]').attributes('inputmode')).toBe(
      'decimal',
    )
  })
})
