import { describe, expect, it } from 'vitest'
import { statusBadgeTone } from '../badge.utils'

describe('statusBadgeTone', () => {
  it.each([
    ['neutral', 'neutral'],
    ['info', 'info'],
    ['success', 'success'],
    ['warning', 'warning'],
    ['danger', 'danger'],
    ['error', 'danger'],
    ['inactive', 'danger'],
    ['active', 'success'],
    ['pending', 'warning'],
    ['automatic', 'info'],
    ['manual', 'neutral'],
    ['type', 'neutral'],
  ] as const)('resolves %s to the %s status tone', (tone, expected) => {
    expect(statusBadgeTone(tone)).toBe(expected)
  })
})
