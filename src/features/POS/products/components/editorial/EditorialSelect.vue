<script setup lang="ts">
export interface EditorialSelectItem { label: string; value: string; disabled?: boolean }

/** The single-choice list of the editorial editor: Nuxt UI `USelect`. The caller names the row in
 * `label`; the listbox is themed with the hf classes so it follows dark mode. Item values are never
 * empty (a listbox cannot select ""), the empty state is the placeholder. The caller owns the value:
 * an empty model always shows the placeholder again, which is what an "add" list needs after its pick.
 * Several choices use EditorialSelectMenu.
 */
withDefaults(defineProps<{ id?: string; label: string; items: readonly EditorialSelectItem[]; modelValue?: string;
  placeholder?: string; disabled?: boolean; invalid?: boolean; describedby?: string }>(), { placeholder: 'Elige…' })
// A plain prop, not defineModel: a caller that only listens (an "add" list) would get a local copy that keeps
// the last pick, which then outlives the row it added.
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()
const content = 'hf-theme hf-ui'
function picked(value: unknown) { emit('update:modelValue', typeof value === 'string' ? value : undefined) }
</script>

<template>
  <USelect :id="id" :model-value="modelValue ?? null" :items="[...items]" :placeholder="placeholder" :disabled="disabled" :aria-label="label"
    :aria-invalid="invalid || undefined" :aria-describedby="describedby" class="w-full" :ui="{ content }" @update:model-value="picked" />
</template>
