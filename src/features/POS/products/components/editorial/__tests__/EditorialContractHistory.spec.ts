import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditorialContractHistory from '../EditorialContractHistory.vue'
import { careDocument } from '../../../__tests__/editorial-contract-fixtures'

describe('stored ordered history', () => {
  it('preserves duplicate targets, false/empty/unknown/NA/range/evidence and every private care row as escaped readable text', () => {
    const doc = careDocument()
    doc.values = [
      { code: 'same', owner: 'product', variantId: null, state: 'unknown', evidence: null },
      { code: 'same', owner: 'product', variantId: null, state: 'not_applicable', evidence: null },
      { code: 'bool', owner: 'product', variantId: null, state: 'known', payload: { type: 'boolean', value: false }, evidence: null },
      { code: 'empty', owner: 'product', variantId: null, state: 'known', payload: { type: 'multi', value: [] }, evidence: null },
      { code: 'range', owner: 'sellable', variantId: 'gone', state: 'known', payload: { type: 'range', min: -2, max: 4, unit: 'cm' }, evidence: { sourceRef: '<script>source</script>', verifiedOn: 'not-a-date' } },
    ]
    const row = doc.facts[0]!
    row.declarations = [{ key: 'optionalNonpertinenceCodes', state: 'known', value: [], basis: 'known empty', evidence: { sourceRef: 'declaration source', verifiedOn: '2026-01-01' } }]
    row.careReview = { state: 'prepared', jurisdiction: 'Exact jurisdiction', intendedUse: 'Exact use', determination: 'identified', basis: 'review basis', evidence: [],
      requirements: [{ key: 'duplicate', description: 'first requirement', disposition: 'conflicting', evidence: [], basis: 'first basis' }, { key: 'duplicate', description: 'second requirement', disposition: 'unresolved', evidence: [], basis: 'second basis' }],
      warnings: [{ key: 'warn', text: '<b>private warning</b>', disclosure: 'public_required', requirementKeys: ['duplicate', 'missing', 'duplicate'], evidence: [], handlingBasis: 'handling basis' }] }
    const wrapper = mount(EditorialContractHistory, { props: { document: doc } })
    expect(wrapper.findAll('[data-history-assignment]')).toHaveLength(5)
    const text = wrapper.text()
    for (const expected of ['Desconocido', 'No aplica', 'No', 'Lista vacía', '-2 – 4 cm', '<script>source</script>', 'not-a-date', 'known empty', 'declaration source', 'Exact jurisdiction', 'Exact use', 'first requirement', 'second requirement', 'En conflicto', 'Sin resolver', '<b>private warning</b>', 'Requiere divulgación pública', 'handling basis', 'missing']) expect(text).toContain(expected)
    expect(text.indexOf('first requirement')).toBeLessThan(text.indexOf('second requirement'))
    expect(wrapper.findAll('script,b')).toHaveLength(0)
    expect(wrapper.find('pre').exists()).toBe(false)
  })
})
