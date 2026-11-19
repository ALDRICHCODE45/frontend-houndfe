/**
 * Close requirement checklist derived from GET /cash-sessions/:id, in the order
 * the backend checks them (handoff 25 §5 rows 11–17). The backend still decides;
 * the checklist only explains a disabled «Cerrar caja» and who must act.
 */
import { describe, expect, it } from 'vitest'
import {
  closeReadiness,
  closeRequirements,
  sessionDifference,
  type CloseRequirement,
  type CloseRequirementId,
} from '../closeRequirements'
import { CASHIER, ME, makeReadyDetail, makeSession } from './closingFixtures'
import type { CashSessionDetail } from '../../interfaces/cash.types'

function byId(detail: CashSessionDetail, me = ME): Record<CloseRequirementId, CloseRequirement> {
  return Object.fromEntries(closeRequirements(detail, me).map((r) => [r.id, r])) as Record<
    CloseRequirementId,
    CloseRequirement
  >
}

describe('closeRequirements', () => {
  it('lists every requirement in §5 order and all met for a ready session', () => {
    const list = closeRequirements(makeReadyDetail(), ME)
    expect(list.map((r) => r.id)).toEqual([
      'submitted',
      'otherPerson',
      'drawerReleased',
      'verified',
      'discrepancyNotes',
      'handoversReceived',
      'handoversAllocated',
    ])
    expect(list.every((r) => r.state === 'met')).toBe(true)
  })

  it('submitted: pending while OPEN/COUNTING, says the cashier must declare', () => {
    const detail = makeReadyDetail({ session: makeSession({ status: 'COUNTING' }), counts: [] })
    const req = byId(detail).submitted
    expect(req.state).toBe('pending')
    expect(req.detail).toMatch(/Ana Cajera debe contar y enviar su declaración/)
  })

  it('otherPerson: pending when I am the cashier', () => {
    const req = byId(makeReadyDetail(), CASHIER).otherPerson
    expect(req.state).toBe('pending')
    expect(req.detail).toMatch(/otra persona con permiso de cierre/)
  })

  it('drawerReleased: pending names who releases it', () => {
    const detail = makeReadyDetail({ session: makeSession({ drawerReleasedAt: null }) })
    const req = byId(detail).drawerReleased
    expect(req.state).toBe('pending')
    expect(req.detail).toBe('Falta liberar el cajón: Ana Cajera debe liberarlo antes del cierre.')
  })

  it('drawerReleased falls back to a neutral person when the name is unknown', () => {
    const detail = makeReadyDetail({
      session: makeSession({ drawerReleasedAt: null, cashierDisplayName: null }),
    })
    expect(byId(detail).drawerReleased.detail).toMatch(/la persona que abrió la caja debe liberarlo/)
  })

  it('verified: pending without a VERIFICATION count', () => {
    const base = makeReadyDetail()
    const detail = { ...base, counts: base.counts.filter((c) => c.kind === 'DECLARATION') }
    const req = byId(detail).verified
    expect(req.state).toBe('pending')
    expect(req.detail).toMatch(/otra persona.*debe recontar/)
  })

  it('discrepancyNotes: met when there is no difference', () => {
    expect(byId(makeReadyDetail()).discrepancyNotes.state).toBe('met')
    expect(byId(makeReadyDetail()).discrepancyNotes.detail).toBe('Sin diferencia')
  })

  it('discrepancyNotes: pending when declared ≠ expected and the latest declaration has no notes', () => {
    const base = makeReadyDetail()
    const counts = base.counts.map((c) =>
      c.kind === 'DECLARATION'
        ? { ...c, lines: [{ channelKey: 'CASH', amountCents: 149500 }, c.lines[1]!] }
        : { ...c, lines: [{ channelKey: 'CASH', amountCents: 149500 }, c.lines[1]!] },
    )
    const detail = { ...base, counts, session: makeSession({ differenceCents: -500 }) }
    const req = byId(detail).discrepancyNotes
    expect(req.state).toBe('pending')
    expect(req.detail).toMatch(/Ana Cajera debe agregar una nota/)
  })

  it('discrepancyNotes: met once a later declaration revision carries notes', () => {
    const base = makeReadyDetail()
    const declaration = base.counts[0]!
    const lines = [{ channelKey: 'CASH', amountCents: 149500 }, declaration.lines[1]!]
    const detail = {
      ...base,
      session: makeSession({ differenceCents: -500 }),
      counts: [
        { ...declaration, lines },
        { ...declaration, id: 'count-d2', revision: 2, lines, notes: 'Faltan 5 pesos de cambio' },
        { ...base.counts[1]!, lines },
      ],
    }
    expect(byId(detail).discrepancyNotes.state).toBe('met')
  })

  it('discrepancyNotes: a non-cash channel difference also counts', () => {
    const base = makeReadyDetail()
    const counts = base.counts.map((c) => ({
      ...c,
      lines: [c.lines[0]!, { channelKey: 'METHOD:CARD_DEBIT', amountCents: 31000 }],
    }))
    expect(byId({ ...base, counts }).discrepancyNotes.state).toBe('pending')
  })

  it('discrepancyNotes: verified ≠ declared without verification notes', () => {
    const base = makeReadyDetail()
    const counts = base.counts.map((c) =>
      c.kind === 'VERIFICATION'
        ? { ...c, lines: [{ channelKey: 'CASH', amountCents: 149000 }, c.lines[1]!] }
        : c,
    )
    const req = byId({ ...base, counts }).discrepancyNotes
    expect(req.state).toBe('pending')
    expect(req.detail).toMatch(/quien verificó/)
  })

  it('discrepancyNotes: unknown while the expected snapshot is not visible', () => {
    const detail = makeReadyDetail({
      channelSnapshot: null,
      session: makeSession({ differenceCents: undefined, expectedCashCents: undefined }),
    })
    expect(byId(detail).discrepancyNotes.state).toBe('unknown')
  })

  it('handoversReceived: pending with the count of missing receipts', () => {
    const base = makeReadyDetail()
    const handovers = base.handovers.map((h, i) =>
      i === 0 ? { ...h, receivedAt: null, receivedCents: null, receiptActorUserId: null } : h,
    )
    const req = byId({ ...base, handovers }).handoversReceived
    expect(req.state).toBe('pending')
    expect(req.detail).toMatch(/1 de 2 recibidas/)
    expect(req.detail).toMatch(/«Por recibir»/)
  })

  it('handoversAllocated: pending when handovers do not add up to the declared cash', () => {
    const base = makeReadyDetail()
    const req = byId({ ...base, handovers: base.handovers.slice(1) }).handoversAllocated
    expect(req.state).toBe('pending')
    expect(req.detail).toMatch(/Faltan \$500\.00 por asignar: Ana Cajera debe declarar las entregas/)
  })

  it('handoversAllocated: pending when handovers exceed the declared cash', () => {
    const base = makeReadyDetail()
    const handovers = [...base.handovers, { ...base.handovers[0]!, id: 'h-3', declaredCents: 100 }]
    expect(byId({ ...base, handovers }).handoversAllocated.detail).toMatch(/Sobran \$1\.00/)
  })
})

describe('sessionDifference', () => {
  it('separates declaration and verification differences (never merged)', () => {
    const base = makeReadyDetail()
    const counts = base.counts.map((c) =>
      c.kind === 'DECLARATION'
        ? { ...c, lines: [{ channelKey: 'CASH', amountCents: 149500 }, c.lines[1]!] }
        : { ...c, lines: [{ channelKey: 'CASH', amountCents: 149700 }, c.lines[1]!] },
    )
    expect(sessionDifference({ ...base, counts })).toEqual({
      declarationCents: -500,
      verificationCents: 200,
      hasDifference: true,
    })
  })

  it('is null when nothing can be compared', () => {
    expect(
      sessionDifference(
        makeReadyDetail({ channelSnapshot: null, counts: [], session: makeSession({ differenceCents: undefined }) }),
      ).hasDifference,
    ).toBeNull()
  })
})

describe('closeReadiness', () => {
  it('is ready when everything is met and I am not the cashier', () => {
    const r = closeReadiness(makeReadyDetail(), ME)
    expect(r.mode).toBe('ready')
    expect(r.blockingReason).toBeNull()
    expect(r.notesRequired).toBe(false)
  })

  it('the cashier gets the cashier mode (no close action)', () => {
    expect(closeReadiness(makeReadyDetail(), CASHIER).mode).toBe('cashier')
  })

  it('blocked mode explains the first pending requirement in §5 order', () => {
    const detail = makeReadyDetail({ session: makeSession({ drawerReleasedAt: null }) })
    const base = detail.counts.filter((c) => c.kind === 'DECLARATION')
    const r = closeReadiness({ ...detail, counts: base }, ME)
    expect(r.mode).toBe('blocked')
    expect(r.blockingReason).toMatch(/^Falta liberar el cajón/)
  })

  it('closed mode once the session is CLOSED or a closing exists', () => {
    expect(closeReadiness(makeReadyDetail({ session: makeSession({ status: 'CLOSED' }) }), ME).mode).toBe(
      'closed',
    )
    expect(
      closeReadiness(
        makeReadyDetail({ closing: { id: 'c', sessionId: 's', folio: 'CC-1', createdAt: '2026-11-05T22:45:30.000Z' } }),
        ME,
      ).mode,
    ).toBe('closed')
  })

  it('requires the closing note when the session has a difference', () => {
    const base = makeReadyDetail()
    const declaration = base.counts[0]!
    const lines = [{ channelKey: 'CASH', amountCents: 148000 }, declaration.lines[1]!]
    const detail = {
      ...base,
      handovers: [base.handovers[0]!, { ...base.handovers[1]!, declaredCents: 98000 }],
      counts: [{ ...declaration, lines, notes: 'Faltó cambio' }, { ...base.counts[1]!, lines }],
    }
    const r = closeReadiness(detail, ME)
    expect(r.mode).toBe('ready')
    expect(r.notesRequired).toBe(true)
    expect(r.differenceCents).toBe(-2000)
  })
})
