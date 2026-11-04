import { defineComponent, h, type PropType } from 'vue'
import { config } from '@vue/test-utils'
import type { EditorialSelectItem } from '../EditorialSelect.vue'

/** A stand-in for EditorialSelect and EditorialSelectMenu in the specs of their consumers: a native <select> that
 * carries the contract (aria-label, items, placeholder, disabled) and emits the item value, or the picked values
 * for the menu. EditorialSelect.spec covers the real Nuxt UI listbox. Like the real control it is controlled:
 * after a pick it shows the caller's model again, so a refused change visibly stays on the previous value.
 */
function stubOf(name: string, multiple: boolean) {
  return defineComponent({
    name,
    props: { id: String, label: { type: String, required: true }, items: { type: Array as PropType<readonly EditorialSelectItem[]>, required: true },
      placeholder: { type: String, default: 'Elige…' }, disabled: Boolean, invalid: Boolean, describedby: String,
      modelValue: { type: [String, Array] as PropType<string | readonly string[] | undefined>, default: undefined } },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      const selected = (code: string) => multiple ? Array.isArray(props.modelValue) && props.modelValue.includes(code) : props.modelValue === code
      return () => h('select', { id: props.id, 'aria-label': props.label, 'aria-invalid': props.invalid || undefined, 'aria-describedby': props.describedby,
        'data-placeholder': props.placeholder, disabled: props.disabled, multiple,
        onChange: (event: Event) => {
          const select = event.target as HTMLSelectElement
          emit('update:modelValue', multiple ? Array.from(select.selectedOptions, option => option.value) : select.value === '' ? undefined : select.value)
          for (const option of Array.from(select.options)) option.selected = option.value === '' ? typeof props.modelValue !== 'string' : selected(option.value)
        } },
      [...(multiple ? [] : [h('option', { value: '', selected: typeof props.modelValue !== 'string' }, props.placeholder)]),
        ...props.items.map(item => h('option', { key: item.value, value: item.value, disabled: item.disabled, selected: selected(item.value) }, item.label))])
    },
  })
}
export const EditorialSelectStub = stubOf('EditorialSelect', false)
export const EditorialSelectMenuStub = stubOf('EditorialSelectMenu', true)

/** Registers the stubs for every mount of the spec file that calls it. */
export function stubEditorialSelect() {
  config.global.stubs = { ...config.global.stubs, EditorialSelect: EditorialSelectStub, EditorialSelectMenu: EditorialSelectMenuStub }
}
