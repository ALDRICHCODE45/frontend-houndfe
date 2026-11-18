<script setup lang="ts">
/**
 * HfSelectableRows — pick several from a medium list, up to about 12
 * (docs/design-system.md §Selección sin checkboxes, «Selectable rows with mark»).
 *
 * A `role="listbox" aria-multiselectable` of 48px `role="option"` rows: label
 * left, a round check mark right (empty ring at rest). The whole row is the
 * target. One tab stop (roving tabindex); arrows, Home and End move focus
 * without changing the selection; Space and Enter toggle the focused row.
 * A live count («2 de 5 seleccionadas», `countLabel` overrides or hides it) and
 * an error under the list linked with `aria-describedby`.
 *
 * `groupLabel` adds a header button above the list that toggles every enabled
 * row (`aria-pressed` true / false / mixed). Disabled rows keep their state.
 *
 * Slots: option `{ item, selected }` (row content), error (replaces the error text).
 */
import { computed, ref, useId, useSlots } from 'vue'
import HfSelectionMark from './HfSelectionMark.vue'
import './hf-selection.css'

export interface HfSelectableRowItem {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export type HfSelectableRowsCountLabel = (selected: number, total: number) => string

const props = withDefaults(
  defineProps<{
    items: readonly HfSelectableRowItem[]
    modelValue: readonly string[]
    label?: string
    labelledby?: string
    disabled?: boolean
    /** Count text; `false` hides the count. */
    countLabel?: HfSelectableRowsCountLabel | false
    error?: string
    /** Header that toggles all enabled rows, with a mixed state. */
    groupLabel?: string
  }>(),
  {
    label: undefined,
    labelledby: undefined,
    disabled: false,
    countLabel: () => (selected: number, total: number) => `${selected} de ${total} seleccionadas`,
    error: undefined,
    groupLabel: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

defineSlots<{
  option?: (props: { item: HfSelectableRowItem; selected: boolean }) => unknown
  error?: () => unknown
}>()

const slots = useSlots()
const countId = useId()
const errorId = useId()
const options = ref<HTMLElement[]>([])
const focusIndex = ref(-1)

const selectedSet = computed(() => new Set(props.modelValue))
const isSelected = (item: HfSelectableRowItem) => selectedSet.value.has(item.value)
const isDisabled = (item: HfSelectableRowItem) => props.disabled || !!item.disabled

const tabStop = computed(() => {
  if (focusIndex.value >= 0 && focusIndex.value < props.items.length) return focusIndex.value
  return Math.max(0, props.items.findIndex((item) => !isDisabled(item)))
})

const countText = computed(() =>
  props.countLabel ? props.countLabel(props.modelValue.length, props.items.length) : '',
)
const hasError = computed(() => !!props.error || !!slots.error)
const describedBy = computed(() => {
  const ids: string[] = []
  if (countText.value) ids.push(countId)
  if (hasError.value) ids.push(errorId)
  return ids.length ? ids.join(' ') : undefined
})

const enabledItems = computed(() => props.items.filter((item) => !isDisabled(item)))
const groupState = computed<'true' | 'false' | 'mixed'>(() => {
  const on = enabledItems.value.filter(isSelected).length
  if (on === 0) return 'false'
  return on === enabledItems.value.length ? 'true' : 'mixed'
})
const groupMark = computed(() =>
  groupState.value === 'true' ? 'checked' : groupState.value === 'mixed' ? 'mixed' : 'unchecked',
)

function emitInOrder(next: Set<string>) {
  const known = new Set(props.items.map((item) => item.value))
  const ordered = props.items.filter((item) => next.has(item.value)).map((item) => item.value)
  // Values outside `items` stay, after the known ones.
  const extra = props.modelValue.filter((value) => !known.has(value) && next.has(value))
  emit('update:modelValue', [...ordered, ...extra])
}

function toggle(index: number) {
  const item = props.items[index]
  if (!item || isDisabled(item)) return
  focusIndex.value = index
  const next = new Set(props.modelValue)
  if (next.has(item.value)) next.delete(item.value)
  else next.add(item.value)
  emitInOrder(next)
}

function toggleAll() {
  if (props.disabled) return
  const next = new Set(props.modelValue)
  const turnOn = groupState.value !== 'true'
  for (const item of enabledItems.value) {
    if (turnOn) next.add(item.value)
    else next.delete(item.value)
  }
  emitInOrder(next)
}

function enabledFrom(start: number, step: number) {
  for (let index = start; index >= 0 && index < props.items.length; index += step) {
    if (!isDisabled(props.items[index]!)) return index
  }
  return -1
}

function moveFocus(index: number) {
  if (index < 0) return
  focusIndex.value = index
  options.value[index]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  switch (event.key) {
    case ' ':
    case 'Enter':
      event.preventDefault()
      toggle(index)
      return
    case 'ArrowDown':
      event.preventDefault()
      moveFocus(enabledFrom(index + 1, 1))
      return
    case 'ArrowUp':
      event.preventDefault()
      moveFocus(enabledFrom(index - 1, -1))
      return
    case 'Home':
      event.preventDefault()
      moveFocus(enabledFrom(0, 1))
      return
    case 'End':
      event.preventDefault()
      moveFocus(enabledFrom(props.items.length - 1, -1))
      return
  }
}
</script>

<template>
  <div class="hf-selectable-rows">
    <button
      v-if="groupLabel"
      type="button"
      class="hf-selectable-rows__group"
      :aria-pressed="groupState"
      :disabled="disabled || enabledItems.length === 0"
      @click="toggleAll"
    >
      <span class="hf-selectable-rows__label">{{ groupLabel }}</span>
      <HfSelectionMark :state="groupMark" />
    </button>
    <div
      class="hf-selectable-rows__list"
      role="listbox"
      aria-multiselectable="true"
      :aria-label="label"
      :aria-labelledby="labelledby"
      :aria-describedby="describedBy"
      :aria-invalid="hasError ? 'true' : undefined"
      :aria-disabled="disabled ? 'true' : undefined"
    >
      <div
        v-for="(item, index) in items"
        :key="item.value"
        ref="options"
        role="option"
        class="hf-selectable-rows__option"
        :aria-selected="isSelected(item)"
        :aria-disabled="isDisabled(item) ? 'true' : undefined"
        :tabindex="index === tabStop ? 0 : -1"
        :data-value="item.value"
        @click="toggle(index)"
        @focus="focusIndex = index"
        @keydown="onKeydown($event, index)"
      >
        <span class="hf-selectable-rows__label">
          <slot name="option" :item="item" :selected="isSelected(item)">
            <span>{{ item.label }}</span>
            <span v-if="item.description" class="hf-selectable-rows__desc">{{ item.description }}</span>
          </slot>
        </span>
        <HfSelectionMark :state="isSelected(item) ? 'checked' : 'unchecked'" />
      </div>
    </div>
    <p v-if="countText" :id="countId" class="hf-selectable-rows__count" aria-live="polite">{{ countText }}</p>
    <p v-if="hasError" :id="errorId" class="hf-selectable-rows__error">
      <UIcon name="i-lucide-circle-alert" aria-hidden="true" />
      <slot name="error">{{ error }}</slot>
    </p>
  </div>
</template>
