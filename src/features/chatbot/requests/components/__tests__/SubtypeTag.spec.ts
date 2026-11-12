import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SubtypeTag from '../SubtypeTag.vue'
import { SUBTYPE_LABELS } from '../../utils/requestLabels'
import type { ChatbotRequestSubtype } from '../../interfaces/chatbot-request.types'

describe('SubtypeTag', () => {
  it.each(Object.entries(SUBTYPE_LABELS))('%s reads «%s»', (subtype, label) => {
    const wrapper = mount(SubtypeTag, { props: { subtype: subtype as ChatbotRequestSubtype } })
    expect(wrapper.text()).toBe(label)
    expect(wrapper.attributes('data-subtype')).toBe(subtype)
  })

  it('an unknown subtype (a later unit) reads a generic «Solicitud», never the raw code', () => {
    const wrapper = mount(SubtypeTag, { props: { subtype: 'SOMETHING_NEW' as ChatbotRequestSubtype } })
    expect(wrapper.text()).toBe('Solicitud')
  })
})
