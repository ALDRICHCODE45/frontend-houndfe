/**
 * T24 (S19): the «Usar una fuente para todos» panel. The source and date come prefilled from a
 * presentation (the user picks which one when there are several), are editable, and are validated
 * as the contract asks before the panel hands them back. The count and the list say what changes.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import Panel from '../EditorialBulkEvidencePanel.vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'

const tick = () => new Promise(resolve => setTimeout(resolve, 80))
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); document.body.innerHTML = '' })

const label = { sourceRef: 'Etiqueta del empaque', verifiedOn: '2026-11-01' }
const maker = { sourceRef: 'Catálogo del proveedor', verifiedOn: '2026-10-15' }
const one = [{ key: 'product', title: 'Producto', source: label }]
const several = [{ key: 'v1', title: 'Chico', source: { sourceRef: '', verifiedOn: '2026-11-05' } }, { key: 'v2', title: 'Grande', source: maker }]

async function open(props: Record<string, unknown> = {}) {
  const wrapper = mount(Panel, { attachTo: document.body, props: { open: true, presentations: one, initial: 'product', fields: ['Especie', 'Peso neto'], ...props } })
  cleanup.push(() => wrapper.unmount())
  await tick()
  return wrapper
}
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const text = () => dialog().textContent ?? ''
const button = (name: string) => Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.trim() === name)!
const sourceBox = (wrapper: ReturnType<typeof mount>) => wrapper.findAllComponents(HfCombobox).find(item => item.props('label') === 'Fuente')!
const other = () => dialog().querySelector<HTMLInputElement>('[data-testid="bulk-source-other"]')
const date = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent({ name: 'InputDate' })

describe('EditorialBulkEvidencePanel', () => {
  it('is a themed right slideover that says how many data it changes, with no ids', async () => {
    await open()
    expect(dialog().className).toContain('hf-theme')
    expect(dialog().className).toContain('hf-form-overlay')
    expect(text()).toContain('Usar una fuente para todos')
    expect(text()).toContain('Se aplicará a 2 datos que todavía no tienen fuente.')
  })
  it('uses the singular for one datum', async () => {
    await open({ fields: ['Especie'] })
    expect(text()).toContain('Se aplicará a 1 dato que todavía no tiene fuente.')
  })
  it('discloses the list of field names', async () => {
    await open()
    const toggle = dialog().querySelector<HTMLButtonElement>('[data-testid="bulk-fields-toggle"]')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    toggle.click(); await tick()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const items = Array.from(dialog().querySelectorAll('[data-testid="bulk-fields"] li')).map(item => item.textContent?.trim())
    expect(items).toEqual(['Especie', 'Peso neto'])
  })
  it('prefills a named source and its date from the presentation', async () => {
    const wrapper = await open()
    expect(sourceBox(wrapper).props('modelValue')).toBe('label')
    expect(other()).toBeNull()
    expect(String(date(wrapper).props('modelValue'))).toBe('2026-11-01')
  })
  it('prefills any other source as «Otro» with its text', async () => {
    const wrapper = await open({ presentations: [{ key: 'product', title: 'Producto', source: maker }] })
    expect(sourceBox(wrapper).props('modelValue')).toBe('other')
    expect(other()!.value).toBe('Catálogo del proveedor')
    expect(other()!.maxLength).toBe(1000)
  })
  it('with one presentation there is nothing to choose', async () => {
    const wrapper = await open()
    expect(wrapper.findComponent(HfSegmented).exists()).toBe(false)
  })
  it('with several presentations the user chooses which one prefills the source', async () => {
    const wrapper = await open({ presentations: several, initial: 'v1' })
    const switcher = wrapper.getComponent(HfSegmented)
    expect(switcher.props('items')).toEqual([{ label: 'Chico', value: 'v1' }, { label: 'Grande', value: 'v2' }])
    expect(switcher.props('modelValue')).toBe('v1')
    expect(sourceBox(wrapper).props('modelValue')).toBeNull()
    switcher.vm.$emit('update:modelValue', 'v2'); await tick()
    expect(sourceBox(wrapper).props('modelValue')).toBe('other')
    expect(other()!.value).toBe('Catálogo del proveedor')
    expect(String(date(wrapper).props('modelValue'))).toBe('2026-10-15')
  })
  it('hands back the edited source and date', async () => {
    const wrapper = await open()
    sourceBox(wrapper).vm.$emit('update:modelValue', 'maker'); await tick()
    date(wrapper).vm.$emit('update:modelValue', new CalendarDate(2026, 9, 30)); await tick()
    button('Usar esta fuente').click(); await tick()
    expect(wrapper.emitted('apply')).toEqual([[{ sourceRef: 'Ficha del fabricante', verifiedOn: '2026-09-30' }]])
  })
  it('hands back a trimmed «Otro» text', async () => {
    const wrapper = await open()
    sourceBox(wrapper).vm.$emit('update:modelValue', 'other'); await tick()
    other()!.value = '  Catálogo del proveedor  '; other()!.dispatchEvent(new Event('input')); await tick()
    button('Usar esta fuente').click(); await tick()
    expect(wrapper.emitted('apply')).toEqual([[{ sourceRef: 'Catálogo del proveedor', verifiedOn: '2026-11-01' }]])
  })
  it('refuses a blank source and says so under the field', async () => {
    const wrapper = await open({ presentations: several, initial: 'v1' })
    button('Usar esta fuente').click(); await tick()
    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(text()).toContain('Indica de dónde salen estos datos.')
    sourceBox(wrapper).vm.$emit('update:modelValue', 'other'); await tick()
    other()!.value = '   '; other()!.dispatchEvent(new Event('input')); await tick()
    button('Usar esta fuente').click(); await tick()
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
  it('refuses a missing date', async () => {
    const wrapper = await open()
    date(wrapper).vm.$emit('update:modelValue', undefined); await tick()
    button('Usar esta fuente').click(); await tick()
    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(text()).toContain('Elige una fecha válida.')
  })
  it('shows an error it is given, and waits while saving', async () => {
    await open({ error: 'No se guardó. No cambió nada.', saving: true })
    expect(dialog().querySelector('[role="alert"]')!.textContent).toContain('No se guardó. No cambió nada.')
    expect(button('Usar esta fuente').disabled).toBe(true)
  })
  it('warns that other unsaved changes are saved too', async () => {
    await open({ unsaved: true })
    expect(text()).toContain('También se guardarán tus otros cambios.')
  })
})
