<script setup lang="ts">
/**
 * HfCombobox — The one choice control of HF forms: Nuxt UI `USelectMenu`
 * themed to the field style, single or multiple.
 *
 * - A search input appears above the list once there are more than
 *   `searchThreshold` options (accent-insensitive, label only).
 * - Options are 36px (44px on touch), centered, highlighted with
 *   `--hf-active-soft`; the chosen one carries a trailing check, and in
 *   multiple mode every option has a checkbox and the trigger shows at most two
 *   chips, then `+N`.
 * - `specialAnswers` (No lo sé, No aplica) sit in a separated footer group.
 *   Picking one emits `update:special` and never touches the value; with
 *   `special` set the trigger shows its label in muted italic. Picking a
 *   regular option clears it (`update:special` with `null`).
 *
 * Props:
 *   items           — { label, value, disabled? }[]
 *   modelValue      — string (single) or string[] (multiple)
 *   multiple        — several values, chips in the trigger
 *   label           — accessible name of the trigger (the visible label lives in HfFormField)
 *   placeholder     — muted text with no value (default `Elige una opción`)
 *   invalid, disabled, id, describedby
 *   specialAnswers  — { value, label, icon? }[] footer answers
 *   special         — the chosen special answer value, or null
 *   searchThreshold — options shown without search (default 7)
 *   embedded        — borderless trigger for a compound control (HfUnitField)
 */
import { computed, ref } from 'vue'
import './hf-form.css'

export interface HfComboboxItem {
  label: string
  value: string
  disabled?: boolean
}

export interface HfSpecialAnswer {
  value: string
  label: string
  icon?: string
}

const props = withDefaults(defineProps<{
  items: readonly HfComboboxItem[]
  modelValue?: string | readonly string[] | null
  multiple?: boolean
  label: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  id?: string
  describedby?: string
  specialAnswers?: readonly HfSpecialAnswer[]
  special?: string | null
  searchThreshold?: number
  embedded?: boolean
}>(), {
  modelValue: undefined,
  placeholder: 'Elige una opción',
  specialAnswers: () => [],
  special: null,
  searchThreshold: 7,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | null]
  'update:special': [value: string | null]
}>()

const MAX_CHIPS = 2
// Special answers travel through the menu under a reserved key so they never
// collide with a real option value.
const SPECIAL_PREFIX = '\u0000hf-special:'
const toSpecialKey = (value: string) => `${SPECIAL_PREFIX}${value}`
const isSpecialKey = (value: string) => value.startsWith(SPECIAL_PREFIX)
const fromSpecialKey = (value: string) => value.slice(SPECIAL_PREFIX.length)
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const searchTerm = ref('')
const searchable = computed(() => props.items.length > props.searchThreshold)
const searchInput = computed(() => searchable.value
  ? { placeholder: 'Buscar', icon: 'i-lucide-search', 'aria-label': `Buscar en ${props.label.toLowerCase()}` }
  : false)

const activeSpecial = computed(() => props.specialAnswers.find(answer => answer.value === props.special) ?? null)
const values = computed<string[]>(() => {
  if (props.modelValue == null) return []
  return Array.isArray(props.modelValue) ? [...props.modelValue] : [props.modelValue as string]
})
const selectedItems = computed(() => values.value
  .map(value => props.items.find(item => item.value === value))
  .filter((item): item is HfComboboxItem => item !== undefined))
const visibleChips = computed(() => selectedItems.value.slice(0, MAX_CHIPS))
const hiddenCount = computed(() => Math.max(0, selectedItems.value.length - MAX_CHIPS))

const menuModel = computed(() => {
  const special = activeSpecial.value ? toSpecialKey(activeSpecial.value.value) : null
  if (props.multiple) return special ? [special] : values.value
  return special ?? values.value[0] ?? undefined
})

const optionClass = computed(() => ['hf-combobox__option', props.multiple && 'hf-combobox__option--box'])
const menuItems = computed(() => {
  const term = normalize(searchTerm.value.trim())
  const regular = props.items
    .filter(item => !term || normalize(item.label).includes(term))
    .map(item => ({ ...item, class: optionClass.value }))
  const groups: Record<string, unknown>[][] = []
  if (regular.length > 0) groups.push(regular)
  else if (term && props.specialAnswers.length > 0)
    // With the footer answers still listed, Nuxt's empty slot never shows: say it in the list.
    groups.push([{ type: 'label', label: noMatch.value, class: 'hf-combobox__empty' }])
  if (props.specialAnswers.length > 0) {
    groups.push(props.specialAnswers.map(answer => ({
      label: answer.label,
      value: toSpecialKey(answer.value),
      icon: answer.icon,
      class: 'hf-combobox__option hf-combobox__special',
    })))
  }
  return groups
})
const noMatch = computed(() => `Sin resultados para «${searchTerm.value.trim()}»`)

const ui = computed(() => ({
  base: ['hf-combobox__trigger', props.embedded && 'hf-combobox__trigger--embedded', props.invalid && 'hf-combobox__trigger--invalid'],
  content: 'hf-theme hf-ui hf-combobox__content',
  input: 'hf-combobox__search',
  viewport: 'hf-combobox__viewport',
  trailingIcon: 'hf-combobox__chevron',
}))

function isChecked(value: unknown) {
  const model = menuModel.value
  return Array.isArray(model) ? model.includes(String(value)) : model === value
}

function onUpdate(next: unknown) {
  const currentSpecial = activeSpecial.value ? toSpecialKey(activeSpecial.value.value) : null
  if (props.multiple) {
    const picked = Array.isArray(next) ? next.map(String) : []
    const freshSpecial = picked.find(value => isSpecialKey(value) && value !== currentSpecial)
    if (freshSpecial) {
      emit('update:special', fromSpecialKey(freshSpecial))
      return
    }
    if (currentSpecial) emit('update:special', null)
    emit('update:modelValue', picked.filter(value => !isSpecialKey(value)))
    return
  }
  const value = next == null ? null : String(next)
  if (value !== null && isSpecialKey(value)) {
    if (value !== currentSpecial) emit('update:special', fromSpecialKey(value))
    return
  }
  if (currentSpecial) emit('update:special', null)
  emit('update:modelValue', value)
}
</script>

<template>
  <USelectMenu
    :id="id"
    v-model:search-term="searchTerm"
    :model-value="menuModel"
    :items="menuItems"
    :multiple="multiple"
    value-key="value"
    variant="none"
    ignore-filter
    :search-input="searchInput"
    :disabled="disabled"
    :aria-label="label"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedby"
    class="w-full"
    :ui="ui"
    @update:model-value="onUpdate"
  >
    <span class="hf-combobox__value">
      <span v-if="activeSpecial" class="hf-combobox__special-text">{{ activeSpecial.label }}</span>
      <template v-else-if="multiple && selectedItems.length > 0">
        <span v-for="item in visibleChips" :key="item.value" class="hf-combobox__chip">{{ item.label }}</span>
        <span v-if="hiddenCount > 0" class="hf-combobox__chip hf-combobox__chip--more">
          <span aria-hidden="true">+{{ hiddenCount }}</span>
          <span class="sr-only"> y {{ hiddenCount }} más</span>
        </span>
      </template>
      <span v-else-if="!multiple && selectedItems.length > 0" class="hf-combobox__text">{{ selectedItems[0]!.label }}</span>
      <span v-else class="hf-combobox__placeholder">{{ placeholder }}</span>
    </span>

    <template v-if="multiple" #item-leading="{ item }">
      <UIcon
        v-if="typeof item === 'object' && item !== null && 'icon' in item && item.icon"
        :name="String(item.icon)"
        data-slot="itemLeadingIcon"
        class="hf-combobox__icon"
      />
      <span
        v-else-if="typeof item === 'object' && item !== null && 'value' in item && !isSpecialKey(String(item.value))"
        class="hf-combobox__box"
        :data-checked="isChecked(item.value) || undefined"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-check" class="hf-combobox__box-icon" />
      </span>
    </template>

    <template #empty>
      {{ searchTerm.trim() ? noMatch : 'Sin opciones' }}
    </template>
  </USelectMenu>
</template>
