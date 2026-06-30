import { describe, expect, it } from 'vitest'
import { badgeToneToColor, toneToDotClass, activityToBadgeTone } from '../badge.utils'

describe('badgeToneToColor', () => {
  it('passes through base colors', () => {
    expect(badgeToneToColor('success')).toBe('success')
    expect(badgeToneToColor('warning')).toBe('warning')
    expect(badgeToneToColor('error')).toBe('error')
    expect(badgeToneToColor('info')).toBe('info')
    expect(badgeToneToColor('neutral')).toBe('neutral')
  })

  it('resolves aliased tones', () => {
    expect(badgeToneToColor('active')).toBe('success')
    expect(badgeToneToColor('pending')).toBe('warning')
    expect(badgeToneToColor('inactive')).toBe('error')
    expect(badgeToneToColor('automatic')).toBe('info')
    expect(badgeToneToColor('manual')).toBe('secondary')
    expect(badgeToneToColor('type')).toBe('secondary')
  })
})

describe('toneToDotClass', () => {
  it('maps base tones to dot color classes', () => {
    expect(toneToDotClass('success')).toBe('bg-emerald-500')
    expect(toneToDotClass('warning')).toBe('bg-amber-500')
    expect(toneToDotClass('error')).toBe('bg-red-500')
    expect(toneToDotClass('info')).toBe('bg-blue-500')
    expect(toneToDotClass('neutral')).toBe('bg-gray-400')
  })

  it('resolves aliased tones through the color map', () => {
    expect(toneToDotClass('active')).toBe('bg-emerald-500')
    expect(toneToDotClass('inactive')).toBe('bg-red-500')
    expect(toneToDotClass('pending')).toBe('bg-amber-500')
    expect(toneToDotClass('manual')).toBe('bg-violet-500')
  })
})

describe('activityToBadgeTone', () => {
  it('returns active/inactive by flag', () => {
    expect(activityToBadgeTone(true)).toBe('active')
    expect(activityToBadgeTone(false)).toBe('inactive')
  })
})
