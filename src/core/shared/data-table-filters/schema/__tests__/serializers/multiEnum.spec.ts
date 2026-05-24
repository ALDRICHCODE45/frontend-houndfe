import { describe, expect, it } from 'vitest'
import { multiEnumSerializer } from '../../serializers/multiEnum'
import { filter } from '../../filterFactories'

const field = filter.multiEnum({ id: 'p', label: 'P', param: 'paymentStatus', options: [], includeNull: { param: 'paymentIncludeNull', label: 'x' } })

describe('multiEnum serializer', () => {
  it('round trips and includeNull', () => {
    expect(multiEnumSerializer.toQuery([], field, false)).toEqual({})
    expect(multiEnumSerializer.toQuery(['PAID', 'PARTIAL'], field, true)).toEqual({ paymentStatus: 'PAID,PARTIAL', paymentIncludeNull: 'true' })
    expect(multiEnumSerializer.fromQuery({ paymentStatus: ' PAID,PARTIAL,PAID ', paymentIncludeNull: ['false'] }, field)).toEqual({ value: ['PAID', 'PARTIAL'], includeNull: false })
  })
})
