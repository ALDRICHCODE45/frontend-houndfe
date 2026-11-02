import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SupplierForm from '../SupplierForm.vue'

const initial = { displayName: 'Centro', termsText: 'Crédito acordado', status: 'ACTIVE' as const }
describe('supplier form', () => {
  it('preserves content and emits explicit null when terms are cleared', async () => {
    const wrapper = mount(SupplierForm, { props: { initial } })
    await wrapper.get('[name="displayName"]').setValue('  Proveedor Centro  ')
    await wrapper.get('[name="termsText"]').setValue('')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([{ displayName: '  Proveedor Centro  ', termsText: null, status: 'ACTIVE' }])
    wrapper.unmount()
  })
  it('rejects blank and oversized Unicode names without truncating input', async () => {
    const wrapper = mount(SupplierForm, { props: { initial } })
    for (const value of ['   ', '🐾'.repeat(201)]) {
      await wrapper.get('[name="displayName"]').setValue(value)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('save')).toBeUndefined()
      expect(wrapper.get('[role="alert"]').text()).toContain('nombre')
      expect((wrapper.get('[name="displayName"]').element as HTMLInputElement).value).toBe(value)
    }
    await wrapper.get('[name="displayName"]').setValue('🐾'.repeat(200))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toHaveLength(1)
    wrapper.unmount()
  })
  it('rejects oversized terms, accepts 4000 code points and honors busy state', async () => {
    const wrapper = mount(SupplierForm, { props: { initial } })
    await wrapper.get('[name="termsText"]').setValue('a'.repeat(4001))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('[name="termsText"]').setValue('a'.repeat(4000))
    await wrapper.setProps({ disabled: true })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.setProps({ disabled: false })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toHaveLength(1)
    wrapper.unmount()
  })
  it('emits cancel without saving and starts from a fresh snapshot on remount', async () => {
    const wrapper = mount(SupplierForm, { props: { initial } })
    await wrapper.get('[name="displayName"]').setValue('Local only')
    await wrapper.get('[data-testid="cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('save')).toBeUndefined()
    wrapper.unmount()
    const reopened = mount(SupplierForm, { props: { initial } })
    expect((reopened.get('[name="displayName"]').element as HTMLInputElement).value).toBe('Centro')
    reopened.unmount()
  })
})
