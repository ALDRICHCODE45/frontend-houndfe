// Pure operations on the settings draft: PUT body, change tracking, copy-to-days, closed dates.
import { describe, expect, it } from 'vitest'
import {
  addClosedDate,
  addRange,
  copyDayRanges,
  copyPickupHours,
  diffItems,
  removePastClosedDates,
  rebaseDraft,
  removeRange,
  setRangeTime,
  toPutBody,
  toggleDay,
} from '../settingsDraft'
import { clone, defaultsFixture, settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

const day = (s: ReturnType<typeof settingsFixture>, d: string) =>
  s.openingHours.days.find((x) => x.day === d)!

describe('toPutBody', () => {
  it('sends expectedVersion and never version or recompute', () => {
    const body = toPutBody(settingsFixture({ version: 7 }), 7)
    expect(body.expectedVersion).toBe(7)
    expect(body).not.toHaveProperty('version')
    expect(body).not.toHaveProperty('recompute')
  })

  it('round-trips every field the screen does not edit', () => {
    const source = settingsFixture({ enabledSubtypes: ['RESTOCK', 'COMPLAINT'], templateName: 'aviso_1' })
    const body = toPutBody(source, 3)
    expect(body.enabledSubtypes).toEqual(['RESTOCK', 'COMPLAINT'])
    expect(body.branchOpeningHours).toEqual(source.branchOpeningHours)
    expect(body.templateName).toBe('aviso_1')
    expect(body.windowWarningMinutes).toBe(source.windowWarningMinutes)
    expect(body.scheduling).toEqual(source.scheduling)
    expect(body.receiptCloseMarginMinutes).toBe(60)
  })

  it('omits branchOpeningHours when there is none', () => {
    expect(toPutBody(defaultsFixture(), 0)).not.toHaveProperty('branchOpeningHours')
  })

  it('sorts closed dates and the ranges of each day, and copies instead of aliasing', () => {
    const s = settingsFixture()
    s.closedDates = ['2027-01-01', '2026-09-16']
    day(s, 'MONDAY').ranges = [
      { open: '16:00', close: '19:00' },
      { open: '09:00', close: '14:00' },
    ]
    const body = toPutBody(s, 3)
    expect(body.closedDates).toEqual(['2026-09-16', '2027-01-01'])
    expect(body.openingHours.days[0]!.ranges.map((r) => r.open)).toEqual(['09:00', '16:00'])
    body.slas[0]!.claimMinutes = 1
    expect(s.slas[0]!.claimMinutes).toBe(60)
  })

  it('a cleared template name is sent as null', () => {
    const s = settingsFixture({ templateName: '' })
    expect(toPutBody(s, 3).templateName).toBeNull()
  })
})

describe('diffItems', () => {
  it('is empty for equal settings', () => {
    expect(diffItems(settingsFixture(), settingsFixture())).toEqual([])
  })

  it('names each changed section and item', () => {
    const a = settingsFixture()
    const b = clone(a)
    day(b, 'MONDAY').ranges = [{ open: '08:00', close: '19:00' }]
    b.closedDates.push('2027-02-02')
    b.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes = 20
    b.receiptCloseMarginMinutes = 30
    b.windowWarningMinutes = 60
    b.templateName = 'x'
    b.scheduling.enabled = true
    b.openingHours.timeZone = 'America/Tijuana'
    const keys = diffItems(a, b).map((item) => `${item.sec}:${item.key}`)
    expect(keys).toEqual(
      expect.arrayContaining([
        'hours:h:MONDAY',
        'hours:tz',
        'dates:dates',
        'sla:s:COMPLAINT',
        'sla:x:receiptCloseMarginMinutes',
        'extras:x:windowWarningMinutes',
        'extras:x:templateName',
        'sched:sched',
      ]),
    )
    expect(keys).toHaveLength(8)
  })

  it('does not count read-only fields (version, branchOpeningHours, enabledSubtypes)', () => {
    const a = settingsFixture()
    const b = clone(a)
    b.version = 9
    b.branchOpeningHours = null
    b.enabledSubtypes = ['RESTOCK']
    expect(diffItems(a, b)).toEqual([])
  })

  it('a NaN (unparsable) value counts as a change', () => {
    const a = settingsFixture()
    const b = clone(a)
    b.windowWarningMinutes = Number.NaN
    expect(diffItems(a, b).map((item) => item.key)).toEqual(['x:windowWarningMinutes'])
  })
})

describe('hours editing', () => {
  it('toggleDay opens a closed day with 09:00–19:00 and closes an open one', () => {
    const s = settingsFixture()
    toggleDay(s, 'SUNDAY')
    expect(day(s, 'SUNDAY').ranges).toEqual([{ open: '09:00', close: '19:00' }])
    toggleDay(s, 'SUNDAY')
    expect(day(s, 'SUNDAY').ranges).toEqual([])
  })

  it('addRange appends after the last one and stops at 6', () => {
    const s = settingsFixture()
    addRange(s, 'MONDAY')
    expect(day(s, 'MONDAY').ranges).toHaveLength(2)
    expect(day(s, 'MONDAY').ranges[1]).toEqual({ open: '20:00', close: '22:00' })
    for (let i = 0; i < 10; i++) addRange(s, 'MONDAY')
    expect(day(s, 'MONDAY').ranges).toHaveLength(6)
  })

  it('removeRange drops by index and setRangeTime edits one side', () => {
    const s = settingsFixture()
    removeRange(s, 'WEDNESDAY', 0)
    expect(day(s, 'WEDNESDAY').ranges).toEqual([{ open: '16:00', close: '19:00' }])
    setRangeTime(s, 'WEDNESDAY', 0, 'open', '15:30')
    expect(day(s, 'WEDNESDAY').ranges[0]).toEqual({ open: '15:30', close: '19:00' })
  })

  it('copyDayRanges replaces the target days with copies and leaves the rest alone', () => {
    const s = settingsFixture()
    copyDayRanges(s, 'WEDNESDAY', ['MONDAY', 'SUNDAY'])
    expect(day(s, 'MONDAY').ranges).toEqual(day(s, 'WEDNESDAY').ranges)
    expect(day(s, 'SUNDAY').ranges).toHaveLength(2)
    expect(day(s, 'TUESDAY').ranges).toEqual([{ open: '09:00', close: '19:00' }])
    day(s, 'MONDAY').ranges[0]!.open = '07:00'
    expect(day(s, 'WEDNESDAY').ranges[0]!.open).toBe('09:00')
  })

  it('copyDayRanges ignores the source day among the targets', () => {
    const s = settingsFixture()
    const before = clone(day(s, 'MONDAY').ranges)
    copyDayRanges(s, 'MONDAY', ['MONDAY'])
    expect(day(s, 'MONDAY').ranges).toEqual(before)
  })

  it('copyPickupHours loads the pickup week into the editor only when there is one', () => {
    const s = settingsFixture()
    expect(copyPickupHours(s)).toBe(true)
    expect(s.openingHours).toEqual(s.branchOpeningHours)
    expect(s.openingHours).not.toBe(s.branchOpeningHours)
    const none = defaultsFixture()
    const before = clone(none.openingHours)
    expect(copyPickupHours(none)).toBe(false)
    expect(none.openingHours).toEqual(before)
  })
})

describe('closed dates', () => {
  it('addClosedDate inserts sorted and unique', () => {
    const s = settingsFixture()
    expect(addClosedDate(s, '2026-11-20')).toBeNull()
    expect(s.closedDates).toEqual(['2026-09-16', '2026-11-20', '2026-12-25', '2027-01-01'])
  })

  it('refuses an empty value, a duplicate, an impossible date and the 401st date', () => {
    const s = settingsFixture()
    expect(addClosedDate(s, '')).toBe('Elige una fecha.')
    expect(addClosedDate(s, '2026-12-25')).toBe('Esa fecha ya está en la lista.')
    expect(addClosedDate(s, '2026-02-30')).toMatch(/válida/)
    expect(s.closedDates).toHaveLength(3)
    s.closedDates = Array.from({ length: 400 }, (_, n) =>
      new Date(Date.UTC(2027, 0, 1 + n)).toISOString().slice(0, 10),
    )
    expect(addClosedDate(s, '2030-01-01')).toMatch(/400/)
    expect(s.closedDates).toHaveLength(400)
  })

  it('removePastClosedDates keeps today and the future', () => {
    const s = settingsFixture()
    s.closedDates = ['2026-09-16', '2026-11-12', '2026-12-25']
    expect(removePastClosedDates(s, '2026-11-12')).toBe(1)
    expect(s.closedDates).toEqual(['2026-11-12', '2026-12-25'])
  })
})
