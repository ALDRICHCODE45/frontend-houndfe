import { describe, expect, it } from 'vitest'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { cashSessionPeriod, custodyOrigin } from './cash-display'

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
