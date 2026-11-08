<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import { TABLE_DENSITIES, type TableDensity } from './tableLayout'

/** Row density presets as a segmented radio group (artboard 01): one tab stop, arrows move the choice. */
const props = withDefaults(defineProps<{ density: TableDensity; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ 'update:density': [density: TableDensity] }>()

const OPTIONS: Record<TableDensity, { label: string; height: number }> = {
  compact: { label: 'Compacta', height: 40 },
  normal: { label: 'Normal', height: 48 },
  comfortable: { label: 'Cómoda', height: 64 },
}

const group = useTemplateRef<HTMLElement>('group')

function pick(density: TableDensity) {
  if (density !== props.density) emit('update:density', density)
}

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
function onKeydown(event: KeyboardEvent) {
  const step = STEPS[event.key]
  if (step === undefined) return
  event.preventDefault()
  const index = TABLE_DENSITIES.indexOf(props.density)
  const next = TABLE_DENSITIES[(index + step + TABLE_DENSITIES.length) % TABLE_DENSITIES.length]!
  pick(next)
  // The focus follows the checked radio once the parent applies it.
  nextTick(() => group.value?.querySelector<HTMLElement>(`[data-density-option="${next}"]`)?.focus())
}
</script>

<template>
  <div ref="group" class="hf-density" role="radiogroup" aria-label="Densidad de filas" @keydown="onKeydown">
    <button
      v-for="density in TABLE_DENSITIES"
      :key="density"
      type="button"
      role="radio"
      class="hf-density__option"
      :aria-checked="density === props.density"
      :tabindex="density === props.density ? 0 : -1"
      :title="`Filas de ${OPTIONS[density].height} px`"
      :disabled="props.disabled"
      :data-density-option="density"
      @click="pick(density)"
    >
      {{ OPTIONS[density].label }}
    </button>
  </div>
</template>
