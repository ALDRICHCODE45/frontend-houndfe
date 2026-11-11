<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import { FILTER_VISIBLE_OPTIONS, type FilterGroup, type FilterOption } from '../utils/filter-model'

/**
 * One filter group as selectable rows with a round mark and the product count (Selección sin
 * checkboxes). Five options show at first; the rest wait behind «Ver más». With `collapsible` the
 * group is an accordion section (the mobile sheet keeps one open at a time).
 */
const props = withDefaults(
  defineProps<{ group: FilterGroup; collapsible?: boolean; open?: boolean }>(),
  { collapsible: false, open: true },
)
const emit = defineEmits<{ select: [option: FilterOption]; 'toggle-open': [] }>()

const titleId = `catalog-filter-${useId()}`
const hiddenCount = computed(() => Math.max(0, props.group.options.length - FILTER_VISIBLE_OPTIONS))
// A selected option that would hide behind «Ver más» opens the list from the start.
const expanded = shallowRef(
  props.group.options.some((option, index) => option.pressed && index >= FILTER_VISIBLE_OPTIONS),
)
const visibleOptions = computed(() =>
  expanded.value ? props.group.options : props.group.options.slice(0, FILTER_VISIBLE_OPTIONS),
)
const isOpen = computed(() => !props.collapsible || props.open)
</script>

<template>
  <section class="catalog-filter-group" :data-facet="group.key">
    <button
      v-if="collapsible"
      type="button"
      class="catalog-filter-group-toggle"
      data-testid="catalog-filter-group-toggle"
      :aria-expanded="isOpen"
      @click="emit('toggle-open')"
    >
      <h3 :id="titleId">{{ group.label }}</h3>
      <span class="catalog-filter-group-current">
        {{ group.selectedLabel || 'Todas' }}
        <UIcon
          name="i-lucide-chevron-down"
          class="catalog-filter-group-chevron"
          :data-open="isOpen"
          aria-hidden="true"
        />
      </span>
    </button>
    <h3 v-else :id="titleId">{{ group.label }}</h3>
    <div v-if="isOpen" role="group" :aria-labelledby="titleId" class="catalog-filter-options">
      <button
        v-for="option in visibleOptions"
        :key="option.key"
        type="button"
        class="catalog-filter-option"
        :aria-pressed="option.pressed"
        :aria-label="option.ariaLabel"
        @click="emit('select', option)"
      >
        <span class="catalog-filter-option-label">{{ option.label }}</span>
        {{ ' ' }}
        <span class="catalog-filter-option-count">{{ option.count }}</span>
        <span class="catalog-filter-option-mark" aria-hidden="true">
          <UIcon name="i-lucide-check" class="size-3" />
        </span>
      </button>
      <button
        v-if="hiddenCount > 0"
        type="button"
        class="catalog-filter-more"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Ver menos' : `Ver más (${hiddenCount})` }}
        <UIcon
          name="i-lucide-chevron-down"
          class="catalog-filter-group-chevron"
          :data-open="expanded"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>
