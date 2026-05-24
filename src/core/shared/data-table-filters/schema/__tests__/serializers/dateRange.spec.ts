import { describe, expect, it } from 'vitest'
import { dateRangeSerializer } from '../../serializers/dateRange'
import { filter } from '../../filterFactories'
import { localEndOfDayUTC } from '@/core/shared/utils/dateRangeBoundaries'

const field = filter.dateRange({ id: 'date', label: 'Date', fromParam: 'from', toParam: 'to', includeNull: { param: 'includeNull', label: 'x' } })

describe('dateRange serializer', () => {
  it('applies end-of-day to to param and boolean includeNull', () => {
    expect(dateRangeSerializer.toQuery({ from: '2026-01-01', to: '2026-01-31' }, field, true)).toEqual({
      from: '2026-01-01',
      to: localEndOfDayUTC('2026-01-31'),
      includeNull: 'true',
    })
    expect(dateRangeSerializer.fromQuery({ from: '2026-01-01', to: '2026-01-31', includeNull: 'false' }, field)).toEqual({
      value: { from: '2026-01-01', to: '2026-01-31' },
      includeNull: false,
    })
  })
})
