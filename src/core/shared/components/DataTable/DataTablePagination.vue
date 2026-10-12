<script setup lang="ts">
import { computed } from 'vue'

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
    pageSizeOptions: () => [5, 10, 20, 50],
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
    class="hf-pagination flex w-full min-w-0 max-w-full flex-col gap-3 border-default pt-4 sm:flex-row sm:items-center sm:justify-between border-t"
  >
    <!-- Showing info -->
    <div class="hf-pagination-summary text-sm text-muted">
      <template v-if="totalCount > 0">
        Mostrando {{ showingFrom }}-{{ showingTo }} de {{ totalCount }}
      </template>
      <template v-else> Sin resultados </template>
    </div>

    <div
      class="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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

      <!-- Pagination -->
      <UPagination
        v-model:page="currentPage"
        :items-per-page="pageSize"
        :total="totalCount"
        :disabled="fetching"
        show-edges
        :sibling-count="1"
        class="hf-pagination-navigation min-w-0 max-w-full"
      />
    </div>
  </div>
</template>
