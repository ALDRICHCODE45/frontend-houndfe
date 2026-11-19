import { describe, expect, it } from 'vitest'
import type { CashSession } from '../interfaces/cash.types'
import {
  CASH_TIMELINE_STEP_IDS,
  buildCashTimeline,
  nextCashAction,
  pickOwnShift,
  type CashTimelineInput,
} from './cash-timeline'

function session(overrides: Partial<CashSession>): CashSession {
  return {
    id: 's',
    tenantId: 't',
    registerId: 'r',
    status: 'OPEN',
    cashierUserId: 'me',
    openingCents: 0,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: true,
    ...overrides,
  }
}

const BASE: CashTimelineInput = {
  status: null,
  perspective: 'cashier',
  verified: false,
  drawerReleased: false,
  handoversDeclared: 0,
  handoversPending: 0,
  countedCashCents: null,
  cashierName: 'Laura',
  canVerify: false,
}

function states(input: Partial<CashTimelineInput>) {
  return Object.fromEntries(
    buildCashTimeline({ ...BASE, ...input }).map((step) => [step.id, step.state]),
  )
}

describe('pickOwnShift · «Tu turno» by default', () => {
  it('picks the latest own session whose drawer is not released', () => {
    const picked = pickOwnShift(
      [
        session({ id: 'old', openedAt: '2026-11-17T08:00:00.000Z' }),
        session({ id: 'other', cashierUserId: 'someone', openedAt: '2026-11-18T09:00:00.000Z' }),
        session({ id: 'new', openedAt: '2026-11-18T08:00:00.000Z' }),
        session({
          id: 'released',
          openedAt: '2026-11-18T10:00:00.000Z',
          drawerReleasedAt: '2026-11-18T11:00:00.000Z',
        }),
      ],
      'me',
    )
    expect(picked?.id).toBe('new')
  })

  it('keeps the list order when the projection has no opening time', () => {
    expect(pickOwnShift([session({ id: 'a' }), session({ id: 'b' })], 'me')?.id).toBe('a')
  })

  it('returns null without an own unreleased session or without a user', () => {
    expect(pickOwnShift([session({ cashierUserId: 'someone' })], 'me')).toBeNull()
    expect(pickOwnShift([session({ drawerReleasedAt: '2026-11-18T11:00:00.000Z' })], 'me')).toBeNull()
    expect(pickOwnShift([session({})], null)).toBeNull()
    expect(pickOwnShift([], 'me')).toBeNull()
  })
})

describe('buildCashTimeline · steps, who does each and their state', () => {
  it('lists the whole lifecycle in order, with the person who acts', () => {
    const steps = buildCashTimeline(BASE)
    expect(steps.map((step) => step.id)).toEqual([...CASH_TIMELINE_STEP_IDS])
    expect(steps.map((step) => step.id)).toEqual([
      'apertura',
      'movimientos',
      'conteo',
      'declaracion',
      'entrega',
      'verificacion',
      'liberar',
      'cierre',
      'corte',
    ])
    const who = Object.fromEntries(steps.map((step) => [step.id, step.actorLabel]))
    expect(who.apertura).toBe('Cajera/o')
    expect(who.verificacion).toBe('Otra persona')
    expect(who.cierre).toBe('Supervisor')
    for (const step of steps) {
      expect(step.label).toBeTruthy()
      expect(step.stateLabel).toBeTruthy()
    }
  })

  it('without a shift only the opening is current', () => {
    const s = states({ status: null })
    expect(s.apertura).toBe('current')
    expect(Object.values(s).filter((state) => state !== 'upcoming')).toEqual(['current'])
  })

  it('OPEN: selling is current and the count is next', () => {
    expect(states({ status: 'OPEN' })).toMatchObject({
      apertura: 'done',
      movimientos: 'current',
      conteo: 'next',
      declaracion: 'upcoming',
      entrega: 'upcoming',
      verificacion: 'upcoming',
    })
  })

  it('COUNTING: the blind declaration is current', () => {
    expect(states({ status: 'COUNTING' })).toMatchObject({
      movimientos: 'done',
      conteo: 'done',
      declaracion: 'current',
      entrega: 'upcoming',
    })
  })

  it('SUBMITTED (S8): the handover is current right after declaring, before verification', () => {
    expect(states({ status: 'SUBMITTED', countedCashCents: 150000 })).toMatchObject({
      declaracion: 'done',
      entrega: 'current',
      verificacion: 'current',
      liberar: 'blocked',
      cierre: 'upcoming',
    })
  })

  it('SUBMITTED: release waits for every handover to be received, not for verification', () => {
    expect(
      states({ status: 'SUBMITTED', countedCashCents: 150000, handoversDeclared: 2, handoversPending: 1 }),
    ).toMatchObject({ entrega: 'current', liberar: 'blocked' })
    expect(
      states({ status: 'SUBMITTED', countedCashCents: 150000, handoversDeclared: 2, handoversPending: 0 }),
    ).toMatchObject({ entrega: 'done', liberar: 'current', verificacion: 'current' })
  })

  it('SUBMITTED: closing becomes current once verified and released', () => {
    expect(
      states({
        status: 'SUBMITTED',
        countedCashCents: 150000,
        handoversDeclared: 1,
        verified: true,
        drawerReleased: true,
      }),
    ).toMatchObject({ verificacion: 'done', liberar: 'done', cierre: 'current', corte: 'upcoming' })
  })

  it('SUBMITTED with zero counted cash needs no handover to release', () => {
    expect(states({ status: 'SUBMITTED', countedCashCents: 0 })).toMatchObject({
      entrega: 'done',
      liberar: 'current',
    })
  })

  it('CLOSED: every step is done and the corte is current', () => {
    const s = states({ status: 'CLOSED', verified: true, drawerReleased: true, handoversDeclared: 1 })
    expect(s.corte).toBe('current')
    expect(Object.entries(s).filter(([id]) => id !== 'corte').every(([, st]) => st === 'done')).toBe(true)
  })

  it('marks only the step of the primary next action as highlighted', () => {
    const steps = buildCashTimeline({ ...BASE, status: 'OPEN' })
    expect(steps.filter((step) => step.highlighted).map((step) => step.id)).toEqual(['conteo'])
    const waiting = buildCashTimeline({
      ...BASE,
      status: 'SUBMITTED',
      countedCashCents: 100,
      handoversDeclared: 1,
      handoversPending: 1,
    })
    expect(waiting.some((step) => step.highlighted)).toBe(false)
  })

  it('tells the cashier, in their own blind window, that totals stay hidden', () => {
    const selling = buildCashTimeline({ ...BASE, status: 'OPEN' }).find((s) => s.id === 'movimientos')
    expect(selling?.detail).toMatch(/ocult/i)
    const audit = buildCashTimeline({ ...BASE, status: 'OPEN', perspective: 'observer' }).find(
      (s) => s.id === 'movimientos',
    )
    expect(audit?.detail).not.toMatch(/ocult/i)
  })
})

describe('nextCashAction · per status × role', () => {
  const next = (input: Partial<CashTimelineInput>) => nextCashAction({ ...BASE, ...input })

  it('cashier: open, count, declare', () => {
    expect(next({ status: null })).toMatchObject({ kind: 'primary', stepId: 'apertura', label: 'Abrir caja' })
    expect(next({ status: 'OPEN' })).toMatchObject({
      kind: 'primary',
      stepId: 'conteo',
      alt: { stepId: 'movimientos' },
    })
    expect(next({ status: 'COUNTING' })).toMatchObject({ kind: 'primary', stepId: 'declaracion' })
  })

  it('cashier (S8): right after declaring the next action is the handover, not waiting for verification', () => {
    expect(next({ status: 'SUBMITTED', countedCashCents: 150000 })).toMatchObject({
      kind: 'primary',
      stepId: 'entrega',
      label: 'Entregar efectivo',
    })
  })

  it('cashier: waits for receipts, then releases, then waits for verification and closing', () => {
    expect(
      next({ status: 'SUBMITTED', countedCashCents: 1, handoversDeclared: 2, handoversPending: 2 }),
    ).toMatchObject({ kind: 'wait', label: 'Faltan 2 recepciones', alt: { stepId: 'entrega' } })
    expect(
      next({ status: 'SUBMITTED', countedCashCents: 1, handoversDeclared: 1, handoversPending: 1 }),
    ).toMatchObject({ kind: 'wait', label: 'Falta 1 recepción' })
    expect(
      next({ status: 'SUBMITTED', countedCashCents: 1, handoversDeclared: 1 }),
    ).toMatchObject({ kind: 'primary', stepId: 'liberar' })
    expect(
      next({ status: 'SUBMITTED', countedCashCents: 1, handoversDeclared: 1, drawerReleased: true }),
    ).toMatchObject({ kind: 'wait', label: 'Esperando verificación' })
    expect(
      next({
        status: 'SUBMITTED',
        countedCashCents: 1,
        handoversDeclared: 1,
        drawerReleased: true,
        verified: true,
      }),
    ).toMatchObject({ kind: 'wait', label: 'Esperando cierre' })
    expect(next({ status: 'CLOSED' })).toMatchObject({ kind: 'primary', stepId: 'corte' })
  })

  it('observer: waits while the cashier sells or counts', () => {
    expect(next({ perspective: 'observer', status: null })).toBeNull()
    expect(next({ perspective: 'observer', status: 'OPEN' })).toMatchObject({
      kind: 'wait',
      label: 'Laura está vendiendo',
      alt: { stepId: 'movimientos' },
    })
    expect(next({ perspective: 'observer', status: 'COUNTING' })).toMatchObject({
      kind: 'wait',
      label: 'Laura está contando',
    })
  })

  it('observer: verifies only with the verification grant, then closes', () => {
    expect(
      next({ perspective: 'observer', status: 'SUBMITTED', canVerify: true }),
    ).toMatchObject({ kind: 'primary', stepId: 'verificacion', label: 'Verificar conteo' })
    expect(next({ perspective: 'observer', status: 'SUBMITTED', canVerify: false })).toMatchObject({
      kind: 'wait',
    })
    expect(
      next({ perspective: 'observer', status: 'SUBMITTED', canVerify: true, verified: true }),
    ).toMatchObject({ kind: 'wait' })
    expect(
      next({
        perspective: 'observer',
        status: 'SUBMITTED',
        verified: true,
        drawerReleased: true,
      }),
    ).toMatchObject({ kind: 'primary', stepId: 'cierre', label: 'Cerrar caja' })
  })

  it('observer without a cashier name never shows an id', () => {
    expect(next({ perspective: 'observer', status: 'OPEN', cashierName: null })?.label).toBe(
      'La persona responsable está vendiendo',
    )
  })
})
