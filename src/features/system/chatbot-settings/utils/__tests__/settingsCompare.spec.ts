import { describe, expect, it } from 'vitest'
import { conflictGroups, describeValue } from '../settingsCompare'
import { clone, settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

describe('conflictGroups', () => {
  it('splits what only I changed, what only they changed and what both changed', () => {
    const base = settingsFixture()
    const mine = clone(base)
    mine.windowWarningMinutes = 60
    mine.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes = 45
    const theirs = settingsFixture({ version: 4 })
    theirs.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes = 20
    theirs.closedDates = [...theirs.closedDates, '2027-01-06']

    const groups = conflictGroups(base, mine, theirs)

    expect(groups.onlyMine.map((i) => i.key)).toEqual(['x:windowWarningMinutes'])
    expect(groups.onlyTheirs.map((i) => i.key)).toEqual(['dates'])
    expect(groups.both.map((i) => i.key)).toEqual(['s:COMPLAINT'])
  })

  it('is empty when nobody changed anything', () => {
    const base = settingsFixture()
    expect(conflictGroups(base, clone(base), settingsFixture({ version: 4 }))).toEqual({
      onlyMine: [],
      onlyTheirs: [],
      both: [],
    })
  })
})

describe('describeValue', () => {
  it('says each kind of entry in es-MX', () => {
    const s = settingsFixture()
    expect(describeValue(s, 'h:WEDNESDAY')).toBe('09:00–14:00 y 16:00–19:00')
    expect(describeValue(s, 'h:SUNDAY')).toBe('Cerrado')
    expect(describeValue(s, 'dates')).toBe('3 fechas')
    expect(describeValue(s, 's:TALK_TO_HUMAN')).toBe('atender 10 min, resolver Sin plazo')
    expect(describeValue(s, 'x:windowWarningMinutes')).toBe('2 h')
    expect(describeValue(s, 'x:templateName')).toBe('Sin configurar')
    expect(describeValue(s, 'x:startTimeoutSeconds')).toBe('120 segundos')
    expect(describeValue(s, 'x:templateLanguageCode')).toBe('es_MX')
  })
})
