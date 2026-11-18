import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CustomerUpsertSlideover from '../CustomerUpsertSlideover.vue'

// T6c (S2–S3): the customer form groups its fields in the shared HfSectionCard
// (one bordered surface per group, 16px/600 heading), never loose fields next
// to tinted boxes. The price-list switch row sits inside its own bordered
// group with the revealed field under it, not flush against the section edge.

const tabs = {
  props: ['modelValue', 'items'],
  template:
    '<div><slot name="content" v-bind="{ item: { value: \'basic\' } }" /><slot name="content" v-bind="{ item: { value: \'billing\' } }" /></div>',
}
const stubs = {
  USlideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  Slideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  UTabs: tabs,
  Tabs: tabs,
  UForm: { template: '<form><slot /></form>' },
  UFormField: { props: ['label'], template: '<label>{{ label }}<slot /></label>' },
  UInput: { template: '<input />' },
  USelect: { template: '<select />' },
  UTextarea: { template: '<textarea />' },
  UButton: { props: ['label'], template: '<button v-bind="$attrs">{{ label }}<slot /></button>' },
  UIcon: { template: '<span />' },
  AddressModal: { template: '<div />' },
}

function mountCreate() {
  return mount(CustomerUpsertSlideover, { props: { mode: 'create', open: true }, global: { stubs } })
}

const titles = (wrapper: ReturnType<typeof mountCreate>) =>
  wrapper.findAll('section.hf-section-card .hf-section-card__title').map((title) => title.text())

describe('CustomerUpsertSlideover — section cards (T6c)', () => {
  it('uses the shared section card and no tinted ad-hoc panels', () => {
    const source = readFileSync('src/features/POS/customers/components/CustomerUpsertSlideover.vue', 'utf8')
    expect(source).toContain('HfSectionCard')
    expect(source).not.toContain('clients-form-section')
    expect(source).not.toMatch(/\bbg-background\b|\bborder-default\b|\btext-muted\b/)
  })

  it('groups every field of both tabs in named sections', () => {
    const wrapper = mountCreate()
    expect(titles(wrapper)).toEqual([
      'Contacto',
      'Precios',
      'Direcciones',
      'Notas',
      'Datos fiscales',
      'Dirección de facturación',
    ])
    // No field floats outside a section.
    for (const field of wrapper.findAll('input, select, textarea')) {
      expect(field.element.closest('section.hf-section-card'), field.html()).not.toBeNull()
    }
    wrapper.unmount()
  })

  it('never nests a section card inside another', () => {
    const wrapper = mountCreate()
    for (const section of wrapper.findAll('section.hf-section-card')) {
      expect(section.element.parentElement?.closest('.hf-section-card')).toBeNull()
    }
    wrapper.unmount()
  })

  it('frames the price-list switch row and its revealed field in one bordered group', async () => {
    const wrapper = mountCreate()
    const row = wrapper.get('[data-testid="customer-assign-price-list"]')
    const group = row.element.closest('.clients-form-switch-group')
    expect(group).not.toBeNull()
    await row.trigger('click')
    await nextTick()
    const revealed = wrapper.get('.clients-form-switch-group__body')
    expect(revealed.element.closest('.clients-form-switch-group')).toBe(group)
    expect(revealed.find('select').exists()).toBe(true)
    wrapper.unmount()
  })
})
