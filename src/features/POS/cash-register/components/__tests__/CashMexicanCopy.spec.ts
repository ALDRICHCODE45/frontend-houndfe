/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashMexicanCopy — S2 localization guard for the copy-only unit: every visible
// operation-panel string a cashier can read is neutral Mexican Spanish (tuteo),
// never Argentine voseo. It locks the user-visible copy contract independently
// of the per-panel suites, so a regression in one panel still fails here.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashCountForm from '../CashCountForm.vue'
import CashCustodyActions from '../CashCustodyActions.vue'
import CashCustodyDiscovery from '../CashCustodyDiscovery.vue'
import CashDeclarationNotesForm from '../CashDeclarationNotesForm.vue'
import CashMovementsPanel from '../CashMovementsPanel.vue'
import CashOpenSessionForm from '../CashOpenSessionForm.vue'
import CashRegistersPanel from '../CashRegistersPanel.vue'
import CashSessionsPanel from '../CashSessionsPanel.vue'
import CashVerificationPanel from '../CashVerificationPanel.vue'
import {
  CASH_COMMAND_IN_PROGRESS,
  CASH_GENERIC_ERROR,
  CASH_IDENTITY_CHANGED,
  CASH_IDENTITY_INACTIVE,
  cashErrorInfo,
} from '../../composables/cashErrorCopy'
import { countEntryErrorsPesos, floatSourceDrawerAdvisory } from '../../composables/cashRules'

// Argentine voseo markers only (accented imperatives and "vos" verb forms).
// Neutral tuteo forms such as "ingresa"/"declara"/"revisa"/"puedes" must stay
// OUT of this list so the guard fails exclusively on voseo.
const VOSEO =
  /\b(tenés|podés|sos|querés|debés|vos|hacelo|mirá|revisá|confirmá|liberá|probá|esperá|iniciá|ingresá|declará|declarás|agregá|actualizá|seleccioná|elegí|escribí|creá|otorgá|pedile)\b/i

function expectNeutralMexicanSpanish(text: string): void {
  expect(text).not.toMatch(VOSEO)
}

describe('CashMexicanCopy · visible panel copy (S2)', () => {
  it('prompts the blind count in neutral Mexican Spanish tuteo', () => {
    const wrapper = mountWithUApp(CashCountForm, {
      props: { channels: [{ channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' }] },
    })
    expect(wrapper.text()).toMatch(/Ingresa los importes en pesos y declara cada canal congelado/i)
    expectNeutralMexicanSpanish(wrapper.text())
  })

  it('renders every operation panel without Argentine voseo', () => {
    const panels = [
      mountWithUApp(CashCountForm, { props: { channels: [] } }),
      mountWithUApp(CashCustodyActions, {}),
      mountWithUApp(CashCustodyDiscovery, { props: { allowed: false } }),
      mountWithUApp(CashDeclarationNotesForm, {}),
      mountWithUApp(CashMovementsPanel, {}),
      mountWithUApp(CashOpenSessionForm, {}),
      mountWithUApp(CashRegistersPanel, { props: { registers: [] } }),
      mountWithUApp(CashSessionsPanel, { props: { sessions: [] } }),
      mountWithUApp(CashVerificationPanel, { props: { canVerify: false } }),
    ]
    for (const wrapper of panels) {
      expectNeutralMexicanSpanish(wrapper.text())
    }
  })
})

describe('CashMexicanCopy · helper error and reason copy (S2)', () => {
  it('keeps the exported identity/command copy free of voseo', () => {
    expectNeutralMexicanSpanish(
      [
        CASH_GENERIC_ERROR,
        CASH_IDENTITY_INACTIVE,
        CASH_IDENTITY_CHANGED,
        CASH_COMMAND_IN_PROGRESS,
      ].join('\n'),
    )
    expect(CASH_IDENTITY_CHANGED).toMatch(/Revisa el estado/)
    expect(CASH_COMMAND_IN_PROGRESS).toMatch(/Espera a que termine/)
  })

  it('maps the CASH_* rule copy to tuteo without voseo', () => {
    const codeCopy = (code: string): string =>
      cashErrorInfo({ response: { data: { error: code, message: 'backend detail' } } }).message
    const mapped = [
      codeCopy('CASH_PERMISSION_DENIED'),
      codeCopy('CASH_SELF_VERIFICATION_FORBIDDEN'),
      codeCopy('CASH_HANDOVER_SELF_WITHDRAWAL'),
      codeCopy('CASH_OPENING_NOT_CONFIRMED'),
      codeCopy('CASH_DRAWER_NOT_RELEASED'),
    ]
    for (const message of mapped) expectNeutralMexicanSpanish(message)
    expect(codeCopy('CASH_PERMISSION_DENIED')).toMatch(/No tienes permiso/)
    expect(codeCopy('CASH_SELF_VERIFICATION_FORBIDDEN')).toBe(
      'No puedes verificar tu propia sesión: debe hacerlo otra persona.',
    )
    expect(codeCopy('CASH_HANDOVER_SELF_WITHDRAWAL')).toMatch(/para ti misma o ti mismo/)
  })

  it('keeps the count and FLOAT-drift helper copy in tuteo', () => {
    const blank = countEntryErrorsPesos(
      [{ channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' }],
      {},
    ).CASH
    expect(blank).toMatch(/^Ingresa el importe contado en pesos/)
    expectNeutralMexicanSpanish(blank)

    const advisory = floatSourceDrawerAdvisory(
      { sourceRegisterId: 'r-1', sourceDrawerReleasedAt: null },
      'r-2',
    )
    expect(advisory?.message).toMatch(/puedes usar el FLOAT en otra caja/)
    expectNeutralMexicanSpanish(advisory?.message ?? '')
  })
})
