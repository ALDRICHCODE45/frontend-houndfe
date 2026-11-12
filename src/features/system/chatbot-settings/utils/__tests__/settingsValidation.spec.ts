// Client-side mirror of the server rules (handoff 16 §3-§4). The server answers 400 without saying
// where, so every rule is checked here first.
import { describe, expect, it } from 'vitest'
import {
  isRealDate,
  MAX_CLOSED_DATES,
  validateSettings,
} from '../settingsValidation'
import {
  clone,
  defaultsFixture,
  settingsFixture,
  week,
} from '../../interfaces/__tests__/chatbot-settings.fixture'
import type { ChatbotSettings } from '../../interfaces/chatbot-settings.types'

const valid = () => settingsFixture()

function withDay(day: 'MONDAY' | 'TUESDAY', ranges: Array<[string, string]>): ChatbotSettings {
  const s = valid()
  s.openingHours.days.find((d) => d.day === day)!.ranges = ranges.map(([open, close]) => ({ open, close }))
  return s
}

describe('validateSettings — whole object', () => {
  it('the fixture and the version 0 defaults are valid', () => {
    expect(validateSettings(valid())).toEqual({})
    expect(validateSettings(defaultsFixture())).toEqual({})
  })
})

describe('validateSettings — opening hours', () => {
  it('close must be after open (equal is invalid, one minute later is valid)', () => {
    expect(validateSettings(withDay('MONDAY', [['09:00', '09:00']]))['h:MONDAY']).toMatch(/después de la apertura/)
    expect(validateSettings(withDay('MONDAY', [['10:00', '09:00']]))['h:MONDAY']).toBeDefined()
    expect(validateSettings(withDay('MONDAY', [['09:00', '09:01']]))['h:MONDAY']).toBeUndefined()
  })

  it('a range cannot cross midnight and the latest close is 23:59', () => {
    expect(validateSettings(withDay('MONDAY', [['19:00', '09:00']]))['h:MONDAY']).toBeDefined()
    expect(validateSettings(withDay('MONDAY', [['09:00', '23:59']]))['h:MONDAY']).toBeUndefined()
    expect(validateSettings(withDay('MONDAY', [['09:00', '24:00']]))['h:MONDAY']).toMatch(/hora/)
  })

  it('an incomplete or malformed time asks to complete it', () => {
    expect(validateSettings(withDay('MONDAY', [['', '19:00']]))['h:MONDAY']).toMatch(/Completa/)
    expect(validateSettings(withDay('MONDAY', [['09:00', '']]))['h:MONDAY']).toMatch(/Completa/)
    expect(validateSettings(withDay('MONDAY', [['9am', '19:00']]))['h:MONDAY']).toMatch(/Completa/)
  })

  it('overlapping or touching ranges are invalid; a one-minute gap is valid', () => {
    const overlap = validateSettings(withDay('MONDAY', [['09:00', '15:00'], ['14:00', '19:00']]))
    expect(overlap['h:MONDAY']).toMatch(/se empalman o se tocan/)
    const touch = validateSettings(withDay('MONDAY', [['09:00', '14:00'], ['14:00', '19:00']]))
    expect(touch['h:MONDAY']).toMatch(/se empalman o se tocan/)
    const gap = validateSettings(withDay('MONDAY', [['09:00', '14:00'], ['14:01', '19:00']]))
    expect(gap['h:MONDAY']).toBeUndefined()
  })

  it('order of the ranges does not matter for the overlap check', () => {
    const e = validateSettings(withDay('MONDAY', [['16:00', '19:00'], ['09:00', '16:30']]))
    expect(e['h:MONDAY']).toMatch(/se empalman o se tocan/)
  })

  it('allows at most 6 ranges per day', () => {
    const six: Array<[string, string]> = [
      ['01:00', '02:00'], ['03:00', '04:00'], ['05:00', '06:00'],
      ['07:00', '08:00'], ['09:00', '10:00'], ['11:00', '12:00'],
    ]
    expect(validateSettings(withDay('MONDAY', six))['h:MONDAY']).toBeUndefined()
    expect(validateSettings(withDay('MONDAY', [...six, ['13:00', '14:00']]))['h:MONDAY']).toMatch(/6 horarios/)
  })

  it('needs at least one open range in the week', () => {
    const s = valid()
    s.openingHours = week({})
    expect(validateSettings(s)['h:week']).toMatch(/al menos un día/)
  })

  it('needs a time zone', () => {
    const s = valid()
    s.openingHours.timeZone = ''
    expect(validateSettings(s)['h:tz']).toBeDefined()
  })
})

describe('validateSettings — closed dates', () => {
  it('real, unique, sorted-agnostic dates are valid', () => {
    const s = valid()
    s.closedDates = ['2026-12-25', '2026-01-01']
    expect(validateSettings(s)['d:list']).toBeUndefined()
  })

  it('an impossible calendar date is invalid', () => {
    const s = valid()
    s.closedDates = ['2026-02-30']
    expect(validateSettings(s)['d:list']).toMatch(/fecha/)
    expect(isRealDate('2026-02-29')).toBe(false)
    expect(isRealDate('2028-02-29')).toBe(true)
    expect(isRealDate('26-1-1')).toBe(false)
  })

  it('a duplicate is invalid', () => {
    const s = valid()
    s.closedDates = ['2026-12-25', '2026-12-25']
    expect(validateSettings(s)['d:list']).toMatch(/repetida/)
  })

  it('holds at most 400 dates', () => {
    const dates = (n: number) =>
      Array.from({ length: n }, (_, i) => new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10))
    const s = valid()
    s.closedDates = dates(MAX_CLOSED_DATES)
    expect(validateSettings(s)['d:list']).toBeUndefined()
    s.closedDates = dates(MAX_CLOSED_DATES + 1)
    expect(validateSettings(s)['d:list']).toMatch(/400/)
  })
})

describe('validateSettings — SLAs', () => {
  const slaOf = (s: ChatbotSettings, subtype: string) => s.slas.find((x) => x.subtype === subtype)!

  it('claim and resolve are null or an integer from 1 to 10080', () => {
    for (const [value, ok] of [[1, true], [10080, true], [0, false], [10081, false], [1.5, false], [Number.NaN, false]] as const) {
      const s = valid()
      slaOf(s, 'RESTOCK').claimMinutes = value
      slaOf(s, 'RESTOCK').resolveMinutes = null
      expect(validateSettings(s)['s:RESTOCK:claim'] === undefined, `claim ${value}`).toBe(ok)
      const t = valid()
      slaOf(t, 'RESTOCK').claimMinutes = null
      slaOf(t, 'RESTOCK').resolveMinutes = value
      expect(validateSettings(t)['s:RESTOCK:resolve'] === undefined, `resolve ${value}`).toBe(ok)
    }
  })

  it('null (no deadline) is valid on both', () => {
    const s = valid()
    slaOf(s, 'COMPLAINT').claimMinutes = null
    slaOf(s, 'COMPLAINT').resolveMinutes = null
    expect(validateSettings(s)).toEqual({})
  })

  it('resolve cannot be below claim (equal is valid)', () => {
    const s = valid()
    slaOf(s, 'COMPLAINT').claimMinutes = 60
    slaOf(s, 'COMPLAINT').resolveMinutes = 59
    expect(validateSettings(s)['s:COMPLAINT:resolve']).toMatch(/no puede ser antes/)
    slaOf(s, 'COMPLAINT').resolveMinutes = 60
    expect(validateSettings(s)['s:COMPLAINT:resolve']).toBeUndefined()
  })

  it('a claim without resolve, or a resolve without claim, is fine', () => {
    const s = valid()
    slaOf(s, 'TALK_TO_HUMAN').claimMinutes = 10
    slaOf(s, 'TALK_TO_HUMAN').resolveMinutes = null
    slaOf(s, 'DISCOUNT').claimMinutes = null
    slaOf(s, 'DISCOUNT').resolveMinutes = 120
    expect(validateSettings(s)).toEqual({})
  })

  it('TRANSFER_RECEIPT must keep resolveMinutes null', () => {
    const s = valid()
    slaOf(s, 'TRANSFER_RECEIPT').resolveMinutes = 30
    expect(validateSettings(s)['s:TRANSFER_RECEIPT:resolve']).toBeDefined()
  })
})

describe('validateSettings — margin, window, template, scheduling', () => {
  const edit = (fn: (s: ChatbotSettings) => void) => {
    const s = clone(valid())
    fn(s)
    return validateSettings(s)
  }

  it('receiptCloseMarginMinutes and windowWarningMinutes are integers from 0 to 1440', () => {
    for (const [value, ok] of [[0, true], [1440, true], [-1, false], [1441, false], [1.5, false], [Number.NaN, false]] as const) {
      expect(edit((s) => { s.receiptCloseMarginMinutes = value })['x:margin'] === undefined, `margin ${value}`).toBe(ok)
      expect(edit((s) => { s.windowWarningMinutes = value })['x:window'] === undefined, `window ${value}`).toBe(ok)
    }
  })

  it('templateName is null or 1 to 512 of lowercase letters, digits and underscore', () => {
    expect(edit((s) => { s.templateName = null })['x:template']).toBeUndefined()
    expect(edit((s) => { s.templateName = 'aviso_2' })['x:template']).toBeUndefined()
    expect(edit((s) => { s.templateName = 'a'.repeat(512) })['x:template']).toBeUndefined()
    expect(edit((s) => { s.templateName = 'a'.repeat(513) })['x:template']).toBeDefined()
    expect(edit((s) => { s.templateName = 'Aviso' })['x:template']).toBeDefined()
    expect(edit((s) => { s.templateName = 'aviso-uno' })['x:template']).toBeDefined()
    expect(edit((s) => { s.templateName = '' })['x:template']).toBeDefined()
  })

  it('templateCostText is 1 to 200 characters', () => {
    expect(edit((s) => { s.templateCostText = 'x' })['x:templateCost']).toBeUndefined()
    expect(edit((s) => { s.templateCostText = 'x'.repeat(200) })['x:templateCost']).toBeUndefined()
    expect(edit((s) => { s.templateCostText = '' })['x:templateCost']).toBeDefined()
    expect(edit((s) => { s.templateCostText = 'x'.repeat(201) })['x:templateCost']).toBeDefined()
  })

  it('scheduling bounds: slotMinutes 5-240, slotsOffered 1-10, maxScheduledPerSlot 1-50', () => {
    const cases: Array<[keyof ChatbotSettings['scheduling'], string, number, number, number, number]> = [
      ['slotMinutes', 'c:slot', 5, 240, 4, 241],
      ['slotsOffered', 'c:offered', 1, 10, 0, 11],
      ['maxScheduledPerSlot', 'c:max', 1, 50, 0, 51],
    ]
    for (const [field, key, lo, hi, below, above] of cases) {
      expect(edit((s) => { s.scheduling[field] = lo as never })[key], `${field} ${lo}`).toBeUndefined()
      expect(edit((s) => { s.scheduling[field] = hi as never })[key], `${field} ${hi}`).toBeUndefined()
      expect(edit((s) => { s.scheduling[field] = below as never })[key], `${field} ${below}`).toBeDefined()
      expect(edit((s) => { s.scheduling[field] = above as never })[key], `${field} ${above}`).toBeDefined()
      expect(edit((s) => { s.scheduling[field] = 2.5 as never })[key], `${field} 2.5`).toBeDefined()
    }
  })
})

describe('closed date reasons', () => {
  it('accepts 1 to 80 characters after trimming, and blank means no reason', () => {
    const ok = settingsFixture({
      closedDateReasons: { '2026-09-16': 'a'.repeat(80), '2026-12-25': '  Navidad  ', '2027-01-01': '   ' },
    })
    expect(validateSettings(ok)).toEqual({})
  })

  it('refuses a reason longer than 80 characters once trimmed, under the date key', () => {
    const bad = settingsFixture({ closedDateReasons: { '2026-12-25': `  ${'a'.repeat(81)}  ` } })
    expect(validateSettings(bad)['r:2026-12-25']).toMatch(/80/)
  })

  it('ignores a reason of a date that is not in the list (it is never sent)', () => {
    const orphan = settingsFixture({ closedDateReasons: { '2030-01-01': 'a'.repeat(200) } })
    expect(validateSettings(orphan)).toEqual({})
  })
})
