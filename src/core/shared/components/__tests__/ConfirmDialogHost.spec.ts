import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ConfirmDialogHost from '../ConfirmDialogHost.vue'
import ConfirmModal from '../ConfirmModal.vue'

// The host is mounted once in App.vue, so its overlay is teleported before any slideover opened
// later. Without its own layer a confirmation asked from inside a slideover paints UNDER the
// slideover's overlay, which also takes the clicks (seen in the browser on «Usar una fuente para todos»).
describe('ConfirmDialogHost', () => {
  it('always paints above other overlays (slideovers, modals)', () => {
    const ui = shallowMount(ConfirmDialogHost).findComponent(ConfirmModal).props('ui') as Record<string, string>
    expect(ui.overlay).toContain('z-[100]')
    expect(ui.content).toContain('z-[101]')
    expect(ui.content).toContain('hf-theme hf-ui')
  })
})
