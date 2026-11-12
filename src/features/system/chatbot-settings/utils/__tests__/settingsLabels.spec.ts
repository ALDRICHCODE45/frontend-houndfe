import { describe, expect, it } from 'vitest'
import {
  describeDate,
  MAX_RANGES_PER_DAY,
  SUBTYPE_COPY,
  timeZoneOptions,
  todayIn,
} from '../settingsLabels'
import { CHATBOT_SETTINGS_SUBTYPES } from '../../interfaces/chatbot-settings.types'

describe('settingsLabels', () => {
  it('has es-MX copy for the eight subtypes and a max of 6 ranges', () => {
    for (const subtype of CHATBOT_SETTINGS_SUBTYPES) expect(SUBTYPE_COPY[subtype].name.length).toBeGreaterThan(2)
    expect(MAX_RANGES_PER_DAY).toBe(6)
  })

  it('timeZoneOptions keeps a zone the fixed list does not know', () => {
    expect(timeZoneOptions('America/Mexico_City').map((o) => o.value)).toContain('America/Tijuana')
    const extra = timeZoneOptions('America/Chihuahua')
    expect(extra.some((o) => o.value === 'America/Chihuahua')).toBe(true)
  })

  it('todayIn resolves the local date of the branch zone', () => {
    const instant = new Date('2026-11-13T03:30:00Z')
    expect(todayIn('America/Mexico_City', instant)).toBe('2026-11-12')
    expect(todayIn('America/Cancun', new Date('2026-11-13T06:00:00Z'))).toBe('2026-11-13')
    expect(todayIn('Not/AZone', instant)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('describeDate says the weekday, the date and how far it is', () => {
    expect(describeDate('2026-12-25', '2026-11-12')).toEqual({ label: 'vie 25 dic 2026', relative: 'en 43 días', past: false })
    expect(describeDate('2026-11-12', '2026-11-12').relative).toBe('hoy')
    expect(describeDate('2026-11-13', '2026-11-12').relative).toBe('mañana')
    expect(describeDate('2026-11-11', '2026-11-12')).toMatchObject({ relative: 'ayer', past: true })
    expect(describeDate('2026-09-16', '2026-11-12')).toMatchObject({ relative: 'hace 57 días', past: true })
  })
})
