import { describe, expect, it } from 'vitest'
import { numericRangeSerializer } from '../../serializers/numericRange'
import { filter } from '../../filterFactories'

const field = filter.numericRange({ id: 'total', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax' })

describe('numericRange serializer', () => {
  it('handles min/max variants', () => {
    expect(numericRangeSerializer.toQuery({}, field)).toEqual({})
    expect(numericRangeSerializer.toQuery({ min: 1000 }, field)).toEqual({ totalMin: '1000' })
    expect(numericRangeSerializer.toQuery({ min: 1000, max: 5000 }, field)).toEqual({ totalMin: '1000', totalMax: '5000' })
    expect(numericRangeSerializer.fromQuery({ totalMin: 'x', totalMax: '200' }, field)).toEqual({ min: undefined, max: 200 })
  })
})
