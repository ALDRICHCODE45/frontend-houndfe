import { describe, expect, it } from 'vitest'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import {
  cashRegisterHeldLabel,
  cashRegisterHold,
  cashSessionPeriod,
  custodyOrigin,
} from './cash-display'

const OPENED = '2026-11-05T15:02:11.000Z'
const CLOSED_SAME_DAY = '2026-11-05T22:45:30.000Z'
const CLOSED_NEXT_DAY = '2026-11-07T01:10:00.000Z'

const time = (iso: string) => formatShortDateTime(iso).split(', ')[1]

describe('cashSessionPeriod', () => {
  it('says when a session still running was opened', () => {
    expect(cashSessionPeriod({ openedAt: OPENED, closedAt: null })).toBe(
      `Desde ${formatShortDateTime(OPENED)}`,
    )
  })

  it('gives a closed session its range, the day said once when it closed the same day', () => {
    expect(cashSessionPeriod({ openedAt: OPENED, closedAt: CLOSED_SAME_DAY })).toBe(
      `${formatShortDateTime(OPENED)} – ${time(CLOSED_SAME_DAY)}`,
    )
  })

  it('repeats the day when the session closed on another one', () => {
    expect(cashSessionPeriod({ openedAt: OPENED, closedAt: CLOSED_NEXT_DAY })).toBe(
      `${formatShortDateTime(OPENED)} – ${formatShortDateTime(CLOSED_NEXT_DAY)}`,
    )
  })

  it('says nothing without an opening time (older payload), never a dash', () => {
    expect(cashSessionPeriod({})).toBe('')
    expect(cashSessionPeriod({ openedAt: undefined, closedAt: CLOSED_SAME_DAY })).toBe('')
  })
})

describe('custodyOrigin', () => {
  it('names the sender and the register the cash came from', () => {
    expect(
      custodyOrigin({ senderDisplayName: 'Ana Cajera', sourceRegisterName: 'Caja Mostrador 2' }),
    ).toBe('de Ana Cajera · Caja Mostrador 2')
  })

  it('keeps whichever name it has and drops the missing one', () => {
    expect(custodyOrigin({ senderDisplayName: 'Ana Cajera', sourceRegisterName: null })).toBe(
      'de Ana Cajera',
    )
    expect(custodyOrigin({ senderDisplayName: null, sourceRegisterName: 'Caja Mostrador 2' })).toBe(
      'Caja Mostrador 2',
    )
  })

  it('says nothing when both names are missing, and never falls back to an id', () => {
    expect(custodyOrigin({ senderDisplayName: null, sourceRegisterName: null })).toBe('')
    expect(custodyOrigin({ senderDisplayName: '  ', sourceRegisterName: undefined })).toBe('')
  })
})

describe('cashRegisterHold (GET /cash-registers drawerHeld, handoff 31)', () => {
  const BASE = { id: 'r-1', name: 'Caja A', isActive: true, createdAt: OPENED }

  it('is free without drawerHeld: the server refusal on open is the safety net', () => {
    expect(cashRegisterHold(BASE)).toEqual({ state: 'free' })
  })

  it('is free when drawerHeld is false', () => {
    expect(
      cashRegisterHold({
        ...BASE,
        drawerHeld: false,
        drawerHeldStatus: null,
        drawerHeldSince: null,
        heldBy: null,
      }),
    ).toEqual({ state: 'free' })
  })

  it('is held with status, since and who (when the caller may see it)', () => {
    const heldBy = {
      sessionId: 's-9',
      status: 'COUNTING' as const,
      openedAt: OPENED,
      cashierDisplayName: 'Ana',
      byMe: false,
    }
    expect(
      cashRegisterHold({
        ...BASE,
        drawerHeld: true,
        drawerHeldStatus: 'COUNTING',
        drawerHeldSince: OPENED,
        heldBy,
      }),
    ).toEqual({ state: 'held', status: 'COUNTING', since: OPENED, heldBy })
    expect(cashRegisterHold({ ...BASE, drawerHeld: true })).toEqual({
      state: 'held',
      status: null,
      since: null,
      heldBy: null,
    })
  })
})

describe('cashRegisterHeldLabel', () => {
  const NOW = new Date(2026, 10, 26, 15, 0)
  const TODAY_0912 = new Date(2026, 10, 26, 9, 12).toISOString()
  const held = (over: Record<string, unknown> = {}) => ({
    state: 'held' as const,
    status: 'COUNTING' as const,
    since: TODAY_0912,
    heldBy: null,
    ...over,
  })
  const by = (over: Record<string, unknown> = {}) => ({
    sessionId: 's-9',
    status: 'COUNTING' as const,
    openedAt: TODAY_0912,
    cashierDisplayName: 'Ana',
    byMe: false,
    ...over,
  })

  it('without heldBy says the state and since when, never a name', () => {
    expect(cashRegisterHeldLabel(held(), NOW)).toBe('Ocupada · en conteo desde 09:12')
    expect(cashRegisterHeldLabel(held({ status: 'OPEN' }), NOW)).toBe('Ocupada · abierta desde 09:12')
    expect(cashRegisterHeldLabel(held({ status: 'SUBMITTED' }), NOW)).toBe(
      'Ocupada · conteo por verificar desde 09:12',
    )
    expect(cashRegisterHeldLabel(held({ status: 'CLOSED' }), NOW)).toBe(
      'Ocupada · cerrada sin liberar desde 09:12',
    )
  })

  it('shows the date when the session is from another day', () => {
    expect(cashRegisterHeldLabel(held({ since: OPENED }), NOW)).toBe(
      `Ocupada · en conteo desde ${formatShortDateTime(OPENED, { now: NOW })}`,
    )
  })

  it('names who holds it when heldBy is visible', () => {
    expect(cashRegisterHeldLabel(held({ heldBy: by() }), NOW)).toBe('Ocupada por Ana desde 09:12')
    // No name in heldBy: back to the state.
    expect(cashRegisterHeldLabel(held({ heldBy: by({ cashierDisplayName: '  ' }) }), NOW)).toBe(
      'Ocupada · en conteo desde 09:12',
    )
  })

  it('says «Tu sesión» for the caller’s own session', () => {
    expect(cashRegisterHeldLabel(held({ heldBy: by({ byMe: true }) }), NOW)).toBe(
      'Tu sesión · en conteo desde 09:12',
    )
  })

  it('drops what it does not know', () => {
    expect(cashRegisterHeldLabel(held({ status: null, since: null }), NOW)).toBe('Ocupada')
  })
})
