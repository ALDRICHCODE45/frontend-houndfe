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
  it('starts from a fresh snapshot on remount and keeps a single primary action', async () => {
    const wrapper = mount(SupplierForm, { props: { initial } })
    await wrapper.get('[name="displayName"]').setValue('Local only')
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.get('button').attributes('type')).toBe('submit')
    expect(wrapper.find('[data-testid="cancel"]').exists()).toBe(false)
    wrapper.unmount()
    const reopened = mount(SupplierForm, { props: { initial } })
    expect((reopened.get('[name="displayName"]').element as HTMLInputElement).value).toBe('Centro')
    reopened.unmount()
  })
  it('carries no permanent help paragraphs or read-only status line', () => {
    const wrapper = mount(SupplierForm, { props: { initial } })
    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Hasta 200|Hasta 4000|hasta 4000|No generan|Estado:/)
    expect(wrapper.get('[name="displayName"]').attributes('aria-describedby')).toBeUndefined()
    wrapper.unmount()
  })
  it.each([
    ['displayName', 200, 180],
    ['termsText', 4000, 3600],
  ])('shows the %s counter only from 90%% of the limit, warning first and danger at the limit', async (field, max, from) => {
    const wrapper = mount(SupplierForm, { props: { initial: { ...initial, termsText: null } } })
    const counter = () => wrapper.find(`[data-field="${field}"]`)
    await wrapper.get(`[name="${field}"]`).setValue('a'.repeat(from - 1))
    expect(counter().exists()).toBe(false)
    await wrapper.get(`[name="${field}"]`).setValue('a'.repeat(from))
    expect(counter().text()).toBe(`${from.toLocaleString('es-MX')} / ${max.toLocaleString('es-MX')}`)
    expect(counter().attributes('aria-live')).toBe('polite')
    expect(counter().classes()).not.toContain('at-limit')
    await wrapper.get(`[name="${field}"]`).setValue('a'.repeat(max))
    expect(counter().classes()).toContain('at-limit')
    wrapper.unmount()
  })
  it('counts code points, not UTF-16 units, so emoji do not trigger the counter early', async () => {
    const wrapper = mount(SupplierForm, { props: { initial } })
    await wrapper.get('[name="displayName"]').setValue('🐾'.repeat(100))
    expect(wrapper.find('[data-field="displayName"]').exists()).toBe(false)
    await wrapper.get('[name="displayName"]').setValue('🐾'.repeat(180))
    expect(wrapper.get('[data-field="displayName"]').text()).toBe('180 / 200')
    wrapper.unmount()
  })
})
