// Maps the server's fieldErrors ({path, code}, handoff 16 §4) to the form keys and es-MX messages.
import { describe, expect, it } from 'vitest'
import { mapFieldErrors } from '../settingsFieldErrors'
import { toPutBody } from '../settingsDraft'
import { errorTarget } from '../settingsErrorTargets'
import { settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

const body = () => {
  const s = settingsFixture({ closedDateReasons: { '2026-12-25': 'Navidad' } })
  return toPutBody(s, 3)
}
const run = (fieldErrors: Array<{ path: string; code: string }>) => mapFieldErrors(fieldErrors, body())

describe('mapFieldErrors', () => {
  it('maps a range error to its day by the position in the request', () => {
    const { errors } = run([{ path: 'openingHours.days[1].ranges[1]', code: 'OVERLAP' }])
    expect(Object.keys(errors)).toEqual(['h:TUESDAY'])
    expect(errors['h:TUESDAY']).toMatch(/empalma|toca/)
  })

  it.each([
    ['openingHours.days[0].ranges[0].open', 'INVALID_TIME', 'h:MONDAY'],
    ['openingHours.days[2].ranges[0]', 'CROSSES_MIDNIGHT', 'h:WEDNESDAY'],
    ['openingHours.days[3].ranges[0]', 'EMPTY_RANGE', 'h:THURSDAY'],
    ['openingHours.days[3].ranges', 'TOO_MANY_RANGES', 'h:THURSDAY'],
    ['openingHours.days[2].day', 'DUPLICATE_DAY', 'h:WEDNESDAY'],
    ['openingHours.days', 'NO_OPEN_RANGE', 'h:week'],
    ['openingHours.timeZone', 'INVALID_TIMEZONE', 'h:tz'],
    ['closedDates[2]', 'INVALID_DATE', 'd:list'],
    ['closedDates', 'TOO_MANY_DATES', 'd:list'],
    ['slas[3].resolveMinutes', 'MUST_BE_NULL', 's:TRANSFER_RECEIPT:resolve'],
    ['slas[5].resolveMinutes', 'RESOLVE_BELOW_CLAIM', 's:COMPLAINT:resolve'],
    ['slas[4].claimMinutes', 'OUT_OF_RANGE', 's:TALK_TO_HUMAN:claim'],
    ['receiptCloseMarginMinutes', 'OUT_OF_RANGE', 'x:margin'],
    ['windowWarningMinutes', 'INVALID_TYPE', 'x:window'],
    ['templateName', 'INVALID_TEMPLATE_NAME', 'x:template'],
    ['templateCostText', 'INVALID_LENGTH', 'x:templateCost'],
    ['scheduling.slotMinutes', 'OUT_OF_RANGE', 'c:slot'],
    ['scheduling.slotsOffered', 'OUT_OF_RANGE', 'c:offered'],
    ['scheduling.maxScheduledPerSlot', 'OUT_OF_RANGE', 'c:max'],
    ['closedDateReasons["2026-12-25"]', 'INVALID_LENGTH', 'r:2026-12-25'],
  ])('%s (%s) → %s', (path, code, key) => {
    const { errors, unmapped } = run([{ path, code }])
    expect(Object.keys(errors)).toEqual([key])
    expect(errors[key]!.length).toBeGreaterThan(5)
    expect(unmapped).toBe(0)
    // every mapped key leads somewhere on the page
    expect(errorTarget(key).id).not.toBe('cbs-page')
  })

  it('a reason for a date that is not in the list falls back to the list of dates', () => {
    const { errors } = run([{ path: 'closedDateReasons["2026-12-24"]', code: 'REASON_WITHOUT_DATE' }])
    expect(Object.keys(errors)).toEqual(['d:list'])
  })

  it('unknown paths and fields the form does not have count as unmapped', () => {
    const { errors, unmapped } = run([
      { path: 'tenantId', code: 'UNKNOWN_FIELD' },
      { path: 'slas[7].subtype', code: 'DUPLICATE_SUBTYPE' },
      { path: 'enabledSubtypes[1]', code: 'INVALID_VALUE' },
      { path: 'openingHours.days[40].ranges[0]', code: 'OVERLAP' },
      { path: 'something.new', code: 'FUTURE_CODE' },
    ])
    expect(errors).toEqual({})
    expect(unmapped).toBe(5)
  })

  it('an unknown code on a known path still marks the field, with a generic es-MX message', () => {
    const { errors } = run([{ path: 'windowWarningMinutes', code: 'FUTURE_CODE' }])
    expect(errors['x:window']).toBe('Este valor no es válido.')
  })

  it('reports every field, the first message per field wins, and keeps the order of the response', () => {
    const { errors, first } = run([
      { path: 'scheduling.slotMinutes', code: 'OUT_OF_RANGE' },
      { path: 'openingHours.days[1].ranges[1]', code: 'OVERLAP' },
      { path: 'openingHours.days[1].ranges[2]', code: 'EMPTY_RANGE' },
    ])
    expect(Object.keys(errors)).toEqual(['c:slot', 'h:TUESDAY'])
    expect(errors['h:TUESDAY']).toMatch(/empalma|toca/)
    expect(first).toBe('c:slot')
  })

  it('uses the limit of the field for OUT_OF_RANGE', () => {
    expect(run([{ path: 'scheduling.slotMinutes', code: 'OUT_OF_RANGE' }]).errors['c:slot']).toBe('Entre 5 y 240 minutos.')
    expect(run([{ path: 'windowWarningMinutes', code: 'OUT_OF_RANGE' }]).errors['x:window']).toBe('Usa un valor entre 0 min y 24 h.')
  })

  it('has no first key and no errors for an empty list', () => {
    expect(run([])).toEqual({ errors: {}, unmapped: 0, first: null })
  })
})
