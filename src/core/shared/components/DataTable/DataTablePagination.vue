<script setup lang="ts">
import { computed } from 'vue'
import { TABLE_PAGE_SIZE_OPTIONS } from '../../constants/table-page-size'

const props = withDefaults(
  defineProps<{
    pageIndex: number
    pageSize: number
    pageCount: number
    totalCount: number
    showingFrom: number
    showingTo: number
    pageSizeOptions?: number[]
    fetching?: boolean
    /** Optional presentation boundary for the teleported page-size menu. */
    portalClass?: string
  }>(),
  {
    pageSizeOptions: () => [...TABLE_PAGE_SIZE_OPTIONS],
    fetching: false,
  },
)

const emit = defineEmits<{
  'update:pageIndex': [value: number]
  'update:pageSize': [value: number]
}>()

const currentPage = computed({
  get: () => props.pageIndex + 1, // UPagination is 1-indexed
  set: (value: number) => emit('update:pageIndex', value - 1),
})

// Compact navigation below sm (mobile-tables T1): «Página 3 de 9» between first/prev and
// next/last, so the pager never overflows a 360px row. sm+ keeps the numbered UPagination.
const lastPage = computed(() => Math.max(props.pageCount, 1))
const atFirst = computed(() => currentPage.value <= 1)
const atLast = computed(() => currentPage.value >= lastPage.value)
function goTo(page: number) {
  const target = Math.min(Math.max(page, 1), lastPage.value)
  if (target !== currentPage.value) currentPage.value = target
}

const pageSizeItems = computed(() =>
  props.pageSizeOptions.map((size) => [
    {
      label: `${size} por página`,
      type: 'checkbox' as const,
      checked: props.pageSize === size,
      onSelect: () => emit('update:pageSize', size),
    },
  ]),
)
</script>

<template>
  <div
    class="hf-pagination flex w-full min-w-0 max-w-full flex-row flex-wrap items-center justify-between gap-3 border-default pt-4 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between border-t"
  >
    <!-- Below sm: one row with the range and an auto-width page size (wraps if it must),
         then the compact navigation. From sm the historical row is unchanged. -->
    <!-- Showing info -->
    <div class="hf-pagination-summary shrink-0 whitespace-nowrap text-sm text-muted">
      <template v-if="totalCount > 0">
        Mostrando {{ showingFrom }}-{{ showingTo }} de {{ totalCount }}
      </template>
      <template v-else> Sin resultados </template>
    </div>

    <!-- `contents` below sm: the size control joins the range row; a box again from sm. -->
    <div
      class="contents min-w-0 sm:flex sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      data-testid="pagination-controls"
    >
      <!-- Page Size Selector -->
      <UDropdownMenu
        :items="pageSizeItems"
        :content="{ align: 'end' as const }"
        :ui="portalClass ? { content: portalClass } : undefined"
      >
        <UButton
          color="neutral"
          variant="outline"
          class="hf-pagination-size"
          :label="`${pageSize} por página`"
          trailing-icon="i-lucide-chevron-down"
          size="sm"
        />
      </UDropdownMenu>

      <!-- Pagination (sm+) -->
      <UPagination
        v-model:page="currentPage"
        :items-per-page="pageSize"
        :total="totalCount"
        :disabled="fetching"
        show-edges
        :sibling-count="1"
        class="hf-pagination-navigation min-w-0 max-w-full max-sm:hidden"
      />
    </div>

    <!-- Compact pagination (below sm) -->
    <nav
      v-if="lastPage > 1"
      class="hf-pagination-compact flex w-full items-center justify-between gap-2 sm:hidden"
      aria-label="Paginación"
      data-testid="pagination-compact"
    >
      <div class="flex items-center gap-1">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevrons-left"
          aria-label="Primera página"
          class="size-11 justify-center"
          :disabled="fetching || atFirst"
          @click="goTo(1)"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevron-left"
          aria-label="Página anterior"
          class="size-11 justify-center"
          :disabled="fetching || atFirst"
          @click="goTo(currentPage - 1)"
        />
      </div>
      <span class="text-sm whitespace-nowrap text-default" aria-live="polite" data-testid="pagination-compact-status">Página {{ currentPage }} de {{ lastPage }}</span>
      <div class="flex items-center gap-1">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevron-right"
          aria-label="Página siguiente"
          class="size-11 justify-center"
          :disabled="fetching || atLast"
          @click="goTo(currentPage + 1)"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevrons-right"
          aria-label="Última página"
          class="size-11 justify-center"
          :disabled="fetching || atLast"
          @click="goTo(lastPage)"
        />
      </div>
    </nav>
  </div>
</template>
