<script setup lang="ts">
/**
 * HfRadioCards — pick one of 2–5 options that need an explanation or a sample
 * (docs/design-system.md §Selección sin checkboxes, «Radio card»; modelled on
 * catalog-settings CatalogStockPresentationField).
 *
 * A radiogroup whose cards are native buttons with `role="radio"`: the whole
 * card (mark, title, description, preview) is the target. Roving tabindex: the
 * chosen card (or the first enabled one) is the only tab stop; arrows move and
 * choose, wrapping and skipping disabled cards; Home and End jump to the ends.
 * The chosen card wears `--hf-active-soft`, the `--hf-active` border, a filled
 * round check mark, the title in `--hf-active` and the word «Seleccionado».
 *
 * Slots (scoped `{ item, selected }`):
 *   preview  — replaces the text preview line
 *   selected — revealed inside the chosen card only (for example a quantity input)
 */
import { computed, ref, useId } from 'vue'
import HfSelectionMark from './HfSelectionMark.vue'
import './hf-selection.css'

export interface HfRadioCardItem {
  value: string
  label: string
  description?: string
  preview?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    items: readonly HfRadioCardItem[]
    modelValue?: string | null
    label?: string
    labelledby?: string
    disabled?: boolean
    /** Word shown on the chosen card; empty hides it. */
    selectedLabel?: string
  }>(),
  {
    modelValue: null,
    label: undefined,
    labelledby: undefined,
    disabled: false,
    selectedLabel: 'Seleccionado',
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

defineSlots<{
  preview?: (props: { item: HfRadioCardItem; selected: boolean }) => unknown
  selected?: (props: { item: HfRadioCardItem; selected: boolean }) => unknown
}>()

const baseId = useId()
const buttons = ref<HTMLButtonElement[]>([])

const checkedIndex = computed(() => props.items.findIndex((item) => item.value === props.modelValue))
const tabStop = computed(() => {
  if (checkedIndex.value >= 0) return checkedIndex.value
  return Math.max(0, props.items.findIndex((item) => !item.disabled))
})

const KEY_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function ids(index: number) {
  const id = `${baseId}-${index}`
  return { title: `${id}-title`, desc: `${id}-desc`, preview: `${id}-preview` }
}

function describedBy(item: HfRadioCardItem, index: number, hasPreviewSlot: boolean) {
  const { desc, preview } = ids(index)
  const list: string[] = []
  if (item.description) list.push(desc)
  if (item.preview || hasPreviewSlot) list.push(preview)
  return list.length ? list.join(' ') : undefined
}

function choose(index: number, focus: boolean) {
  const item = props.items[index]
  if (props.disabled || !item || item.disabled) return
  if (item.value !== props.modelValue) emit('update:modelValue', item.value)
  if (focus) buttons.value[index]?.focus()
}

function enabledFrom(start: number, step: number) {
  const count = props.items.length
  for (let offset = 0; offset < count; offset++) {
    const index = (((start + step * offset) % count) + count) % count
    if (!props.items[index]?.disabled) return index
  }
  return -1
}

function onKeydown(event: KeyboardEvent, index: number) {
  let next = -1
  if (event.key === 'Home') next = enabledFrom(0, 1)
  else if (event.key === 'End') next = enabledFrom(props.items.length - 1, -1)
  else if (event.key in KEY_STEP) next = enabledFrom(index + KEY_STEP[event.key]!, KEY_STEP[event.key]!)
  else return
  event.preventDefault()
  if (next >= 0) choose(next, true)
}
</script>

<template>
  <div
    class="hf-radio-cards"
    role="radiogroup"
    :aria-label="label"
    :aria-labelledby="labelledby"
    :aria-disabled="disabled ? 'true' : undefined"
  >
    <div
      v-for="(item, index) in items"
      :key="item.value"
      class="hf-radio-card"
      :data-selected="String(index === checkedIndex)"
    >
      <button
        ref="buttons"
        type="button"
        role="radio"
        class="hf-radio-card__button"
        :aria-checked="index === checkedIndex"
        :aria-disabled="disabled || item.disabled ? 'true' : undefined"
        :aria-labelledby="ids(index).title"
        :aria-describedby="describedBy(item, index, !!$slots.preview)"
        :tabindex="index === tabStop ? 0 : -1"
        :data-value="item.value"
        @click="choose(index, false)"
        @keydown="onKeydown($event, index)"
      >
        <HfSelectionMark :state="index === checkedIndex ? 'checked' : 'unchecked'" />
        <span class="hf-radio-card__body">
          <span :id="ids(index).title" class="hf-radio-card__title">{{ item.label }}</span>
          <span v-if="item.description" :id="ids(index).desc" class="hf-radio-card__desc">
            {{ item.description }}
          </span>
          <span v-if="$slots.preview || item.preview" :id="ids(index).preview" class="hf-radio-card__preview">
            <slot name="preview" :item="item" :selected="index === checkedIndex">{{ item.preview }}</slot>
          </span>
        </span>
        <span
          v-if="selectedLabel"
          class="hf-radio-card__tag"
          :class="{ invisible: index !== checkedIndex }"
          aria-hidden="true"
        >
          {{ selectedLabel }}
        </span>
      </button>
      <div v-if="index === checkedIndex && $slots.selected" class="hf-radio-card__extra">
        <slot name="selected" :item="item" :selected="true" />
      </div>
    </div>
  </div>
</template>
