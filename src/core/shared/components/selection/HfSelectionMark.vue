<script setup lang="ts">
/**
 * HfSelectionMark — the painted 24px round mark shared by the selection
 * primitives (internal, not exported): an empty ring at rest, a filled
 * `--hf-active` disc with a check when checked, a dash when mixed. Decorative:
 * the owning control carries the role and the state.
 */
import { computed } from 'vue'
import './hf-selection.css'

const props = defineProps<{ state: 'unchecked' | 'checked' | 'mixed' }>()
const icon = computed(() => (props.state === 'mixed' ? 'i-lucide-minus' : 'i-lucide-check'))
</script>

<template>
  <span class="hf-sel-mark" :data-state="state" aria-hidden="true">
    <UIcon :name="icon" class="hf-sel-mark__icon" />
  </span>
</template>
