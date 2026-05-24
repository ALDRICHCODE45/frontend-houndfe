import { describe, expect, it } from 'vitest'
import { dateRangeSerializer } from '../../serializers/dateRange'
import { filter } from '../../filterFactories'

const field = filter.dateRange({ id: 'date', label: 'Date', fromParam: 'confirmedFrom', toParam: 'confirmedTo', includeNull: { param: 'includeNull', label: 'x' } })

describe('dateRange serializer', () => {
  it('passes through ISO UTC values as-is and serializes includeNull', () => {
    expect(dateRangeSerializer.toQuery({ from: '2026-05-24T06:00:00.000Z', to: '2026-05-25T05:59:59.999Z' }, field, true)).toEqual({
      confirmedFrom: '2026-05-24T06:00:00.000Z',
      confirmedTo: '2026-05-25T05:59:59.999Z',
      includeNull: 'true',
    })
  })

  it('documents contract: UTC conversion happens in primitive, not serializer', () => {
    expect(dateRangeSerializer.toQuery({ from: '2026-05-24T06:00:00.000Z', to: '2026-05-25T05:59:59.999Z' }, field, false)).toEqual({
      confirmedFrom: '2026-05-24T06:00:00.000Z',
      confirmedTo: '2026-05-25T05:59:59.999Z',
    })
  })

  it('deserializes values and includeNull flag', () => {
    expect(dateRangeSerializer.fromQuery({ confirmedFrom: '2026-01-01T06:00:00.000Z', confirmedTo: '2026-01-31T05:59:59.999Z', includeNull: 'false' }, field)).toEqual({
      value: { from: '2026-01-01T06:00:00.000Z', to: '2026-01-31T05:59:59.999Z' },
      includeNull: false,
    })
  })
})
