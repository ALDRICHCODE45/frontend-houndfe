import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditorialPublication from '../EditorialPublication.vue'
import { careDocument, careVocabulary, state } from '../../../__tests__/editorial-contract-fixtures'

let wrapper: ReturnType<typeof mount>
const button = (text: string) => wrapper.findAll('button').find(item => item.text() === text)
function render(available?: boolean) {
  wrapper = mount(EditorialPublication, { props: {
    state: state(careDocument()), canWrite: true, publishPermission: true, canPublish: true,
    canDiscard: true, hasUnsavedChanges: false, publishIssues: [], busy: false,
    needsReconciliation: false, vocabulary: careVocabulary(), context: null,
    ...(available === undefined ? {} : { publicationAvailable: available }),
  } })
}
afterEach(() => wrapper?.unmount())

describe('publication presentation availability', () => {
  it('keeps the generic publisher contract available by default', async () => {
    render()
    await button('Publicar borrador…')!.trigger('click')
    expect(button('Publicar ahora')!.attributes('disabled')).toBeDefined()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await button('Publicar ahora')!.trigger('click')
    expect(wrapper.emitted('publish')).toEqual([['review-v1']])
  })
  it('removes publication and care consent without removing stored comparison or server discard', async () => {
    render(false)
    expect(wrapper.text()).toContain('La publicación aún no está disponible')
    expect(button('Publicar borrador…')).toBeUndefined()
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.get('details').text()).toContain('Comparar borrador guardado')
    await button('Descartar borrador guardado…')!.trigger('click')
    await button('Descartar borrador')!.trigger('click')
    expect(wrapper.emitted('discard')).toEqual([[]])
    expect(wrapper.emitted('publish')).toBeUndefined()
  })
  it('revokes an already open care confirmation and requires fresh consent on return', async () => {
    render()
    await button('Publicar borrador…')!.trigger('click')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.setProps({ publicationAvailable: false })
    expect(button('Publicar ahora')).toBeUndefined()
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.emitted('publish')).toBeUndefined()
    await wrapper.setProps({ publicationAvailable: true })
    await button('Publicar borrador…')!.trigger('click')
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
  })
})
