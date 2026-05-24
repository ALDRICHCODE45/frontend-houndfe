import { describe, expect, it } from 'vitest'
import { multiTextSerializer } from '../../serializers/multiText'
import { filter } from '../../filterFactories'

describe('multiText serializer', () => {
  it('applies stripPrefix on parse', () => {
    const field = filter.multiText({ id: 'folio', label: 'Folio', param: 'folio', parse: { stripPrefix: '#' } })
    expect(multiTextSerializer.fromQuery({ folio: '#1,#2,3' }, field)).toEqual(['1', '2', '3'])
  })
})
