import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PurchaseOrderEditorFooter from '../PurchaseOrderEditorFooter.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
const props = { formId: 'purchase-order-form', savedAt: '2026-11-03T20:43:00Z', dirty: false, disabled: false, showConfirm: true, confirmEnabled: true }
describe('editor footer', () => {
  it('says Guardado with the short date when nothing changed', () => {
    const state = mount(PurchaseOrderEditorFooter, { props }).get('.order-save-state')
    expect(state.text()).toBe(`Guardado · ${formatShortDateTime(props.savedAt)}`)
    expect(state.attributes('aria-live')).toBe('polite')
  })
  it('says Cambios sin guardar when dirty, and Sin guardar for an order that was never saved', () => {
    expect(mount(PurchaseOrderEditorFooter, { props: { ...props, dirty: true } }).get('.order-save-state').text()).toBe('Cambios sin guardar')
    expect(mount(PurchaseOrderEditorFooter, { props: { ...props, savedAt: null } }).get('.order-save-state').text()).toBe('Sin guardar')
  })
  it('puts Guardar borrador beside the state as an outline submit tied to the form, never primary', () => {
    const button = mount(PurchaseOrderEditorFooter, { props }).get('button')
    expect(button.text()).toBe('Guardar borrador')
    expect(button.attributes('type')).toBe('submit')
    expect(button.attributes('form')).toBe('purchase-order-form')
    expect(button.classes()).not.toContain('hf-primary-control')
  })
  it('disables saving while the workspace is busy or cannot save', () => {
    expect(mount(PurchaseOrderEditorFooter, { props: { ...props, disabled: true } }).get('button').attributes('disabled')).toBeDefined()
  })
  it('has no Confirmar on desktop: the primary lives in the header', () => {
    expect(mount(PurchaseOrderEditorFooter, { props }).find('[data-testid="confirm-order"]').exists()).toBe(false)
  })
  describe('mobile', () => {
    const mobile = { ...props, mobile: true }
    it('is a sticky bar with Guardar (outline) and the Confirmar orden primary', () => {
      const wrapper = mount(PurchaseOrderEditorFooter, { props: mobile })
      expect(wrapper.classes()).toContain('order-action-bar')
      expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Guardar', 'Confirmar orden'])
      expect(wrapper.get('button[type="submit"]').attributes('form')).toBe('purchase-order-form')
      expect(wrapper.findAll('.hf-primary-control')).toHaveLength(1)
    })
    it('keeps a not-ready Confirmar aria-disabled and pointing at the checklist; emits confirm when ready', async () => {
      const blocked = mount(PurchaseOrderEditorFooter, { props: { ...mobile, confirmEnabled: false } })
      const confirm = blocked.get('[data-testid="confirm-order"]')
      expect(confirm.attributes('aria-disabled')).toBe('true')
      expect(confirm.attributes('aria-describedby')).toBe('order-checklist')
      await confirm.trigger('click')
      expect(blocked.emitted('confirm')).toBeUndefined()
      const ready = mount(PurchaseOrderEditorFooter, { props: mobile })
      await ready.get('[data-testid="confirm-order"]').trigger('click')
      expect(ready.emitted('confirm')).toHaveLength(1)
    })
    it('offers only Guardar without the confirm permission', () => {
      expect(mount(PurchaseOrderEditorFooter, { props: { ...mobile, showConfirm: false } }).findAll('button').map(button => button.text())).toEqual(['Guardar'])
    })
  })
})
