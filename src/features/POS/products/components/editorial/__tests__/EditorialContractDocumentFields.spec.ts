import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import DocumentFields from '../EditorialContractDocumentFields.vue'
import type { EditorialDocumentEditingState as State } from '../../../utils/editorial-contract-document-editing'

function initial(patch: Partial<State> = {}): State {
  return { schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: ['<img src=x>', 'private-asset'], familyCode: 'care',
    values: [{ id: 'a', target: { code: 'measure.net_mass', owner: 'product', variantId: null }, input: { state: 'unknown' } }],
    facts: [{ id: 'f', variantId: null, presentation: 'Original', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }],
    ...patch }
}
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()) })
function render(input = initial(), props: Record<string, unknown> = {}) {
  const state = shallowRef(freeze(input)), version = shallowRef(0), events: State[] = [], before = JSON.stringify(input)
  const wrapper = mount(defineComponent({ setup: () => () => h(DocumentFields, { key: version.value, id: 'document', modelValue: state.value, ...props,
    'onUpdate:modelValue': (value: State) => { events.push(value); state.value = freeze(value) } }) }))
  stops.push(() => { expect(JSON.stringify(input)).toBe(before); wrapper.unmount() })
  return { wrapper, state, events, async remount() { version.value++; await nextTick() } }
}

describe('document fields', () => {
  it('renders without effects and keeps null as an empty control, never as the word "null"', async () => {
    const input = initial(), { wrapper, state, events, remount } = render(input)
    expect(wrapper.get('#document-title').element).toHaveProperty('value', '')
    expect(wrapper.get('#document-description').element).toHaveProperty('value', '')
    await remount()
    expect(state.value).toBe(input); expect(state.value.commercialTitle).toBeNull(); expect(events).toEqual([])
  })

  it('keeps the media references as read-only literal text, never as images or file inputs', () => {
    const { wrapper } = render()
    expect(wrapper.text()).toContain('Imágenes vinculadas (2)')
    expect(wrapper.text()).toContain('Solo lectura')
    expect(wrapper.text()).toContain('<img src=x>')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-media-reference]')).toHaveLength(2)
  })

  it('says nothing about media when there are none', () => {
    expect(render(initial({ mediaRefs: [] })).wrapper.text()).not.toContain('Imágenes vinculadas')
  })

  it('preserves exact title and description edits, including explicit empty strings, without touching the rest', async () => {
    const { wrapper, state, events } = render(), values = state.value.values, facts = state.value.facts, media = state.value.mediaRefs
    await wrapper.get('#document-title').setValue('  Título <b>  ')
    await wrapper.get('#document-description').setValue('  descripción\n ')
    expect(state.value.commercialTitle).toBe('  Título <b>  '); expect(state.value.description).toBe('  descripción\n ')
    await wrapper.get('#document-title').setValue(''); await wrapper.get('#document-description').setValue('')
    expect(state.value.commercialTitle).toBe(''); expect(state.value.description).toBe('')
    expect(state.value.values).toBe(values); expect(state.value.facts).toBe(facts); expect(state.value.mediaRefs).toBe(media)
    expect(Object.keys(state.value)).toHaveLength(7); expect(events).toHaveLength(4)
  })

  it('keeps the raw text through a remount', async () => {
    const { wrapper, remount } = render()
    await wrapper.get('#document-title').setValue('  local 😀  ')
    await remount()
    expect(wrapper.get('#document-title').element).toHaveProperty('value', '  local 😀  ')
  })

  it('suppresses even synthetic events while disabled', () => {
    const { wrapper, events } = render(initial(), { disabled: true })
    for (const selector of ['#document-title', '#document-description']) {
      const element = wrapper.get(selector).element as HTMLInputElement
      expect(element.matches(':disabled')).toBe(true); element.value = 'synthetic'; element.dispatchEvent(new Event('input', { bubbles: true }))
    }
    expect(events).toEqual([])
  })

  it('read-only shows the text with no controls', () => {
    const { wrapper } = render(initial({ commercialTitle: 'Collar', description: 'Ajustable' }), { readonly: true })
    expect(wrapper.find('input, textarea').exists()).toBe(false)
    expect(wrapper.get('[data-field="title"]').text()).toBe('Collar')
    expect(wrapper.get('[data-field="description"]').text()).toBe('Ajustable')
  })

  it('read-only says when there is no title or description yet', () => {
    const { wrapper } = render(initial(), { readonly: true })
    expect(wrapper.get('[data-field="title"]').text()).toBe('Sin título')
    expect(wrapper.get('[data-field="description"]').text()).toBe('Sin descripción')
  })
})

describe('document field limits', () => {
  it('shows no counter far from the limit', () => {
    expect(render(initial({ commercialTitle: 'x'.repeat(179), description: 'y'.repeat(100) })).wrapper.find('.counter').exists()).toBe(false)
  })

  it('shows the counter from 90% of the title limit and marks the limit', async () => {
    const { wrapper } = render(initial({ commercialTitle: 'x'.repeat(180) }))
    expect(wrapper.get('.counter').text()).toBe('180 / 200')
    expect(wrapper.get('.counter').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('.counter').attributes('data-over')).toBe('false')
    expect(render(initial({ commercialTitle: 'x'.repeat(200) })).wrapper.get('.counter').attributes('data-over')).toBe('true')
  })

  it('counts characters, not UTF-16 units', () => {
    expect(render(initial({ commercialTitle: '😀'.repeat(180) })).wrapper.get('.counter').text()).toBe('180 / 200')
  })

  it('shows the description counter from 18,000 of 20,000', () => {
    expect(render(initial({ description: 'y'.repeat(18000) })).wrapper.get('.counter').text()).toBe('18,000 / 20,000')
  })

  it('puts a title issue next to the title with aria-invalid, linked by aria-describedby', () => {
    const { wrapper } = render(initial({ commercialTitle: 'x'.repeat(201) }), { titleIssue: 'El título es demasiado largo. El máximo es 200 caracteres.' })
    const title = wrapper.get('#document-title')
    expect(title.attributes('aria-invalid')).toBe('true')
    expect(title.attributes('aria-describedby')).toBe('document-title-issue')
    expect(wrapper.get('#document-title-issue').text()).toContain('máximo es 200')
    expect(wrapper.get('#document-description').attributes('aria-invalid')).toBeUndefined()
  })

  it('puts a description issue next to the description', () => {
    const { wrapper } = render(initial(), { descriptionIssue: 'La descripción es demasiado larga.' })
    expect(wrapper.get('#document-description').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#document-description-issue').text()).toContain('demasiado larga')
  })
})
