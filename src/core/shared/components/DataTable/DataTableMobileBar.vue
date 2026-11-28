<script setup lang="ts">
/**
 * The phone result line under the toolbar search (design/mobile-tables 01): «86 clientes», the short
 * «Ordenar» menu (the table's sort options only; filters stay in their sheet) and «Seleccionar».
 * In selection mode it becomes the select header: the page mark, «N seleccionados · de 86» and
 * «Listo». Every target is 44px.
 */
import { computed } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { TableSortOption } from '../../types/table.types'
import HfRowMark from '../selection/HfRowMark.vue'

const props = withDefaults(
  defineProps<{
    totalCount: number
    itemLabel: { one: string; other: string }
    selectedLabel?: { one: string; other: string }
    sortOptions?: TableSortOption[]
    /** `<id>:asc|desc` of the current sort, when it is one of the options. */
    sortValue?: string
    selectable?: boolean
    selecting?: boolean
    selectedCount?: number
    /** The page mark: all, some (`mixed`) or none of the page. */
    pageState?: boolean | 'mixed'
    selectAllLabel?: string
    portalClass?: string
  }>(),
  {
    selectedLabel: () => ({ one: 'seleccionado', other: 'seleccionados' }),
    sortOptions: () => [],
    sortValue: undefined,
    selectable: false,
    selecting: false,
    selectedCount: 0,
    pageState: false,
    selectAllLabel: 'Seleccionar todos',
    portalClass: undefined,
  },
)

const emit = defineEmits<{
  'update:sortValue': [value: string]
  'update:selecting': [value: boolean]
  'toggle-page': [value: boolean]
}>()

const count = (n: number, label: { one: string; other: string }) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? label.one : label.other}`

const totalText = computed(() => count(props.totalCount, props.itemLabel))
const selectedText = computed(() => count(props.selectedCount, props.selectedLabel))
const currentSort = computed(() => props.sortOptions.find(option => option.value === props.sortValue))
const sortName = computed(() =>
  currentSort.value ? `Ordenado por ${currentSort.value.label}. Cambiar orden` : 'Ordenar',
)
const sortItems = computed<DropdownMenuItem[]>(() =>
  props.sortOptions.map(option => ({
    label: option.label,
    type: 'checkbox' as const,
    checked: option.value === props.sortValue,
    onSelect: () => emit('update:sortValue', option.value),
  })),
)
const menuContentClass = computed(() =>
  [...new Set(['hf-theme', 'hf-ui', ...(props.portalClass?.split(/\s+/) ?? [])])].filter(Boolean).join(' '),
)
</script>

<template>
  <div v-if="selecting" class="hf-mbar hf-mbar--select" data-testid="mobile-select-head">
    <HfRowMark :checked="pageState" :label="selectAllLabel" @update:checked="emit('toggle-page', $event)" />
    <p class="hf-mbar__count">
      <span>{{ selectedText }}</span>
      <small>de {{ totalCount.toLocaleString('en-US') }} · toca para marcar</small>
    </p>
    <button type="button" class="hf-mbar__tbtn" data-testid="mobile-select-done" @click="emit('update:selecting', false)">
      Listo
    </button>
  </div>
  <div v-else class="hf-mbar" data-testid="mobile-result-line">
    <p class="hf-mbar__total" aria-live="polite"><b>{{ totalText }}</b></p>
    <UDropdownMenu
      v-if="sortOptions.length > 0"
      :items="sortItems"
      :content="{ align: 'end', sideOffset: 4 }"
      :ui="{ content: menuContentClass }"
    >
      <button type="button" class="hf-mbar__tbtn" :aria-label="sortName" data-testid="mobile-sort-button">
        <UIcon name="i-lucide-arrow-up-down" class="hf-mbar__icon" aria-hidden="true" />
        <span class="hf-mbar__sort-label">{{ currentSort?.label ?? 'Ordenar' }}</span>
      </button>
    </UDropdownMenu>
    <button
      v-if="selectable"
      type="button"
      class="hf-mbar__tbtn"
      data-testid="mobile-select-toggle"
      @click="emit('update:selecting', true)"
    >
      <UIcon name="i-lucide-list-checks" class="hf-mbar__icon" aria-hidden="true" />
      Seleccionar
    </button>
  </div>
</template>
