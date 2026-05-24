import { describe, expect, it } from 'vitest'
import { booleanFlagFromQuery, booleanFlagToQuery } from '../../serializers/booleanFlag'

describe('booleanFlag serializer', () => {
  it('persists only true', () => {
    expect(booleanFlagToQuery(true, 'x')).toEqual({ x: 'true' })
    expect(booleanFlagToQuery(false, 'x')).toEqual({})
    expect(booleanFlagToQuery(undefined, 'x')).toEqual({})
  })

  it('parses correctly including array false regression', () => {
    expect(booleanFlagFromQuery({ x: 'true' }, 'x')).toBe(true)
    expect(booleanFlagFromQuery({ x: 'false' }, 'x')).toBe(false)
    expect(booleanFlagFromQuery({}, 'x')).toBe(false)
    expect(booleanFlagFromQuery({ x: ['true'] }, 'x')).toBe(true)
    expect(booleanFlagFromQuery({ x: ['false'] }, 'x')).toBe(false)
  })
})
