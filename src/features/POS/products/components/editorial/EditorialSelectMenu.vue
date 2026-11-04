<script setup lang="ts">
import type { EditorialSelectItem } from './EditorialSelect.vue'

/** The several-choices list of the editorial editor: Nuxt UI `USelectMenu`, themed like EditorialSelect.
 * The caller owns the selection and gets the whole of it back on every pick.
 */
withDefaults(defineProps<{ id?: string; label: string; items: readonly EditorialSelectItem[];
  placeholder?: string; disabled?: boolean; invalid?: boolean; describedby?: string }>(), { placeholder: 'Elige…' })
const model = defineModel<readonly string[]>({ default: () => [] })
const content = 'hf-theme hf-ui'
function picked(value: unknown) { model.value = Array.isArray(value) ? value.map(String) : [] }
</script>

<template>
  <USelectMenu :id="id" :model-value="[...model]" multiple value-key="value" :items="[...items]" :search-input="false" :placeholder="placeholder"
    :disabled="disabled" :aria-label="label" :aria-invalid="invalid || undefined" :aria-describedby="describedby" class="w-full" :ui="{ content }"
    @update:model-value="picked" />
</template>
