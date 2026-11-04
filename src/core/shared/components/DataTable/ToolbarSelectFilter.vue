<script setup lang="ts">
import { computed } from 'vue'
import FilterSectionCard from './FilterSectionCard.vue'

const props = defineProps<{
  items: ReadonlyArray<{ label: string; value: string }>
  label: string
  /** Optional theme class for the teleported listbox; omitted keeps the native defaults. */
  portalClass?: string
  testId?: string
}>()
const model = defineModel<string>({ required: true })

// The control names itself (`Estado · Todas`) so no consumer needs a separate label. On mobile the
// titled section above the control already says it, so the prefix shows from md up only.
const selectedLabel = computed(() => props.items.find((item) => item.value === model.value)?.label ?? '')
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
      class="hf-toolbar-select w-full md:w-52 md:shrink-0"
      :ui="portalClass ? { content: portalClass } : undefined"
    >
      <span data-slot="value" class="truncate pointer-events-none">
        <span class="hf-toolbar-select-name max-md:hidden">{{ selectedLabel ? `${label} ·\u00a0` : label }}</span>{{ selectedLabel }}
      </span>
    </USelect>
  </FilterSectionCard>
</template>

<style>
.hf-toolbar-select {
  min-height: var(--hf-control-height, 2.75rem);
}
</style>
