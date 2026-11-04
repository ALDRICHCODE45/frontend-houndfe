<script setup lang="ts">
import FilterSectionCard from './FilterSectionCard.vue'

defineProps<{
  items: ReadonlyArray<{ label: string; value: string }>
  label: string
  /** Optional theme class for the teleported listbox; omitted keeps the native defaults. */
  portalClass?: string
  testId?: string
}>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <!-- Titled section in the mobile Filtros sheet; inline control beside the search on md+. -->
  <FilterSectionCard :title="label">
    <USelect
      v-model="model"
      :items="[...items]"
      size="sm"
      :aria-label="label"
      :data-testid="testId"
      class="hf-toolbar-select w-full md:w-44"
      :ui="portalClass ? { content: portalClass } : undefined"
    />
  </FilterSectionCard>
</template>

<style>
.hf-toolbar-select {
  min-height: var(--hf-control-height, 2.75rem);
}
</style>
