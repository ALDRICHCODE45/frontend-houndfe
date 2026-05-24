import { describe, expect, it } from 'vitest'
import { multiAsyncSerializer } from '../../serializers/multiAsync'
import { filter } from '../../filterFactories'

const field = filter.multiAsync({ id: 'c', label: 'C', param: 'customerId', options: [] })

describe('multiAsync serializer', () => {
  it('supports array query form', () => {
    expect(multiAsyncSerializer.fromQuery({ customerId: ['a,b', 'c'] }, field).value).toEqual(['a', 'b', 'c'])
  })
})
