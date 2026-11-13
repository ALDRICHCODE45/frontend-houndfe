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
  removeClosedDate,
  removeRange,
  setClosedDateReason,
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

  it('never carries the read-only keys, even when the draft has them', () => {
    const s = settingsFixture({
      version: 3,
      updatedBy: { id: 'u1', displayName: 'Ana López' },
      updatedAt: '2026-11-12T15:04:05.123Z',
    }) as ReturnType<typeof settingsFixture> & Record<string, unknown>
    s.recompute = 'DONE'
    const body = toPutBody(s, 3) as Record<string, unknown>
    for (const key of ['version', 'recompute', 'updatedBy', 'updatedAt']) expect(body).not.toHaveProperty(key)
  })

  it('sends an unknown key back unchanged: top level, in a day, a range, an sla, scheduling', () => {
    const s = clone(settingsFixture()) as ReturnType<typeof settingsFixture> & Record<string, unknown>
    s.futureTop = { a: [1, 2] }
    ;(s.openingHours as unknown as Record<string, unknown>).futureHours = 'h'
    ;(s.openingHours.days[0] as unknown as Record<string, unknown>).futureDay = 'd'
    ;(s.openingHours.days[0]!.ranges[0] as unknown as Record<string, unknown>).futureRange = 'r'
    ;(s.slas[0] as unknown as Record<string, unknown>).futureSla = 's'
    ;(s.scheduling as unknown as Record<string, unknown>).futureSched = 'c'
    const body = toPutBody(s, 3) as unknown as Record<string, unknown> & typeof s
    expect(body.futureTop).toEqual({ a: [1, 2] })
    expect((body.openingHours as unknown as Record<string, unknown>).futureHours).toBe('h')
    expect((body.openingHours.days[0] as unknown as Record<string, unknown>).futureDay).toBe('d')
    expect((body.openingHours.days[0]!.ranges[0] as unknown as Record<string, unknown>).futureRange).toBe('r')
    expect((body.slas[0] as unknown as Record<string, unknown>).futureSla).toBe('s')
    expect((body.scheduling as unknown as Record<string, unknown>).futureSched).toBe('c')
  })

  it('sends closedDateReasons trimmed, without empty ones and only for dates that are present', () => {
    const s = settingsFixture({
      closedDateReasons: { '2026-12-25': '  Navidad ', '2027-01-01': '   ', '2030-05-05': 'Huérfano' },
    })
    expect(toPutBody(s, 3).closedDateReasons).toEqual({ '2026-12-25': 'Navidad' })
  })

  it('sends an empty closedDateReasons object when there are none', () => {
    expect(toPutBody(settingsFixture(), 3).closedDateReasons).toEqual({})
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
    b.startTimeoutSeconds = 90
    b.templateLanguageCode = 'en_US'
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
        'extras:x:startTimeoutSeconds',
        'extras:x:templateLanguageCode',
        'sched:sched',
      ]),
    )
    expect(keys).toHaveLength(10)
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

describe('closed date reasons', () => {
  it('setClosedDateReason stores the text as typed and an empty text removes it', () => {
    const s = settingsFixture()
    setClosedDateReason(s, '2026-12-25', 'Navidad ')
    expect(s.closedDateReasons).toEqual({ '2026-12-25': 'Navidad ' })
    setClosedDateReason(s, '2026-12-25', '')
    expect(s.closedDateReasons).toEqual({})
  })

  it('ignores a reason for a date that is not in the list', () => {
    const s = settingsFixture()
    setClosedDateReason(s, '2030-01-01', 'x')
    expect(s.closedDateReasons).toEqual({})
  })

  it('removing a date drops its reason; removing past dates drops theirs', () => {
    const s = settingsFixture({ closedDateReasons: { '2026-09-16': 'Patria', '2026-12-25': 'Navidad' } })
    removeClosedDate(s, '2026-12-25')
    expect(s.closedDateReasons).toEqual({ '2026-09-16': 'Patria' })
    removePastClosedDates(s, '2026-11-12')
    expect(s.closedDateReasons).toEqual({})
  })

  it('a reason change is a dates change; a whitespace-only change is not', () => {
    const a = settingsFixture({ closedDateReasons: { '2026-12-25': 'Navidad' } })
    const b = clone(a)
    b.closedDateReasons['2026-12-25'] = 'Navidad '
    expect(diffItems(a, b)).toEqual([])
    b.closedDateReasons['2026-12-25'] = 'Nochebuena'
    expect(diffItems(a, b).map((i) => i.key)).toEqual(['dates'])
    b.closedDateReasons = {}
    expect(diffItems(a, b).map((i) => i.key)).toEqual(['dates'])
  })

  it('the PUT keeps round-tripping the timeout and the language', () => {
    const body = toPutBody(settingsFixture({ startTimeoutSeconds: 90, templateLanguageCode: 'en_US' }), 3)
    expect(body.startTimeoutSeconds).toBe(90)
    expect(body.templateLanguageCode).toBe('en_US')
  })

  it('rebase merges the timeout and the language field by field', () => {
    const base = settingsFixture()
    const mine = clone(base)
    mine.startTimeoutSeconds = 45
    const theirs = settingsFixture({ version: 4, templateLanguageCode: 'es' })
    const out = rebaseDraft(base, mine, theirs)
    expect(out.startTimeoutSeconds).toBe(45)
    expect(out.templateLanguageCode).toBe('es')

    const mine2 = clone(base)
    mine2.templateLanguageCode = 'en_US'
    const theirs2 = settingsFixture({ version: 4, startTimeoutSeconds: 300 })
    const out2 = rebaseDraft(base, mine2, theirs2)
    expect(out2.templateLanguageCode).toBe('en_US')
    expect(out2.startTimeoutSeconds).toBe(300)
  })

  it('rebase keeps my dates and my reasons on top of their version', () => {
    const base = settingsFixture()
    const mine = clone(base)
    mine.closedDateReasons = { '2026-12-25': 'Navidad' }
    const theirs = settingsFixture({ version: 4, windowWarningMinutes: 30 })
    const out = rebaseDraft(base, mine, theirs)
    expect(out.closedDateReasons).toEqual({ '2026-12-25': 'Navidad' })
    expect(out.windowWarningMinutes).toBe(30)
  })

  it('rebase merges the date lists: my reason edit keeps the date they added, and my removal stays removed', () => {
    const base = settingsFixture()
    const mine = clone(base)
    mine.closedDateReasons = { '2026-12-25': 'Navidad' }
    mine.closedDates = mine.closedDates.filter((d) => d !== '2027-01-01')
    const theirs = clone(base)
    theirs.version = 4
    theirs.closedDates = [...theirs.closedDates, '2027-02-05'].sort()
    theirs.closedDateReasons = { '2027-02-05': 'Constitución' }
    const out = rebaseDraft(base, mine, theirs)
    expect(out.closedDates).toEqual(['2026-09-16', '2026-12-25', '2027-02-05'])
    expect(out.closedDateReasons).toEqual({ '2026-12-25': 'Navidad', '2027-02-05': 'Constitución' })
  })

  it('rebase applies only the SLA and scheduling fields I changed, keeping their unknown nested keys', () => {
    const base = settingsFixture() as ReturnType<typeof settingsFixture> & Record<string, unknown>
    const mine = clone(base)
    const sub = mine.slas[0]!.subtype
    mine.slas[0]!.claimMinutes = 77
    mine.scheduling.slotMinutes = 45
    const theirs = clone(base)
    theirs.version = 4
    Object.assign(theirs.slas[0]!, { slaExtra: 'srv' })
    Object.assign(theirs.scheduling, { futureKnob: [1, 2] })
    const out = rebaseDraft(base, mine, theirs)
    const sla = out.slas.find((s) => s.subtype === sub) as unknown as Record<string, unknown>
    expect(sla.claimMinutes).toBe(77)
    expect(sla.slaExtra).toBe('srv')
    expect(out.scheduling.slotMinutes).toBe(45)
    expect((out.scheduling as unknown as Record<string, unknown>).futureKnob).toEqual([1, 2])
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
