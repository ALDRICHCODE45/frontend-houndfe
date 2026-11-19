/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashCustodyActions: explicit FLOAT/WITHDRAWAL, the recipient picked by name and
// role from GET /cash-handovers/recipients (S6, no raw UUID), same-person
// WITHDRAWAL block, and drawer release ordering.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashCustodyActions from '../CashCustodyActions.vue'

const UUID = '66666666-6666-4666-8666-666666666666'
const SELF = 'cashier-1'

const RECIPIENTS = {
  FLOAT: [
    { userId: SELF, displayName: 'Ana Cajera', roleName: 'Cajero' },
    { userId: UUID, displayName: 'Luis Supervisor', roleName: 'Supervisor' },
  ],
  WITHDRAWAL: [{ userId: UUID, displayName: 'Luis Supervisor', roleName: 'Supervisor' }],
}

function mountActions(props = {}) {
  return mountWithUApp(CashCustodyActions, {
    props: {
      sessionId: 's-1',
      canDeclareHandover: true,
      canReleaseDrawer: true,
      currentUserId: SELF,
      recipients: RECIPIENTS,
      ...props,
    },
  })
}

async function chooseRecipient(wrapper, userId = UUID) {
  await wrapper.get(`[data-testid="cash-handover-recipient-${userId}"]`).setValue()
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

  it('never offers a raw UUID input', () => {
    const wrapper = mountActions()
    expect(wrapper.find('[data-testid="cash-handover-recipient-uuid"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/UUID/i)
  })

  it('picks the recipient by name and role, as radio cards for the chosen kind', async () => {
    const wrapper = mountActions()
    const group = wrapper.get('[data-testid="cash-handover-recipients"]')
    expect(group.element.tagName).toBe('FIELDSET')
    expect(group.get('legend').text()).toMatch(/Persona que recibe/)
    const float = wrapper.get(`[data-testid="cash-handover-recipient-card-${UUID}"]`)
    expect(float.text()).toContain('Luis Supervisor')
    expect(float.text()).toContain('Supervisor')
    expect(wrapper.findAll('[data-testid^="cash-handover-recipient-card-"]')).toHaveLength(2)

    // WITHDRAWAL uses its own list (the backend already excludes the sender).
    await wrapper.get('[data-testid="cash-handover-kind-withdrawal"]').setValue()
    expect(wrapper.findAll('[data-testid^="cash-handover-recipient-card-"]')).toHaveLength(1)
    expect(wrapper.find(`[data-testid="cash-handover-recipient-card-${SELF}"]`).exists()).toBe(false)

    await chooseRecipient(wrapper)
    await wrapper.get('[data-testid="cash-handover-amount"]').setValue('100.00')
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(wrapper.emitted('declare')).toEqual([
      [{ handoverKind: 'WITHDRAWAL', recipientUserId: UUID, declaredCents: 10000 }],
    ])
  })

  it('asks for a recipient before declaring', async () => {
    const wrapper = mountActions()
    await wrapper.get('[data-testid="cash-handover-amount"]').setValue('100.00')
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(wrapper.emitted('declare')).toBeUndefined()
    expect(wrapper.get('[data-testid="cash-custody-actions-local-error"]').text()).toMatch(
      /Elige la persona que recibe/,
    )
  })

  it('drops the chosen recipient when the kind changes', async () => {
    const wrapper = mountActions()
    await chooseRecipient(wrapper, SELF)
    await wrapper.get('[data-testid="cash-handover-kind-withdrawal"]').setValue()
    await wrapper.get('[data-testid="cash-handover-kind-float"]').setValue()
    await wrapper.get('[data-testid="cash-handover-amount"]').setValue('100.00')
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(wrapper.emitted('declare')).toBeUndefined()
  })

  it('shows loading, empty and error states for the recipients of the kind', async () => {
    const loading = mountActions({ recipients: { FLOAT: [], WITHDRAWAL: [] }, recipientsLoading: { FLOAT: true } })
    expect(loading.find('[data-testid="cash-handover-recipients-loading"]').exists()).toBe(true)

    const empty = mountActions({ recipients: { FLOAT: [], WITHDRAWAL: [] } })
    expect(empty.get('[data-testid="cash-handover-recipients-empty"]').text()).toContain(
      'No hay quién pueda recibir en esta sucursal',
    )
    expect(empty.get('[data-testid="cash-handover-submit"]').attributes('disabled')).toBeDefined()

    const failed = mountActions({ recipients: { FLOAT: [], WITHDRAWAL: [] }, recipientsError: { WITHDRAWAL: true } })
    expect(failed.find('[data-testid="cash-handover-recipients-error"]').exists()).toBe(false)
    await failed.get('[data-testid="cash-handover-kind-withdrawal"]').setValue()
    const alert = failed.get('[data-testid="cash-handover-recipients-error"]')
    expect(alert.attributes('role')).toBe('alert')
    await alert.get('button').trigger('click')
    expect(failed.emitted('retry-recipients')).toEqual([['WITHDRAWAL']])
  })

  it('blocks a same-person WITHDRAWAL but allows a same-person FLOAT', async () => {
    // Defensive: even if a list ever carried the sender, a self withdrawal never leaves.
    const wrapper = mountActions({
      recipients: { FLOAT: RECIPIENTS.FLOAT, WITHDRAWAL: RECIPIENTS.FLOAT },
    })

    await wrapper.get('[data-testid="cash-handover-kind-withdrawal"]').setValue()
    await chooseRecipient(wrapper, SELF)
    await wrapper.get('[data-testid="cash-handover-amount"]').setValue('100.00')
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')

    expect(wrapper.emitted('declare')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-handover-self-withdrawal"]').exists()).toBe(true)

    // The same person may retain their own FLOAT: the receipt is still explicit.
    await wrapper.get('[data-testid="cash-handover-kind-float"]').setValue()
    await chooseRecipient(wrapper, SELF)
    await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(wrapper.emitted('declare')?.[0]?.[0]).toEqual({
      handoverKind: 'FLOAT',
      recipientUserId: SELF,
      declaredCents: 10000,
    })
  })

  it('states that a declared FLOAT needs an explicit receipt', () => {
    const wrapper = mountActions()
    expect(wrapper.get('[data-testid="cash-handover-float-copy"]').text()).toMatch(
      /recepción explícita/i,
    )
  })

  it('rejects a zero declared amount', async () => {
    const wrapper = mountActions()
    await chooseRecipient(wrapper)
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
      const wrapper = mountActions()
      await chooseRecipient(wrapper)
      await wrapper.get('[data-testid="cash-handover-amount"]').setValue(input)
      await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
      expect(wrapper.emitted('declare')?.[0]?.[0]?.declaredCents).toBe(cents)
    }
  })

  it('never declares more than the counted cash available, one cent over', async () => {
    const exact = mountActions({ countedCashCents: 35000 })
    expect(exact.text()).toMatch(/350[.,]00/)
    await chooseRecipient(exact)
    await exact.get('[data-testid="cash-handover-amount"]').setValue('350.00')
    await exact.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(exact.emitted('declare')?.[0]?.[0]?.declaredCents).toBe(35000)

    const over = mountActions({ countedCashCents: 35000 })
    await chooseRecipient(over)
    await over.get('[data-testid="cash-handover-amount"]').setValue('350.01')
    await over.get('[data-testid="cash-handover-form"]').trigger('submit')
    expect(over.emitted('declare')).toBeUndefined()
    expect(over.find('[data-testid="cash-custody-actions-local-error"]').exists()).toBe(true)
  })

  it('rejects missing, over-precision, exponent, negative and overflow declarations without emitting', async () => {
    for (const value of ['', '100.999', '1e2', '-1', '21474836.48']) {
      const wrapper = mountActions()
      await chooseRecipient(wrapper)
      await wrapper.get('[data-testid="cash-handover-amount"]').setValue(value)
      await wrapper.get('[data-testid="cash-handover-form"]').trigger('submit')
      expect(wrapper.emitted('declare')).toBeUndefined()
      expect(wrapper.find('[data-testid="cash-custody-actions-local-error"]').exists()).toBe(true)
    }
  })

  it('does not ask for centavos in the declaration entry', () => {
    const wrapper = mountActions()
    expect(wrapper.text()).not.toMatch(/centavos/i)
    expect(wrapper.get('[data-testid="cash-handover-amount"]').attributes('inputmode')).toBe(
      'decimal',
    )
  })
})

// Direction A: the handover and the release are separate timeline steps.
describe('CashCustodyActions · timeline sections', () => {
  it('renders only the handover in the «Entregar el efectivo» step', () => {
    const wrapper = mountActions({ section: 'handover', countedCashCents: 150000 })
    expect(wrapper.find('[data-testid="cash-handover-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-custody-actions-counted"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-drawer-release"]').exists()).toBe(false)
  })

  it('renders only the release in the «Liberar el cajón» step, still blocked by pending receipts', () => {
    const wrapper = mountActions({ section: 'release', pendingReceiveCount: 1 })
    expect(wrapper.find('[data-testid="cash-handover-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-handover-forbidden"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cash-drawer-release"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="cash-drawer-release-blocked"]').text()).toMatch(/sin recibir/)
  })

  it('keeps both parts by default', () => {
    const wrapper = mountActions()
    expect(wrapper.find('[data-testid="cash-handover-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-drawer-release"]').exists()).toBe(true)
  })
})
