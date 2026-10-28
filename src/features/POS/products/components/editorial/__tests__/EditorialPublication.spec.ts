import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EditorialPublication from '../EditorialPublication.vue'
import type { EditorialDocument } from '../../../interfaces/product-editorial.types'

const document: EditorialDocument = { commercialTitle: 'Título', description: null, familyCode: null, mediaRefs: [], values: [] }
let wrapper: ReturnType<typeof mount> | undefined
function render() {
  wrapper = mount(EditorialPublication, {
    attachTo: window.document.body,
    props: {
      state: { cycle: 2, draft: { revision: 4, basePublishedRevision: 1, document }, published: { revision: 1, document } },
      canWrite: true, publishPermission: true, canPublish: true, canDiscard: true, hasUnsavedChanges: false,
      publishIssues: [], busy: false, needsReconciliation: false, vocabulary: null, context: null,
    },
  })
  return wrapper
}
const byText = (text: string) => wrapper!.findAll('button').find(item => item.text() === text)!
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

describe('publication confirmation keyboard focus', () => {
  it.each([['Publicar borrador…'], ['Descartar borrador guardado…']])('moves focus to Cancelar when %s opens its confirmation', async trigger => {
    render()
    await byText(trigger).trigger('click')
    await flushPromises()
    expect(window.document.activeElement?.textContent?.trim()).toBe('Cancelar')
  })
  it.each([['Publicar borrador…'], ['Descartar borrador guardado…']])('returns focus to %s after cancelling', async trigger => {
    render()
    await byText(trigger).trigger('click')
    await flushPromises()
    await byText('Cancelar').trigger('click')
    await flushPromises()
    expect(window.document.activeElement?.textContent?.trim()).toBe(trigger)
  })
})
